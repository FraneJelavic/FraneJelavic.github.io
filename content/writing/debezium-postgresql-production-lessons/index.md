+++
title = 'Debezium and PostgreSQL in Production: Surviving Database Failover'
date = '2026-08-10T17:00:00+02:00'
lastmod = '2026-08-10T17:00:00+02:00'
draft = true
description = 'What PostgreSQL replication slots taught us about operating Debezium a HA production environment.'
categories = ['Distributed Systems']
tags = ['Debezium', 'PostgreSQL', 'Kafka Connect', 'CDC']
toc = true
+++

Getting Debezium to stream the first PostgreSQL change into Kafka is straightforward. Keeping that pipeline correct through database failover is where the interesting work begins.

This post describes a failure mode we addressed while operating Debezium with PostgreSQL 16 and Patroni 3.3.1. After promoting a standby, Debezium needed a logical replication slot from which it could safely continue. Creating a new slot after promotion could start beyond Debezium’s last durable offset and introduce an event gap.
The central lesson was to treat PostgreSQL’s replication slot and Debezium’s Kafka Connect offset as parts of one distributed checkpoint.

## The pipeline

Our applications uses the transactional outbox pattern. A business change and the corresponding outbox record are committed in the same database transaction. Debezium reads changes to the outbox table from PostgreSQL’s write-ahead log, transforms them into the event format expected by consumers, and publishes them to Kafka.

![application flow](images/appFlow.png)

This removes the unsafe gap between committing a database transaction and separately attempting to publish an event. If Debezium or Kafka is temporarily unavailable, the committed outbox row remains available for later processing.

The pipeline operates on an at-least-once guarantee. A failure can occur after an event reaches Kafka but before the corresponding source offset is durably recorded. Debezium can then replay the event after restarting, so consumers must be idempotent.

## Knowledge refresher

### WAL and LSN

PostgreSQL reads the relevant data page into memory (`shared buffers`). The page is modified in the memory and a corresponding WAL (`Write Ahead Log`) record is created. The WAL record is placed into WAL buffers and the corresponding page is marked as dirty with a page LSN (`Log Sequence Number`). The page LSN records which WAL entry corresponds to the page’s latest changes. Before that dirty page can be written to its table/index file, the corresponding WAL must be flushed to durable storage.

![PostgreSQL WAL](images/PostgresWAL.png)

### `wal_level = logical`

Setting the wal_level from replica (default) to logical is mandatory change to support logical decoding for logical replication (requires full server restart).
WAL get's *additional information* (catalog snapshot, changes, transaction boundaries, etc.) so rows can be reconstructed as SQL changes.

![logical decoding](images/logicalDecoding.png)

## One checkpoint across two systems

PostgreSQL and Kafka Connect each retain part of the connector’s progress:
- PostgreSQL’s logical replication slot retains the WAL required by the connector.
- Kafka Connect stores Debezium’s most recently committed source offset in its offset topic.

Conceptually, progress moves through the system like this:

```text
PostgreSQL generates WAL
      └─ the logical slot exposes changes
            └─ Debezium streams & decodes
                  ├─ advances slot's LSN → PG recycles older WAL
                  └─ commits source offset to Kafka topic
```


These positions do not remain identical at every instant. PostgreSQL, Debezium, and Kafka progress independently.
The important invariant is:

After failover, PostgreSQL must retain every WAL record Debezium might request from its last durable Kafka Connect offset.

Starting from an older position may replay events. Starting from a newer position may skip them. Replay is recoverable with idempotent consumers; an LSN gap is not.
The accompanying [PostgreSQL 16 and Debezium playground](https://github.com/FraneJelavic/postgres-debezium-playground) can be used to inspect slots, publications, and connector offsets in a local cluster.

## The PostgreSQL 16 failover problem

PostgreSQL 16 supports logical decoding and logical replication slots on a standby. However, it does not automatically synchronize the primary’s logical slot state to the standbys.

Before failover, Debezium consumes through a logical slot on the primary while Kafka Connect stores its durable source offset:

![system before failover](images/beforeFailover.png)

If the standby is promoted without a usable copy of that slot, Debezium cannot simply continue from the same checkpoint.
Creating a replacement slot on the new primary is not equivalent. A new slot begins from a position available at creation time and cannot be moved backward to recover WAL that is no longer retained.

![data loss scenario](images/afterFailover.png)

No events were lost in our case. We identified this as a failure mode that had to be eliminated before the standby could safely accept Debezium after promotion.

### Patroni permanent logical slots

[Alexander Kukushkin (The Patroni guy)](https://github.com/cyberdem0n) in a [podcast](https://www.youtube.com/watch?v=SllJsbPVaow) with [Nikolay Samokhvalov](https://github.com/NikolayS) explains how the problem was solved in Patroni with permanent replication slots.

**TLDV** Patroni implementation does the following:
- Uses **fsync** (forces flush to disk on the OS level) to copy the replication slot from `$PGDATA/pg_replslot/slot_name`
    - requires a `superuser` or `rewind_user` to copy files
    - a restart of standy nodes is needed for the replication slots to be created
    - uses pg_read_binary_file() function to copy the slot file if it is missing on the replica
- Utilizes Patroni **loop_wait** (default 10s) to call `pg_replication_slot_advance('slot_name', 'LSN_position')` and move the LSN on the replication slot forward to a specific position
- Automatically enables `hot_standby_feedback` if it is not already enabled
- Uses replication slot after replica has been promoted to primary

**Potential problems**
- requested WAL segment `pg_wal/XXX` has been removed
- physical slot is behind logical slot (unlikely to happen)
    - physical slot did not reach the `catalog_xmin` transaction of the logical slot on the old primary (Patroni logs a WARN message that it might be unsafe to use)


### [Zeno's paradox](https://en.wikipedia.org/wiki/Zeno%27s_paradoxes)

Enabling permanent slots on an already busy cluster was more difficult than enabling them on a new cluster.

While a standby was restarting and catching up, the logical slot on the primary continued to advance. PostgreSQL could remove catalog tuples required for logical decoding before the copied slot became usable on the standby. The standby then invalidated (`wal_status = lost`) the slot because it conflicted with recovery:

```
This slot has been invalidated because it was conflicting with recovery.
```

This was not simply a matter of retaining more WAL. Logical decoding also depends on catalog visibility represented by `catalog_xmin`. Increasing `wal_keep_size` alone could not restore catalog rows that recovery and vacuum had already made unavailable.
Increasing `max_standby_streaming_delay` also didn't help as long as the standby was rebooted.

The system was effectively chasing a moving checkpoint: by the time the standby came back and attempted to use the copied state, the required catalog horizon had already moved.

### How we approached the transition

Instead of treating the operation as a reusable sequence of commands, we treated it as a checkpoint-alignment problem.

1. Create the corresponding logical slots on the replicas by hand
    - `pg_create_logical_replication_slot('slot_name', 'pgoutput')`
2. Align them with the safely acknowledged position on the primary
    - `pg_replication_slot_advance('slot_name', 'LSN/12345')`
3. Add the permanent-slot configuration to Patroni
4. Reload the configuration instead of restarting the database nodes
5. Patroni continues to monitor and advance slots without `ERROR`

The property we validated was:\

Every candidate primary retained a usable logical slot covering every WAL record Debezium might request after promotion.

Subsequent production failovers completed without detected LSN gaps or skipped events.`

### What PostgreSQL 17 changes

PostgreSQL 17 introduced synchronized failover slots. A logical slot marked for failover can be synchronized from the primary to a standby using PostgreSQL’s native slot-synchronization facilities.

This reduces the need for PostgreSQL 16-era slot-copying approaches, but it does not remove the operational responsibility. Synchronization is asynchronous, and failover readiness must still be verified before promotion.

For PostgreSQL 17 and newer deployments, use the native failover-slot design and its readiness checks instead of copying this PostgreSQL 16 and Patroni 3.3.1 approach.

## Takeaways

1. Treat PostgreSQL’s replication slot and Debezium’s offset as one distributed checkpoint.
2. Prefer replay with idempotent consumers over any possibility of an LSN gap.
3. Make logical-slot continuity part of the database failover design.
4. Distinguish a healthy connector from a proven gap-free recovery.
5. Test promotion with real writes and checkpoint comparisons, not only process-health checks.
6. Scope operational guidance to the PostgreSQL and Patroni versions for which it was validated.

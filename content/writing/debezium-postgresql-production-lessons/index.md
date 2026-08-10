+++
title = 'Debezium and PostgreSQL in Production: Surviving Database Failover'
date = '2026-08-10T17:00:00+02:00'
lastmod = '2026-08-10T17:00:00+02:00'
draft = false
description = 'What PostgreSQL replication slots taught us about operating Debezium in an HA production environment.'
categories = ['Distributed Systems']
tags = ['Debezium', 'PostgreSQL', 'Kafka Connect', 'CDC']
toc = true
+++

Getting Debezium to stream the first PostgreSQL change into Kafka is straightforward. Keeping that pipeline correct through database failover is where the interesting work begins.

This post describes a failure mode we addressed while operating Debezium with PostgreSQL 16 and Patroni 3.3.1. After promoting a standby, Debezium needed a logical replication slot from which it could safely continue. Creating a new slot after promotion could start beyond Debezium’s last durable offset and introduce an event gap.
The central lesson was to treat PostgreSQL’s replication slot and Debezium’s Kafka Connect offset as parts of one distributed checkpoint.

## The pipeline

Our applications use the transactional outbox pattern. A business change and the corresponding outbox record are committed in the same database transaction. Debezium reads changes to the outbox table from PostgreSQL’s write-ahead log, transforms them into the event format expected by consumers, and publishes them to Kafka.

![An application commits business data and an outbox record to PostgreSQL; Debezium reads the replication slot and publishes the event to Kafka](images/appFlow.png)

This removes the unsafe gap between committing a database transaction and separately attempting to publish an event. If Debezium or Kafka is temporarily unavailable, the committed outbox row remains available for later processing.

The pipeline provides at-least-once delivery. A failure can occur after an event reaches Kafka but before the corresponding source offset is durably recorded. Debezium can then replay the event after restarting, so consumers must be idempotent.

## WAL refresher

### WAL and LSN

PostgreSQL reads the relevant data page into memory (`shared buffers`). The page is modified in memory, and a corresponding WAL (write-ahead log) record is created. The WAL record is placed in the WAL buffers, and the corresponding page is marked as dirty with a page LSN (log sequence number). The page LSN records which WAL entry corresponds to the page’s latest changes. Before that dirty page can be written to its table or index file, the corresponding WAL must be flushed to durable storage.

![PostgreSQL records inserts, updates, and deletes in WAL before modified pages are written during a checkpoint](images/PostgresWAL.png)

### `wal_level = logical`

Changing `wal_level` from its default value of `replica` to `logical` is required to support logical decoding for logical replication. This change requires a full server restart.
WAL includes *additional information* (catalog snapshots, changes, transaction boundaries, etc.) so that row changes can be reconstructed.

![Logical decoding reconstructs committed transaction changes from interleaved WAL records](images/logicalDecoding.png)

## One checkpoint across two systems

PostgreSQL and Kafka Connect each retain part of the connector’s progress:

- PostgreSQL’s logical replication slot retains the WAL required by the connector.
- Kafka Connect stores Debezium’s most recently committed source offset in its offset topic.

Conceptually, progress moves through the system like this:

```text
PostgreSQL generates WAL
      └─ the logical slot exposes changes
            └─ Debezium streams and decodes
                  ├─ advances slot's LSN → PG recycles older WAL
                  └─ commits source offset to Kafka topic
```


These positions do not remain identical at every instant. PostgreSQL, Debezium, and Kafka progress independently.
The important invariant is:

> After failover, PostgreSQL must retain every WAL record Debezium might request from its last durable Kafka Connect offset.

Starting from an older position may replay events. Starting from a newer position may skip them. Replay is recoverable with idempotent consumers; an LSN gap is not.
The accompanying [PostgreSQL 16 and Debezium playground](https://github.com/FraneJelavic/postgres-debezium-playground) can be used to inspect slots, publications, and connector offsets in a local cluster.

## The PostgreSQL 16 failover problem

PostgreSQL 16 supports logical decoding and logical replication slots on a standby. However, it does not automatically synchronize the primary’s logical slot state with the standbys.

Before failover, Debezium consumes through a logical slot on the primary while Kafka Connect stores its durable source offset:

![Before failover, Debezium reads the logical slot on the primary while Kafka Connect stores its durable LSN in the offset topic](images/beforeFailover.png)

If the standby is promoted without a usable copy of that slot, Debezium cannot simply continue from the same checkpoint.
Creating a replacement slot on the new primary is not equivalent. A new slot begins from a position available at creation time and cannot be moved backward to recover WAL that is no longer retained.

![After failover, a replacement slot starts beyond Kafka Connect's durable LSN, creating a potential event gap](images/afterFailover.png)

No events were lost in our case. We identified this as a failure mode that had to be eliminated before the standby could safely accept Debezium after promotion.

### Patroni permanent logical slots

[Alexander Kukushkin (the Patroni guy)](https://github.com/cyberdem0n) explains how Patroni solved this problem with permanent replication slots in a [podcast](https://www.youtube.com/watch?v=SllJsbPVaow) with [Nikolay Samokhvalov](https://github.com/NikolayS).

As described in Patroni’s official documentation for [permanent replication slots](https://patroni.readthedocs.io/en/latest/dynamic_configuration.html#dynamic-configuration-settings), logical slots are copied from the primary to standby nodes and their positions are advanced periodically. Patroni’s [slot synchronization implementation](https://patroni.readthedocs.io/en/latest/modules/patroni.postgresql.slots.html) creates missing logical slots on replicas by copying them from the primary and advances existing slots when their confirmed position falls behind.

Permanent logical slots require `postgresql.use_slots` to be enabled. Patroni also enforces the `hot_standby_feedback` setting on nodes that host permanent logical slots so the primary retains catalog rows needed for logical decoding.

**Potential problems:**

- The requested WAL segment `pg_wal/XXX` has been removed.
- The physical slot is behind the logical slot (unlikely to happen).
    - The physical slot did not reach the `catalog_xmin` transaction of the logical slot on the old primary. Patroni logs a warning that it might be unsafe to use.


### [Zeno's paradox](https://en.wikipedia.org/wiki/Zeno%27s_paradoxes)

Enabling permanent slots on an already busy cluster was more difficult than enabling them on a new cluster.

While a standby was restarting and catching up, the logical slot on the primary continued to advance. PostgreSQL could remove catalog tuples required for logical decoding before the copied slot became usable on the standby. The standby then invalidated (`wal_status = lost`) the slot because it conflicted with recovery:

```
This slot has been invalidated because it was conflicting with recovery.
```

This was not simply a matter of retaining more WAL. Logical decoding also depends on catalog visibility represented by `catalog_xmin`. Increasing `wal_keep_size` alone could not restore catalog rows that recovery and vacuum had already made unavailable.
Increasing `max_standby_streaming_delay` also did not help while the standby still had to be rebooted.

The system was effectively chasing a moving checkpoint: by the time the standby came back and attempted to use the copied state, the required catalog horizon had already moved.

### How we approached the transition

Instead of treating the operation as a reusable sequence of commands, we treated it as a checkpoint-alignment problem.

In our Patroni 3.3.1 rollout, allowing Patroni to introduce missing permanent logical slots required restarting the busy standbys so that the copied slot state could take effect. Those restarts created the race described above: by the time a standby returned, the required catalog horizon could already have moved.

The turning point was to create the corresponding logical slot directly on each PostgreSQL 16 standby before enabling Patroni’s permanent-slot configuration. PostgreSQL could create those slots without restarting the standbys. We aligned each slot only to a checkpoint that we had verified as safe, then reloaded the Patroni configuration. Because the slots already existed, Patroni adopted them and continued advancing their positions instead of entering the missing-slot copy path.

This is intentionally an analysis rather than a reusable runbook. The safe checkpoint depends on the primary, standby replay position, retained WAL, and Debezium’s durable offset; advancing a slot too far can create the event gap this process is meant to prevent.

The property we validated was:

> Every candidate primary retained a usable logical slot covering every WAL record Debezium might request after promotion.

Subsequent production failovers completed without detected LSN gaps or skipped events.

### What PostgreSQL 17 changes

PostgreSQL 17 introduced synchronized failover slots. A logical slot marked for failover can be synchronized from the primary to a standby using PostgreSQL’s native slot-synchronization facilities. The official [PostgreSQL 17 logical replication failover documentation](https://www.postgresql.org/docs/17/logical-replication-failover.html) describes the configuration and readiness checks.

This reduces the need for PostgreSQL 16-era slot-copying approaches, but it does not remove the operational responsibility. Synchronization is asynchronous, and failover readiness must still be verified before promotion.

For PostgreSQL 17 and newer deployments, use the native failover-slot design and its readiness checks instead of copying this PostgreSQL 16 and Patroni 3.3.1 approach.

## Takeaways

1. Treat PostgreSQL’s replication slot and Debezium’s offset as one distributed checkpoint.
2. Prefer replay with idempotent consumers over any possibility of an LSN gap.
3. Make logical-slot continuity part of the database failover design.
4. Distinguish a healthy connector from a proven gap-free recovery.
5. Test promotion with real writes and checkpoint comparisons, not only process-health checks.
6. Scope operational guidance to the PostgreSQL and Patroni versions for which it was validated.

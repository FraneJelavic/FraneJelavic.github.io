+++
title = "About"
description = "About Frane Jelavić and his work with databases, distributed systems, and production infrastructure."
showProfileLinks = true
aliases = ["/elsewhere/"]
+++

I’m Frane Jelavić, a Principal Engineer at Infobip. I design and operate database-heavy distributed systems, with a focus on high availability, change data capture, reliability, and performance. I work with PostgreSQL, MongoDB, Kafka, Debezium, Go, and Java.

Much of my work begins when production systems stop behaving as expected, including replication failures, slow queries, lagging data pipelines, unreliable failover, or database migrations that must remain online. I enjoy tracing those problems through the database, application, and infrastructure until I understand the mechanism.

This site is where I document what I learn and how I reason about operational decisions. Some pieces remain working notes. Others are published by ShiftMag and the Infobip Developers Hub.

## Talks and articles

Selected talks and articles published elsewhere.

### Talks

- [Understanding the Database](https://www.youtube.com/watch?v=E7xBu7ZdP28&t=19085s)\
  DUMP Days · 2023 · Video starts at 5:18:05 (Croatian)

### Articles

- [MongoDB: One write, two logs](https://shiftmag.dev/mongodb-one-write-two-logs-12267/)\
  ShiftMag · 2026\
  Following a write through MongoDB replication and WiredTiger to separate the oplog's role in replication from the journal's role in local crash recovery.

- [How to Survive Database Failover – Debezium and PostgreSQL in Production](https://shiftmag.dev/how-to-survive-database-failover-debezium-and-postgresql-in-production-11676/)\
  ShiftMag · 2026\
  Keeping Debezium streaming safely through PostgreSQL 16 failover by aligning logical replication slots with Kafka Connect offsets.

- [How to automate developer support with Claude and MCP](https://www.infobip.com/developers/blog/ai-developer-support-automation-claude-mcp)\
  Infobip Developers Hub · 2026\
  A look at an AI support system built with Claude and MCP to automate developer-support workflows.

- [Database migration: Developers' open-heart surgery](https://shiftmag.dev/database-migration-developers-open-heart-surgery-1926/)\
  ShiftMag · 2023\
  Migrating a 7 TB PostgreSQL database from AWS Aurora to an on-premises vanilla environment.

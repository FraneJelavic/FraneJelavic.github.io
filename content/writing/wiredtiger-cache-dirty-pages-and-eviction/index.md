+++
title = 'WiredTiger cache: dirty pages and eviction'
date = '2026-09-28T12:00:00+02:00'
lastmod = '2026-09-28T12:00:00+02:00'
draft = true
description = 'How a MongoDB write enters the WiredTiger cache, becomes dirty, and reaches collection and index files.'
categories = ['Databases']
tags = ['MongoDB', 'WiredTiger', 'Storage Engines']
toc = false
socialImage = ''
+++

> **Placeholder.** The article is not written yet. This draft holds the figure the post will teach from: a collection write and a `local.oplog.rs` entry enter the WiredTiger cache as dirty pages, then reach `collection-*.wt` and `index-*.wt` by checkpoint or, past about 20% dirty, by eviction.

{{< wiredtiger-cache >}}

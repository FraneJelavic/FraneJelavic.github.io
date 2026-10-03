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

> **Placeholder.** The article is not written yet. The figure follows one write into dirty cache pages, shows the journal recording it while the table files stay unchanged, then holds checkpoint and eviction side by side. The dirty meter crosses 5%, then 20%.

{{< wiredtiger-cache >}}

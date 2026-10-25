/* Wording, timing, and semantic colors are editable here. Render has no playback state. */
globalThis.animationScene = {
  meta: {
    title: 'WiredTiger cache: dirty pages and eviction',
    duration: 49,
    icons: ['Terminal', 'Server', 'FileText', 'Layers', 'ScrollText', 'ShieldCheck',
      'Check', 'LockKeyhole', 'Cpu', 'HardDrive', 'Clock3', 'CirclePause'],
    checkpoints: [0, 0.07, 0.2, 0.34, 0.48, 0.64, 0.78, 0.94, 1],
    chapters: [
      {start: 0, title: 'The write', caption: 'One write changes collection, index, and oplog pages.'},
      {start: 7, title: 'Dirty pages', caption: 'A dirty page has changes that its table file does not yet contain.'},
      {start: 14, title: 'Journal', caption: 'Journal records support recovery while pages remain dirty.'},
      {start: 21, title: 'Past the target', caption: 'Past 5% dirty, background workers reconcile and evict pages.'},
      {start: 28, title: 'Two endings', caption: 'Checkpoint keeps a clean page. Eviction frees its cache slot.'},
      {start: 35, title: 'Past the trigger', caption: 'Past 20% dirty, application threads help with eviction.'},
      {start: 42, title: 'The limit', caption: 'More workers help when the disk has capacity for more writes.'},
    ],
  },

  render({time, narrow, palette: p, h}) {
    const {element: e, text, icon, group, reveal, progress, connection, pointOn} = h;
    const chapters = globalThis.animationScene.meta.chapters;
    const chapterIndex = chapters.findLastIndex(chapter => time >= chapter.start);
    const chapter = chapters[chapterIndex];
    const t = time - chapter.start;
    const dark = p.background === '#07100b';
    const c = {
      dirty: dark ? '#eda66b' : '#a14b1f', dirtyFill: dark ? '#38271b' : '#f9e9d9',
      clean: p.blue, cleanFill: dark ? '#172f3c' : '#e2f0f6',
      journalFill: dark ? '#16332c' : '#e4f2ec',
      pin: dark ? '#c4aedc' : '#77509b', pinFill: dark ? '#2b2437' : '#f0e9f7',
    };
    const top = narrow ? 100 : 119;
    let body = '';

    function label(value, x, y, size = 16, color = p.ink, extra = {}) {
      return text(value, x, y, {'font-size': size, fill: color, 'text-anchor': 'start', ...extra});
    }
    function lines(values, x, y, size = 15, color = p.muted, spacing = 22) {
      return values.map((value, i) => label(value, x, y + i * spacing, size, color)).join('');
    }
    function box(x, y, w, ht, stroke = p.line, fill = 'url(#panel-fill)', radius = 12) {
      return e('rect', {x, y, width: w, height: ht, rx: radius, fill, stroke, 'stroke-width': 1.4});
    }
    function badge(value, x, y, color = p.green, fill = c.journalFill, w = 90) {
      return box(x, y, w, 25, color, fill, 5) + label(value, x + w / 2, y + 17, 12, color, {'text-anchor': 'middle', 'font-weight': 600});
    }
    function node(name, title, detail, x, y, w, color = p.green) {
      return box(x, y, w, 65) + box(x + 12, y + 13, 32, 32, color, p.tint, 6) +
        icon(name, x + 18, y + 19, 20, color) + label(title, x + 55, y + 28, 17, p.ink, {'font-weight': 600}) +
        label(detail, x + 55, y + 49, 12, p.muted);
    }
    function page(x, y, title, state = 'dirty', w = 108) {
      const color = state === 'clean' ? c.clean : state === 'pinned' ? c.pin : c.dirty;
      const fill = state === 'clean' ? c.cleanFill : state === 'pinned' ? c.pinFill : c.dirtyFill;
      return box(x, y, w, 78, color, fill, 8) + icon('FileText', x + 12, y + 12, 21, color) +
        label(title, x + 12, y + 47, w < 90 ? 12 : 14, p.ink, {'font-weight': 600}) +
        label(state, x + 12, y + 66, 12, color) +
        (state === 'clean' ? icon('Check', x + w - 30, y + 13, 18, color) : '') +
        (state === 'pinned' ? icon('LockKeyhole', x + w - 31, y + 13, 19, color) : '');
    }
    function slot(x, y, w = 108) {
      return e('rect', {x, y, width: w, height: 78, rx: 8, stroke: p.line, 'stroke-dasharray': '5 5', fill: p.background}) +
        label('free slot', x + w / 2, y + 44, 14, p.muted, {'text-anchor': 'middle'});
    }
    function transfer(points, start, end, color, name = 'FileText') {
      let content = connection(points, reveal(t, start - 0.45, start), color);
      if (t >= start && t < end) {
        const [x, y] = pointOn(points, reveal(t, start, end));
        content += group(box(-15, -18, 30, 36, color, p.surface, 5) + icon(name, -10, -12, 20, color), {transform: `translate(${x} ${y})`});
      }
      return content;
    }
    function disk(x, y, w, written = false) {
      const compact = w < 220;
      return box(x, y, w, 80, written ? p.green : p.line) +
        icon('HardDrive', x + 15, y + 15, 25, written ? p.green : p.muted) +
        label(compact ? '.wt files' : '.wt table files', x + 50, y + 28, compact ? 14 : 16, p.ink, {'font-family': 'monospace', 'font-weight': 600}) +
        label(written ? 'reconciled data written' : 'unchanged by this write', x + 15, y + 59, compact ? 12 : 13, written ? p.green : p.muted) +
        (written ? icon('Check', x + w - 33, y + 16, 18, p.green) : '');
    }
    function cache(x, y, w, ht) {
      return box(x, y, w, ht, p.green) + icon('Layers', x + 16, y + 16, 24, p.green) +
        label('WiredTiger cache', x + 50, y + 33, 18, p.ink, {'font-weight': 600}) +
        label('in memory', x + 17, y + 56, 12, p.muted);
    }
    function workers(x, y, active = true) {
      let content = label('Eviction workers · default 4', x, y, 15, active ? p.green : p.muted, {'font-weight': 600});
      for (let i = 0; i < 4; i++) {
        const stroke = active ? p.green : p.line;
        const turn = active && t > 2 && t < 4.8 ? Math.sin((t - 2) * 3 + i) * 8 : 0;
        content += box(x + i * 45, y + 13, 34, 34, stroke, active ? c.journalFill : p.surface, 7) +
          group(icon('Cpu', x + i * 45 + 7, y + 20, 20, active ? p.green : p.muted), {transform: `rotate(${turn} ${x + i * 45 + 17} ${y + 30})`});
      }
      return content;
    }
    function meter(x, y, w, dirty, showTrigger = false) {
      const trackY = y + 36;
      const color = showTrigger && dirty > 20 ? c.dirty : p.green;
      let content = label('Dirty share of configured cache', x, y, narrow ? 13 : 15, p.muted) +
        label(`${Math.round(dirty)}%`, x + w, y + 2, 25, color, {'text-anchor': 'end', 'font-weight': 600}) +
        box(x, trackY, w, 14, p.line, p.background, 4) +
        e('rect', {x, y: trackY, width: w * dirty / 100, height: 14, rx: 4, fill: c.dirty});
      for (const value of [5, 20]) {
        const px = x + w * value / 100;
        content += e('path', {d: `M ${px} ${trackY - 5} V ${trackY + 20}`, stroke: value === 5 ? p.green : c.dirty, 'stroke-width': 2});
      }
      return content + label('5% target', x, trackY + 42, 13, p.green) +
        label('20% trigger', x + w, trackY + 42, 13, c.dirty, {'text-anchor': 'end'}) +
        label('0', x, trackY + 18, 9, p.muted) +
        label('100%', x + w, trackY + 18, 9, p.muted, {'text-anchor': 'end'});
    }

    body += e('defs', {}, e('linearGradient', {id: 'panel-fill', x1: '0', x2: '0', y1: '0', y2: '1'},
      e('stop', {offset: '0%', 'stop-color': p.surface}) + e('stop', {offset: '100%', 'stop-color': p.tint})));

    if (chapterIndex <= 2) {
      const cacheX = narrow ? 26 : 302;
      const cacheY = narrow ? top + 85 : top + 8;
      const cacheW = narrow ? 308 : 392;
      const cacheH = narrow ? 170 : 222;
      const clientX = narrow ? 73 : 42;
      const clientY = narrow ? top : cacheY + 78;
      const clientW = narrow ? 214 : 168;
      const pageW = narrow ? 84 : 108;
      const pageY = cacheY + (narrow ? 69 : 91);
      const pageGap = narrow ? 11 : 14;
      const pageX = cacheX + (narrow ? 17 : 20);
      body += node('Terminal', 'Client write', 'application thread', clientX, clientY, clientW, p.blue);
      body += group(cache(cacheX, cacheY, cacheW, cacheH), {opacity: chapterIndex === 0 ? reveal(t, 0.5, 1.15) : 1});
      const route = narrow ? [[180, clientY + 65], [180, cacheY - 5]] : [[clientX + clientW + 9, clientY + 32], [cacheX - 10, clientY + 32]];
      body += transfer(route, chapterIndex === 0 ? 1.2 : -2, chapterIndex === 0 ? 2.5 : -1, p.blue);
      const dirtyVisible = chapterIndex === 0 ? reveal(t, 2.6, 3.1) : 1;
      body += group(['collection', 'index', 'oplog'].map((name, i) => page(pageX + i * (pageW + pageGap), pageY, name, 'dirty', pageW)).join(''), {opacity: dirtyVisible});
      body += group(label(chapterIndex === 0 ? 'one storage transaction' : chapterIndex === 1 ? 'modified pages stay in memory' : 'dirty pages still cached', cacheX + cacheW / 2, cacheY + cacheH - (narrow ? 8 : 20), 13, chapterIndex === 1 ? c.dirty : p.green, {'text-anchor': 'middle'}), {opacity: dirtyVisible});

      if (chapterIndex === 0) {
        body += group(badge('applied', narrow ? 240 : 586, cacheY + 16, p.green, c.journalFill, 74), {opacity: reveal(t, 3.2, 3.7)});
      } else if (chapterIndex === 1) {
        const dx = narrow ? 43 : 740;
        const dy = narrow ? cacheY + cacheH + 28 : cacheY + 83;
        body += group(disk(dx, dy, narrow ? 274 : 183), {opacity: reveal(t, 2.2, 2.8)});
        if (!narrow) {
          body += group(label('4%', 825, cacheY + 37, 28, c.dirty, {'text-anchor': 'middle', 'font-weight': 600}) +
            label('illustrative dirty share', 825, cacheY + 58, 12, p.muted, {'text-anchor': 'middle'}), {opacity: reveal(t, 3.4, 3.9)});
        }
      } else {
        const dx = narrow ? 26 : 738;
        const dy = narrow ? cacheY + cacheH + 29 : cacheY + 15;
        const dw = narrow ? 308 : 184;
        const landed = t >= 3.1;
        body += group(box(dx, dy, dw, 96, p.green, c.journalFill) +
          icon('ScrollText', dx + 14, dy + 17, 26, p.green) +
          label('journal/', dx + 49, dy + 35, 18, p.green, {'font-family': 'monospace', 'font-weight': 600}) +
          label(landed ? 'recovery record flushed' : 'recovery records', dx + 14, dy + 64, 12, p.muted) +
          (landed ? icon('ShieldCheck', dx + dw - 38, dy + 60, 24, p.green) : ''), {opacity: reveal(t, 0.3, 0.8)});
        const recordRoute = narrow ? [[cacheX + cacheW / 2, cacheY + cacheH + 3], [dx + dw / 2, dy - 3]] : [[cacheX + cacheW + 4, cacheY + 62], [dx - 6, cacheY + 62]];
        body += transfer(recordRoute, 1.1, 3.1, p.green, 'ScrollText');
        if (!narrow) body += group(disk(dx, dy + 118, dw), {opacity: reveal(t, 3.3, 3.8)});
        else body += group(label('Collection and index files stay unchanged.', 180, dy + 120, 13, p.muted, {'text-anchor': 'middle'}), {opacity: reveal(t, 3.3, 3.8)});
      }
    }

    if (chapterIndex === 3 || chapterIndex === 5) {
      const trigger = chapterIndex === 5;
      const mx = narrow ? 30 : 54;
      const my = top + 12;
      const mw = narrow ? 300 : 406;
      const dirty = trigger ? 8 + 19 * reveal(t, 0.5, 2) : 4 + 4 * reveal(t, 0.5, 2);
      const crossed = trigger ? dirty > 20 : dirty > 5;
      body += meter(mx, my, mw, dirty, trigger);
      const wx = narrow ? 30 : 54;
      const wy = my + 122;
      body += workers(wx, wy, crossed || trigger);
      const px = narrow ? 30 : 54;
      const py = wy + 69;
      const pageGone = !trigger && t >= 4.4;
      body += pageGone ? slot(px, py, 97) : page(px, py, 'page', 'dirty', 97);
      const pinnedX = narrow ? 230 : 270;
      body += page(pinnedX, py, 'reader', 'pinned', 97);
      if (trigger) {
        body += group(label('skipped until released', pinnedX + 48, py + 97, 11, c.pin, {'text-anchor': 'middle'}), {opacity: reveal(t, 4, 4.4)});
      } else {
        const dx = narrow ? 146 : 540;
        const dy = narrow ? py : top + 157;
        const dw = narrow ? 70 : 360;
        if (narrow) {
          body += box(dx, dy, dw, 78) + icon('HardDrive', dx + 22, dy + 13, 26, t >= 4.2 ? p.green : p.muted) +
            label('.wt', dx + dw / 2, dy + 63, 14, p.ink, {'text-anchor': 'middle'});
        } else {
          body += disk(dx, dy, dw, t >= 4.2);
          body += node('Server', 'Application threads', 'continue serving reads and writes', dx, top + 10, dw, p.blue);
          body += badge('background work', dx, top + 94, p.green, c.journalFill, 144);
          body += label('A pinned page stays until its reader releases it.', dx, dy + 112, 14, c.pin);
        }
        const points = narrow ? [[px + 100, py + 39], [dx - 6, py + 39]] :
          [[px + 101, py + 39], [195, py + 39], [195, py + 107], [470, py + 107], [470, dy + 40], [dx - 10, dy + 40]];
        body += transfer(points, 2.8, 4.2, p.green);
        if (narrow) body += label('Pinned reader: skipped', 180, py + 106, 13, c.pin, {'text-anchor': 'middle'});
      }
      if (trigger) {
        const ax = narrow ? 30 : 540;
        const ay = narrow ? py + 123 : top + 13;
        const aw = narrow ? 300 : 360;
        body += node('Server', 'Application threads', crossed && t > 2.8 ? 'help with eviction before continuing' : 'serving reads and writes', ax, ay, aw, crossed ? c.dirty : p.blue);
        const joinPoints = narrow ? [[180, ay - 6], [180, wy + 53]] : [[ax - 9, ay + 32], [497, ay + 32], [497, wy + 32], [wx + 189, wy + 32]];
        body += group(transfer(joinPoints, 2.3, 3.6, c.dirty, 'Cpu'), {opacity: crossed ? 1 : 0});
        if (!narrow) body += group(disk(ax, ay + 145, aw, true), {opacity: reveal(t, 3.5, 3.9)});
        body += group(icon('CirclePause', ax + 4, ay + (narrow ? 75 : 89), 21, c.dirty) +
          label('client waits for its thread', ax + 35, ay + (narrow ? 91 : 105), narrow ? 15 : 18, c.dirty, {'font-weight': 600}), {opacity: reveal(t, 3.7, 4.2)});
      }
    }

    if (chapterIndex === 4) {
      const cards = narrow ? [
        {x: 25, y: top, w: 310, ht: 168, title: 'Checkpoint', keep: true},
        {x: 25, y: top + 190, w: 310, ht: 168, title: 'Eviction', keep: false},
      ] : [
        {x: 44, y: top, w: 416, ht: 290, title: 'Checkpoint', keep: true},
        {x: 500, y: top, w: 416, ht: 290, title: 'Eviction', keep: false},
      ];
      for (const {x, y, w, ht, title, keep} of cards) {
        const landed = t >= 3.4;
        let content = box(x, y, w, ht, keep ? p.blue : p.green) +
          icon(keep ? 'Clock3' : 'Cpu', x + 16, y + 17, 24, keep ? p.blue : p.green) +
          label(title, x + 52, y + 36, 22, p.ink, {'font-weight': 600});
        const pageX = x + (narrow ? 15 : 25);
        const pageY = y + (narrow ? 62 : 82);
        content += !keep && t >= 4.2 ? slot(pageX, pageY, narrow ? 91 : 124) :
          page(pageX, pageY, 'page', landed && keep ? 'clean' : 'dirty', narrow ? 91 : 124);
        const fileX = x + (narrow ? 212 : 256);
        const fileY = pageY + 7;
        content += box(fileX, fileY, narrow ? 82 : 130, 63, landed ? p.green : p.line) +
          icon('HardDrive', fileX + 12, fileY + 10, 23, landed ? p.green : p.muted) + label('.wt file', fileX + 10, fileY + 49, 13, p.ink);
        content += transfer([[pageX + (narrow ? 96 : 129), pageY + 37], [fileX - 6, pageY + 37]], 1.3, 3.4, p.green);
        content += group(label('reconcile', x + (narrow ? 158 : 204), pageY + 19, 12, p.green, {'text-anchor': 'middle'}), {opacity: reveal(t, 0.5, 1)});
        if (!narrow) {
          content += group(badge(keep ? 'clean, still cached' : 'memory freed', x + 26, y + 195, keep ? p.blue : p.green, keep ? c.cleanFill : c.journalFill, 161), {opacity: reveal(t, 4.2, 4.6)});
          content += lines(keep ? ['Periodic consistent snapshot.', 'This page stays in memory.'] : ['Write the dirty page, then remove it.', 'The slot can hold another page.'], x + 26, y + 246);
        } else {
          content += group(label(keep ? 'clean, still cached' : 'memory freed', x + 16, y + ht - 10, 13, keep ? p.blue : p.green), {opacity: reveal(t, 4.2, 4.6)});
        }
        body += group(content, {opacity: reveal(t, keep ? 0 : 0.25, keep ? 0.4 : 0.65)});
      }
    }

    if (chapterIndex === 6) {
      const rows = narrow ? [
        {x: 25, y: top, w: 310, ht: 171, helps: false},
        {x: 25, y: top + 193, w: 310, ht: 171, helps: true},
      ] : [
        {x: 44, y: top, w: 416, ht: 288, helps: false},
        {x: 500, y: top, w: 416, ht: 288, helps: true},
      ];
      for (const {x, y, w, ht, helps} of rows) {
        const color = helps ? p.green : c.dirty;
        const wy = y + (narrow ? 49 : 92);
        const dx = x + w - (narrow ? 65 : 96);
        const dy = wy + 6;
        let content = box(x, y, w, ht, color) + label(helps ? 'Workers are busy' : 'Disk is saturated', x + 17, y + 32, narrow ? 19 : 24, p.ink, {'font-weight': 600});
        for (let i = 0; i < 4; i++) {
          const xx = x + 19 + (i % 2) * 40;
          const yy = wy + Math.floor(i / 2) * 36;
          content += box(xx, yy, 29, 29, color, helps ? c.journalFill : c.dirtyFill, 5) + icon('Cpu', xx + 5, yy + 5, 19, color);
        }
        for (let i = 0; i < 2; i++) {
          const xx = x + 99, yy = wy + i * 36;
          content += group(box(xx, yy, 29, 29, color, helps ? c.journalFill : c.dirtyFill, 5) +
            icon('Cpu', xx + 5, yy + 5, 19, color), {opacity: reveal(t, 0.7, 1.3)});
        }
        content += box(dx, dy, narrow ? 47 : 64, 61, color, helps ? c.journalFill : c.dirtyFill, 7) +
          icon('HardDrive', dx + (narrow ? 10 : 18), dy + 10, 28, color) + label('disk', dx + (narrow ? 24 : 32), dy + 50, 12, color, {'text-anchor': 'middle'});
        const route = [[x + 147, wy + 34], [dx - 7, wy + 34]];
        content += connection(route, reveal(t, 0.5, 1), color);
        for (let i = 0; i < 3; i++) {
          const phase = helps ? progress(t, 1 + i * 0.85, 2.1 + i * 0.85) : 0.13 + i * 0.18;
          if (helps && (phase === 0 || phase === 1)) continue;
          if (!helps && t < 1.2 + i * 0.35) continue;
          const [xx, yy] = pointOn(route, phase);
          content += box(xx - 8, yy - 10, 16, 20, color, p.surface, 3);
        }
        content += group(badge(helps ? 'extra workers help' : 'extra workers wait', x + 18, y + ht - (narrow ? 36 : 79), color, helps ? c.journalFill : c.dirtyFill, 170), {opacity: reveal(t, 3.5, 4)});
        if (!narrow) content += label(helps ? 'Disk has capacity for more writes.' : 'The same I/O bottleneck remains.', x + 18, y + ht - 24, 15, p.muted);
        body += group(content, {opacity: reveal(t, helps ? 0.35 : 0, helps ? 0.8 : 0.45)});
      }
    }

    return {body, caption: chapter.caption, title: chapter.title, step: chapterIndex + 1};
  },
};

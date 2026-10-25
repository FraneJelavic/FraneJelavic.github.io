/* Shared deterministic SVG renderer: browser preview and frame export use this file. */
globalThis.animationRuntime = (() => {
  const palettes = {
    light: { background: '#f5f8f5', surface: '#ffffff', ink: '#1e3027', muted: '#52675b', line: '#becdc3', blue: '#286780', violet: '#77509b', green: '#286957', tint: '#eaf0ec' },
    dark: { background: '#07100b', surface: '#1b2c22', ink: '#e3ebe6', muted: '#a3b4ab', line: '#34483a', blue: '#9dd2e3', violet: '#c4aedc', green: '#a1d3c5', tint: '#101b14' }
  };
  const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const attrs = object => Object.entries(object).filter(([,v]) => v !== undefined).map(([k,v]) => `${k}="${esc(v)}"`).join(' ');
  const element = (tag, attributes = {}, content = '') => `<${tag} ${attrs(attributes)}>${content}</${tag}>`;
  const clamp = x => Math.max(0, Math.min(1, x));
  const progress = (t, start, end) => clamp((t - start) / (end - start));
  const smooth = x => { x = clamp(x); return x*x*(3-2*x); };
  const reveal = (t, start, end) => smooth(progress(t, start, end));
  function text(value, x, y, options = {}) {
    return element('text', { x, y, 'font-size': 16, 'text-anchor': 'middle', ...options }, esc(value));
  }
  function icon(definitions, name, x, y, size = 32, color = 'currentColor', extra = {}) {
    if (!definitions[name]) throw new Error(`Missing icon: ${name}. Add it to scene.meta.icons and rebuild.`);
    return element('g', { transform: `translate(${x} ${y}) scale(${size/24})`, fill: 'none', stroke: color, 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra },
      definitions[name].map(([tag, attributes]) => element(tag, attributes)).join(''));
  }
  function pointOn(points, fraction) {
    const lengths = points.slice(1).map((p,i) => Math.hypot(p[0]-points[i][0], p[1]-points[i][1]));
    let remaining = lengths.reduce((a,b) => a+b, 0) * clamp(fraction);
    for (let i=0; i<lengths.length; i++) {
      if (remaining <= lengths[i] || i === lengths.length-1) {
        const r = lengths[i] ? clamp(remaining/lengths[i]) : 1;
        return [points[i][0] + (points[i+1][0]-points[i][0])*r, points[i][1] + (points[i+1][1]-points[i][1])*r];
      }
      remaining -= lengths[i];
    }
    return points[0];
  }
  function connection(points, fraction, color, dashed = false) {
    const p = clamp(fraction);
    if (!p) return '';
    const lengths = points.slice(1).map((v,i) => Math.hypot(v[0]-points[i][0],v[1]-points[i][1]));
    const total = lengths.reduce((a,b) => a+b,0);
    let spent = 0, d = `M ${points[0].join(' ')}`;
    for (let i=0; i<lengths.length; i++) {
      if (spent+lengths[i] < total*p) { d += ` L ${points[i+1].join(' ')}`; spent += lengths[i]; }
      else { d += ` L ${pointOn(points,p).join(' ')}`; break; }
    }
    const end = pointOn(points,p), before = pointOn(points,Math.max(0,p-0.02));
    const angle = Math.atan2(end[1]-before[1],end[0]-before[0])*180/Math.PI;
    return element('path', { d, fill:'none', stroke:color, 'stroke-width':2, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'stroke-dasharray':dashed?'5 7':undefined }) +
      element('path', { d:'M -7 -4 L 0 0 L -7 4', transform:`translate(${end.join(' ')}) rotate(${angle})`, fill:'none', stroke:color, 'stroke-width':2, 'stroke-linecap':'round', 'stroke-linejoin':'round' });
  }
  function render(scene, {time=0, width=960, height=540, theme='light', icons={}} = {}) {
    const p = palettes[theme];
    if (!p) throw new Error(`Unknown theme: ${theme}`);
    const narrow = width < 560 || width/height < 1.2;
    const w = narrow ? 360 : 960, h = height/width*w;
    const duration = scene.meta.duration;
    const t = Math.max(0,Math.min(duration,time));
    const helpers = { esc, attrs, element, text, clamp, progress, smooth, reveal, pointOn, connection,
      icon:(...args) => icon(icons,...args), group:(content,attributes={}) => element('g',attributes,content) };
    const frame = scene.render({ time:t, duration, width:w, height:h, narrow, palette:p, h:helpers });
    if (!frame || typeof frame.body !== 'string' || typeof frame.caption !== 'string') throw new Error('scene.render must return {body, caption} strings');
    const description = `${scene.meta.title}. ${frame.caption}`;
    const margin = narrow ? 25 : 40;
    const captionWords = frame.caption.split(' '), captionLines = [];
    let line = '';
    for (const word of captionWords) {
      if (line && (line + ' ' + word).length > (narrow ? 37 : 85)) {
        captionLines.push(line); line = word;
      } else line += (line ? ' ' : '') + word;
    }
    if (line) captionLines.push(line);
    const caption = captionLines.map((value, i) => text(value, w/2, h - 68 - (captionLines.length - 1 - i)*23, {'font-size': narrow ? 16 : 20})).join('');
    const chapters = scene.meta.chapters;
    const gap = 7, segment = (w - margin*2 - gap*(chapters.length-1))/chapters.length;
    const timeline = chapters.map((chapter, i) => {
      const x = margin + i*(segment+gap), fraction = progress(t, chapter.start, chapters[i+1]?.start ?? duration);
      return element('path', {d:`M ${x} ${h-22} h ${segment}`,stroke:p.line,'stroke-width':3}) +
        (fraction ? element('path', {d:`M ${x} ${h-22} h ${segment*fraction}`,stroke:i<3?p.blue:p.green,'stroke-width':3}) : '');
    }).join('');
    const header = text(frame.title, margin, narrow?56:72, {'text-anchor':'start','font-size':narrow?28:36,'font-weight':600}) +
      text(`${String(frame.step).padStart(2,'0')} / ${String(chapters.length).padStart(2,'0')}`,w-margin,narrow?23:42,{'text-anchor':'end','font-family':'monospace','font-size':11,fill:p.muted}) +
      element('path', {d:`M ${margin} ${narrow?77:98} H ${w-margin}`,stroke:p.line,'stroke-width':1});
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="animation-title animation-desc"><title id="animation-title">${esc(scene.meta.title)}</title><desc id="animation-desc">${esc(description)}</desc><rect width="${w}" height="${h}" fill="${p.background}"/><g font-family="Arial, sans-serif" fill="${p.ink}">${header}${frame.body}${caption}${timeline}</g></svg>`;
    return {svg, caption:frame.caption};
  }
  return {render,palettes};
})();

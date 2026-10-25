#!/usr/bin/env node
/* No global installs, network calls, or publication. Run `help` for commands. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const skill = path.resolve(__dirname,'..');
const help = `Usage: node animate.cjs COMMAND PROJECT [options]
  doctor DIR     Report dependencies without installing or writing files
  init DIR       Copy the editable starter into a NEW directory
  check DIR      Check metadata, deterministic frames and icon names
  build DIR      Build standalone index.html (replaces generated HTML)
  render DIR     Render one PNG or SVG; --out FILE --time SECONDS
  export DIR     Render and encode MP4; --out FILE
  verify FILE    Validate silent H.264 MP4 and fully decode with FFmpeg
Options: --width 1600 --height 900 --theme light|dark --fps 30
         --ffmpeg EXECUTABLE (default: FFMPEG_PATH or ffmpeg)
verify accepts --width, --height, --fps, --duration as expected values.
build also accepts --theme to set the player's initial theme.
Dependencies resolve normally, from PROJECT/.tools/node_modules, or
from ANIMATION_NODE_MODULES. See references/tooling.md for setup.`;

function fail(message) { throw new Error(message); }
function dependency(name, project) {
  const candidates = [() => require(name), () => require(path.join(project,'.tools','node_modules',name))];
  if(process.env.ANIMATION_NODE_MODULES)candidates.push(() => require(path.join(process.env.ANIMATION_NODE_MODULES,name)));
  for(const candidate of candidates){try{return candidate();}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}
  fail(`Missing dependency '${name}'. Install the pinned scripts/package.json dependencies into the project's .tools directory, or set ANIMATION_NODE_MODULES to an existing node_modules directory. No installation was attempted.`);
}
function load(project) {
  const files = ['runtime.js','scene.js'];
  const source = Object.fromEntries(files.map(name=>[name,fs.readFileSync(path.join(project,name),'utf8')]));
  const context = vm.createContext({});
  // This executes authored scene code; it is a rendering convenience, not an untrusted-code sandbox.
  for(const name of files)vm.runInContext(source[name],context,{filename:name,timeout:5000});
  const scene=context.animationScene, runtime=context.animationRuntime;
  if(!scene || typeof scene.render!=='function' || !runtime || typeof runtime.render!=='function')fail('Expected animationScene.render and animationRuntime.render.');
  const m=scene.meta;
  if(!m || typeof m.title!=='string' || !m.title.trim() || !Number.isFinite(m.duration) || m.duration<=0)fail('scene.meta needs a nonempty title and a positive duration in seconds.');
  if(!Array.isArray(m.icons) || m.icons.some(x=>typeof x!=='string'))fail('scene.meta.icons must be an array of Lucide export names.');
  if(m.checkpoints!==undefined && (!Array.isArray(m.checkpoints) || m.checkpoints.some(x=>!Number.isFinite(x)||x<0||x>1)))fail('checkpoints must be fractions between 0 and 1.');
  const library=dependency('lucide',project).icons, icons={};
  for(const name of m.icons){if(!library[name])fail(`Unknown Lucide icon '${name}'. Choose an actual export from the installed package.`);icons[name]=library[name];}
  function render(options){
    context.renderOptions={...options,icons};
    const result=vm.runInContext('animationRuntime.render(animationScene, renderOptions)',context,{timeout:5000});
    if(/(?:NaN|Infinity)/.test(result.svg))fail('Frame contains a non-finite SVG value.');
    return result;
  }
  return {source,scene,render};
}
function parse(argv){
  const [command,location,...rest]=argv, options={};
  const allowed=new Set(['out','time','width','height','theme','fps','ffmpeg','duration']);
  for(let i=0;i<rest.length;i+=2){
    const key=rest[i].replace(/^--/,'');
    if(!rest[i].startsWith('--')||!allowed.has(key)||rest[i+1]===undefined)fail(`Invalid option: ${rest[i]}`);
    options[key]=rest[i+1];
  }
  const commandOptions={doctor:['ffmpeg'],init:[],check:[],build:['theme'],render:['out','time','width','height','theme'],export:['out','width','height','theme','fps','ffmpeg'],verify:['width','height','fps','duration','ffmpeg']};
  if(commandOptions[command])for(const key of Object.keys(options))if(!commandOptions[command].includes(key))fail(`--${key} is not supported by ${command}.`);
  if(options.theme && !['light','dark'].includes(options.theme))fail('Theme must be light or dark.');
  return {command,location:location?path.resolve(location):null,options};
}
function number(options,key,fallback,{integer=false,min=0}={}){
  const value=options[key]===undefined?fallback:Number(options[key]);
  if(!Number.isFinite(value)||value<min||(integer&&!Number.isInteger(value)))fail(`Invalid --${key}: ${options[key]}`);
  return value;
}
function dimensions(options,defaults={width:1600,height:900}){
  return {width:number(options,'width',defaults.width,{integer:true,min:1}),height:number(options,'height',defaults.height,{integer:true,min:1})};
}
function noOverwrite(file){if(fs.existsSync(file))fail(`Output already exists: ${file}. Choose a new output path.`);fs.mkdirSync(path.dirname(file),{recursive:true});}
function hash(s){return crypto.createHash('sha256').update(s).digest('hex');}
function ffmpegPath(options){return options.ffmpeg||process.env.FFMPEG_PATH||'ffmpeg';}
function run(executable,args){
  const result=spawnSync(executable,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.error)fail(`Cannot execute FFmpeg: ${result.error.message}. Set FFMPEG_PATH or --ffmpeg.`);
  if(result.status!==0)fail(`FFmpeg failed (${result.status}):\n${result.stderr}`);
  return result;
}
function doctor(project,ffmpeg){
  const checks=[];
  function inspect(name,check){
    try{checks.push({name,available:true,detail:check()});}
    catch(error){checks.push({name,available:false,detail:error.message});}
  }
  inspect('Node.js',()=>{if(Number(process.versions.node.split('.')[0])<20)fail('Node.js 20 or newer is required.');return process.versions.node;});
  inspect('Lucide',()=>{if(!dependency('lucide',project).icons)fail('Lucide icon definitions are unavailable.');return 'Icon definitions available';});
  inspect('Sharp',()=>{if(typeof dependency('sharp',project)!=='function')fail('Sharp renderer is unavailable.');return 'PNG renderer available';});
  inspect('FFmpeg',()=>{const result=run(ffmpeg,['-hide_banner','-encoders']);if(!result.stdout.includes('libx264'))fail('FFmpeg is available but has no libx264 encoder.');return 'FFmpeg with libx264 available';});
  return {ready:checks.every(check=>check.available),checks,installsAttempted:false};
}
function verify(file,ffmpeg,expected){
  const info=spawnSync(ffmpeg,['-hide_banner','-i',file],{encoding:'utf8',maxBuffer:1024*1024});
  if(info.error)fail(`Cannot execute FFmpeg: ${info.error.message}`);
  const stderr=info.stderr||'';
  const durationMatch=stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  const streams=stderr.split('\n').filter(line=>/Stream.*(?:Video|Audio):/.test(line));
  const videos=streams.filter(line=>/Video:/.test(line)), audioStreams=streams.filter(line=>/Audio:/.test(line)).length;
  if(!durationMatch||videos.length!==1)fail(`Expected exactly one readable video stream:\n${stderr}`);
  const video=videos[0];
  if(!/Video: h264\b/.test(video)||!video.includes('yuv420p'))fail('Expected H.264 with yuv420p pixel format.');
  if(audioStreams!==0)fail('Expected a silent video with no audio streams. The bundled helper exports silent MP4 only.');
  const size=video.match(/\b(\d{2,})x(\d{2,})\b/), rate=video.match(/([\d.]+) fps/);
  if(!size||!rate)fail(`Could not read dimensions or frame rate: ${video}`);
  const metadata={width:Number(size[1]),height:Number(size[2]),fps:Number(rate[1]),duration:Number(durationMatch[1])*3600+Number(durationMatch[2])*60+Number(durationMatch[3])};
  if(expected){
    const mismatch=['width','height'].some(key=>expected[key]!==undefined&&metadata[key]!==expected[key])||
      (expected.fps!==undefined&&Math.abs(metadata.fps-expected.fps)>0.02)||
      (expected.duration!==undefined&&Math.abs(metadata.duration-expected.duration)>1/(expected.fps||metadata.fps)+0.02);
    if(mismatch)fail(`Video metadata does not match expected settings: ${JSON.stringify({expected,measured:metadata})}`);
  }
  const decoded=run(ffmpeg,['-v','error','-xerror','-i',file,'-map','0:v:0','-progress','pipe:1','-nostats','-f','null','-']);
  const counts=Array.from(decoded.stdout.matchAll(/^frame=(\d+)$/gm));
  const decodedFrames=counts.length?Number(counts[counts.length-1][1]):0;
  if(!decodedFrames)fail('Full decode produced no video frames.');
  if(expected&&expected.frames!==undefined&&decodedFrames!==expected.frames)fail(`Expected ${expected.frames} decoded frames, received ${decodedFrames}.`);
  return {...metadata,codec:'h264',pixelFormat:'yuv420p',audioStreams,silent:true,decodedFrames,fullDecode:true};
}
async function main(){
  const {command,location:project,options}=parse(process.argv.slice(2));
  if(!command||command==='help'||command==='--help'){console.log(help);return;}
  if(!project)fail('Specify a project directory (or video file for verify).');
  if(command==='doctor'){const report=doctor(project,ffmpegPath(options));console.log(JSON.stringify(report,null,2));if(!report.ready)process.exitCode=1;return;}
  if(command==='init'){
    if(Object.keys(options).length)fail('init accepts only a new directory.');
    if(fs.existsSync(project))fail('Starter destination already exists; use a new directory to preserve existing work.');
    if(!fs.existsSync(path.join(skill,'assets','starter','scene.js')))fail('init requires the installed skill scaffold. Existing source can use doctor/check/build/render/export/verify directly.');
    fs.mkdirSync(project,{recursive:true});
    fs.mkdirSync(path.join(project,'.tools'));
    fs.copyFileSync(__filename,path.join(project,'.tools','animate.cjs'));
    fs.copyFileSync(path.join(__dirname,'package.json'),path.join(project,'.tools','package.json'));
    for(const name of ['runtime.js','scene.js','player.html','README.md'])fs.copyFileSync(path.join(skill,'assets','starter',name),path.join(project,name));
    console.log(`Starter created: ${project}\nEdit scene.js, then run check and build.`);return;
  }
  if(command==='verify'){
    const expected={};
    for(const key of ['width','height','fps','duration'])if(options[key]!==undefined)expected[key]=number(options,key,undefined,{integer:key!=='duration',min:key==='duration'?0.001:1});
    console.log(JSON.stringify(verify(project,ffmpegPath(options),expected),null,2));return;
  }
  if(!['check','build','render','export'].includes(command))fail(`Unknown command: ${command}`);
  const loaded=load(project), {scene,source,render}=loaded;
  const theme=options.theme||'light';
  if(command==='check'){
    let checks=0;
    for(const [width,height] of [[960,540],[360,700],[1600,900],[900,1600]]){
      for(const palette of ['light','dark']){
        for(const fraction of scene.meta.checkpoints||[0,0.2,0.5,0.8,1]){
          const settings={time:fraction*scene.meta.duration,width,height,theme:palette};
          const a=render(settings).svg,b=render(settings).svg;
          if(a!==b)fail(`Frame is not deterministic at t=${settings.time}`);
          checks++;
        }
      }
    }
    console.log(`Passed ${checks} deterministic frame checks, both themes, four sizes. Visual and browser QA are separate.`);return;
  }
  if(command==='build'){
    const library=dependency('lucide',project).icons;
    const definitions=Object.fromEntries(scene.meta.icons.map(name=>[name,library[name]]));
    const safe=s=>s.replace(/<\/script/gi,'<\\/script');
    let license;
    try{license=fs.readFileSync(require.resolve('lucide/LICENSE',{paths:[__dirname,path.join(project,'.tools'),...(process.env.ANIMATION_NODE_MODULES?[path.dirname(process.env.ANIMATION_NODE_MODULES)]:[])]}),'utf8');}
    catch{fail('Cannot locate lucide/LICENSE. Use a complete installed package so the icon notice can be retained.');}
    let html=fs.readFileSync(path.join(project,'player.html'),'utf8');
    for(const [token,value] of [['/*__RUNTIME__*/',safe(source['runtime.js'])],['/*__SCENE__*/',safe(source['scene.js'])],['/*__ICONS__*/',safe(JSON.stringify(definitions))],['<!--__LICENSE__-->',`<!-- Lucide icon license\n${license.replaceAll('--','—')}\n-->`]]){
      if(!html.includes(token))fail(`Player template is missing ${token}`);
      html=html.replace(token,()=>value);
    }
    html=html.replace('data-theme="light"',`data-theme="${theme}"`).replace('<option value="'+theme+'">','<option selected value="'+theme+'">');
    const output=path.join(project,'index.html');fs.writeFileSync(output,html);console.log(`Built ${output}`);return;
  }
  const {width,height}=dimensions(options);
  if(command==='render'){
    if(!options.out)fail('render requires --out frame.png or frame.svg');
    const output=path.resolve(options.out), time=number(options,'time',0);
    if(time>scene.meta.duration)fail('--time exceeds scene duration.');
    if(!['.svg','.png'].includes(path.extname(output).toLowerCase()))fail('render output must end in .png or .svg');
    noOverwrite(output);const svg=render({time,width,height,theme}).svg;
    if(output.toLowerCase().endsWith('.svg'))fs.writeFileSync(output,svg);else await dependency('sharp',project)(Buffer.from(svg)).png().toFile(output);
    console.log(`Rendered ${output}`);return;
  }
  if(!options.out||!options.out.toLowerCase().endsWith('.mp4'))fail('export requires --out animation.mp4');
  const output=path.resolve(options.out), manifestFile=output+'.manifest.json';
  noOverwrite(output);noOverwrite(manifestFile);
  if(width%2||height%2)fail('H.264 export requires even width and height.');
  const sharp=dependency('sharp',project);
  const fps=number(options,'fps',30,{integer:true,min:1}), frames=Math.ceil(scene.meta.duration*fps), ffmpeg=ffmpegPath(options);
  run(ffmpeg,['-version']);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'illustrated-animation-'));
  let encoded=false;
  try{
    for(let base=0;base<frames;base+=6){
      const jobs=[];
      for(let i=base;i<Math.min(base+6,frames);i++){
        // Include the exact final state while encoding the expected number of frames.
        const time=frames===1?0:scene.meta.duration*i/(frames-1);
        const svg=render({time,width,height,theme}).svg;
        jobs.push(sharp(Buffer.from(svg)).png().toFile(path.join(temp,`frame-${String(i).padStart(6,'0')}.png`)));
      }
      await Promise.all(jobs);
      if(base%120===0||base+6>=frames)console.log(`Rendered ${Math.min(base+6,frames)} / ${frames} frames`);
    }
    run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-framerate',String(fps),'-i',path.join(temp,'frame-%06d.png'),'-frames:v',String(frames),'-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output]);
    encoded=true;
    const validation=verify(output,ffmpeg,{width,height,fps,duration:frames/fps,frames});
    const manifest={title:scene.meta.title,videoSha256:hash(fs.readFileSync(output)),sceneSha256:hash(source['scene.js']),runtimeSha256:hash(source['runtime.js']),theme,width,height,fps,frames,storyDurationSeconds:scene.meta.duration,encodedDurationSeconds:frames/fps,icons:Array.from(scene.meta.icons),validation};
    fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
    console.log(`Exported and fully decoded ${output}\nManifest: ${manifestFile}`);
  }catch(error){
    if(encoded)console.error('Video exists but verification did not complete. Do not describe it as validated.');
    throw error;
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

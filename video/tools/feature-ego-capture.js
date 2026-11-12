// Run inside ONE Ego invocation: ego-browser nodejs < /absolute/path/ego-screencast.js
// Edit CONFIG and perform all desired page actions in performActions(), below.
// Do not run a second Ego invocation against this page while recording: device
// emulation and CDP screencast are session-scoped. Never record private content.
// Requires existing ffmpeg/ffprobe; no extra packages. Output is silent VFR.
const CONFIG = {
  spaceId: 71, pageLabel: 'p1',
  width: 1920, height: 1080, deviceScaleFactor: 1,
  maxDurationMs: 16000, quality: 95,
  output: '/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/capture/features/features-norse-master.mkv',
  scratchRoot: '/Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/capture/features',
  ffmpeg: '/opt/homebrew/bin/ffmpeg', ffprobe: '/opt/homebrew/bin/ffprobe',
};

async function performActions(page) {
  await page.evaluate(() => window.replay());
  await new Promise(r => setTimeout(r, 12800));
}

const fs = await import('node:fs/promises');
const path = await import('node:path');
const { spawn } = await import('node:child_process');
const { performance } = await import('node:perf_hooks');
const { setTimeout: sleep } = await import('node:timers/promises');
function run(exe, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    child.stdout.on('data', x => { out += x; });
    child.stderr.on('data', x => { err += x; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${exe} exit ${code}: ${err.slice(-4000)}`)));
  });
}
function jpegSize(b) {
  if (b[0] !== 255 || b[1] !== 216) throw Error('Not JPEG');
  for (let i = 2; i + 8 < b.length;) {
    if (b[i++] !== 255) throw Error('Invalid JPEG marker');
    while (b[i] === 255) i++;
    const marker = b[i++];
    if (marker === 216 || marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const len = b.readUInt16BE(i);
    if (len < 2 || i + len > b.length) throw Error('Invalid JPEG segment');
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) return {height: b.readUInt16BE(i+3), width: b.readUInt16BE(i+5)};
    i += len;
  }
  throw Error('No JPEG dimensions');
}
if (!Number.isSafeInteger(CONFIG.spaceId) || CONFIG.spaceId <= 0 || !/^p\d+$/.test(CONFIG.pageLabel)) throw Error('Set an existing numeric spaceId and pageLabel');
if (!path.isAbsolute(CONFIG.output) || !path.isAbsolute(CONFIG.scratchRoot)) throw Error('Use absolute paths');
if (CONFIG.maxDurationMs < 1000 || CONFIG.maxDurationMs > 120000) throw Error('maxDurationMs must be 1000..120000');
try { await fs.access(CONFIG.output); throw Error('Output already exists: refusing overwrite'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const dir = await fs.mkdtemp(path.join(CONFIG.scratchRoot, 'ego-screencast-'));
const page = (await taskSpace(CONFIG.spaceId)).page(CONFIG.pageLabel);
await page.goto("file:///Users/haruka/.hermes/profiles/shirogane-yuine/workspace/hermes-session-crew-demo/video/feature-demo/index.html");
let started = false, override = false, actionsDone = false, actionsError = null;
const frames = []; let firstTime, previousTime = -Infinity, eventCount = 0;
let startMono, endMono;
try {
  await page.cdp('Emulation.setDeviceMetricsOverride', {width: CONFIG.width, height: CONFIG.height, deviceScaleFactor: CONFIG.deviceScaleFactor, mobile: false});
  override = true;
  await page.waitForSelector('[data-working-bubble]');
  // Allow the compositor to settle after viewport resize before subscribing.
  await page.screenshot({path: path.join(dir, 'viewport-preflight.png')});
  await sleep(300);
  await page.cdp('Page.startScreencast', {format: 'jpeg', quality: CONFIG.quality, maxWidth: CONFIG.width * CONFIG.deviceScaleFactor, maxHeight: CONFIG.height * CONFIG.deviceScaleFactor, everyNthFrame: 1});
  started = true;
  startMono = performance.now();
  console.log('RECORDING: performActions runs in this same Ego invocation; output is silent.');
  // Capture loop and actions share this Page/CDP session. Callbacks must finish.
  const actionPromise = Promise.resolve().then(() => performActions(page)).catch(e => { actionsError = e; }).finally(() => { actionsDone = true; });
  const deadline = startMono + CONFIG.maxDurationMs;
  while (performance.now() < deadline && !actionsDone) {
    const events = await page.events();
    for (const event of events) {
      if (event.method !== 'Page.screencastFrame') continue;
      eventCount++;
      const p = event.params;
      if (!p || !Number.isInteger(p.sessionId) || typeof p.data !== 'string') throw Error('Unexpected screencast event format');
      // Ack before disk I/O to avoid blocking Chromium's next frame.
      await page.cdp('Page.screencastFrameAck', {sessionId: p.sessionId});
      const bytes = Buffer.from(p.data, 'base64');
      const size = jpegSize(bytes);
      if (size.width < CONFIG.width || size.height < CONFIG.height) throw Error(`Source ${size.width}x${size.height} below ${CONFIG.width}x${CONFIG.height}; not upscaling`);
      const stamp = p.metadata?.timestamp;
      if (!Number.isFinite(stamp) || stamp <= previousTime) throw Error('Missing/nonmonotonic Chromium frame timestamp; refusing fabricated timing');
      previousTime = stamp; firstTime ??= stamp;
      const filename = `${String(frames.length).padStart(6, '0')}.jpg`;
      await fs.writeFile(path.join(dir, filename), bytes, {flag: 'wx'});
      frames.push({filename, timestamp: stamp, ...size});
    }
    await sleep(5);
  }
  endMono = performance.now();
  if (!actionsDone) throw Error('Action exceeded recording deadline; avoid late side effects and use bounded actions');
  await actionPromise;
  if (actionsError) throw actionsError;
} finally {
  if (started) await page.cdp('Page.stopScreencast').catch(e => console.error('stopScreencast failed:', e.message));
  if (override) await page.cdp('Emulation.clearDeviceMetricsOverride').catch(e => console.error('clearDeviceMetricsOverride failed:', e.message));
}
if (frames.length < 2) throw Error(`Only ${frames.length} frames received. Unencoded captures retained at ${dir}; Page.events() event forwarding may not support screencast.`);
// Chromium emits frames on visual change, not a guaranteed constant frame rate.
// Preserve frame timestamps; the final image holds until capture ended.
const wallSeconds = Math.max(0, (endMono - startMono) / 1000);
const lastTime = frames.at(-1).timestamp - firstTime;
const finalHold = Math.max(0.001, wallSeconds - lastTime);
let concat = 'ffconcat version 1.0\n';
for (let i = 0; i < frames.length; i++) {
  concat += `file '${frames[i].filename}'\noption framerate 1000\nduration ${i + 1 < frames.length ? (frames[i+1].timestamp - frames[i].timestamp).toFixed(6) : finalHold.toFixed(6)}\n`;
}
concat += `file '${frames.at(-1).filename}'\noption framerate 1000\n`;
const manifest = path.join(dir, 'frames.ffconcat');
await fs.writeFile(manifest, concat, {flag: 'wx'});
await run(CONFIG.ffmpeg, ['-hide_banner','-loglevel','error','-n','-f','concat','-safe','0','-i',manifest,'-fps_mode','vfr','-c:v','libx264','-pix_fmt','yuv420p','-crf','18',CONFIG.output]);
const probe = JSON.parse(await run(CONFIG.ffprobe, ['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate,r_frame_rate,nb_read_frames:format=duration','-of','json',CONFIG.output]));
await fs.writeFile(path.join(dir, "timestamps.json"), JSON.stringify({frames, wallSeconds, firstTime, finalHold}, null, 2));
const frameSpan = frames.at(-1).timestamp - firstTime;
console.log(JSON.stringify({output: CONFIG.output, source: {width: frames[0].width, height: frames[0].height, frames: frames.length, eventCount, captureWallSeconds: wallSeconds, frameSpanSeconds: frameSpan, observedFramesPerSecondOverFrameSpan: frameSpan > 0 ? (frames.length - 1) / frameSpan : null, note: 'Event rate is content-dependent; measure with continuous motion. VFR timestamps preserved, not an asserted 30fps.'}, probe, rawCaptureDirectory: dir}, null, 2));
// Raw JPEGs remain deliberately for source-frame audit and recovery. They may
// contain private information; remove the printed directory after inspection.

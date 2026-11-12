import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const main = read('./src/Demo.tsx');
const scenes = [...main.matchAll(/<Sequence name="([^"]+)" from=\{(\d+) \* fps\} durationInFrames=\{(\d+) \* fps\}/g)].map(([,name,start,duration]) => ({name,start:+start,duration:+duration}));
assert.equal(scenes.length, 10);
let end = 0; for (const scene of scenes) {assert.equal(scene.start,end,scene.name); end += scene.duration;}
assert.equal(end, 80); assert.ok(end < 90);
assert.equal(scenes.at(-1).name, 'Brand ending'); assert.equal(scenes.at(-1).duration, 8);
assert.match(read('./src/Root.tsx'), /id="SessionCrewDemo"[^\n]+durationInFrames=\{80 \* 30\}/);
assert.match(read('./src/Root.tsx'), /id="StoryEditReview"[^\n]+durationInFrames=\{80 \* 30\}/);
assert.match(read('./src/Root.tsx'), /id="ClimaxReview"[^\n]+durationInFrames=\{16 \* 30\}/);
assert.doesNotMatch(main, /GodsConverge|Convergence/);
assert.match(main, /name="Working and overlap"[^\n]*<Climax \/>/);
const climax = read('./src/Climax.tsx');
assert.match(climax, /dialogue\.odin\.agent\.slice\(lineStart\)/);
assert.match(climax, /dialogue\.odin\.agent\.slice\(0, lineStart\)/);
assert.match(climax, /seconds >= 10/);
assert.match(climax, /seconds >= 8 && seconds < 10/);
assert.match(climax, /rowY\(6\) \+ rowY\(7\)/);
assert.match(climax, /awakening-overlap\.png/);
const rows = vm.runInNewContext(climax.match(/export const nativeRows = ([\s\S]*?) as const;/)[1]);
const shots = vm.runInNewContext(climax.match(/export const awakeningShots = ([\s\S]*?) as const;/)[1]);
assert.equal(shots.map(s => s.role).join(','), 'thor,tyr,freyja,frigg');
for (const s of shots) {
  assert.equal(rows[s.before][s.beforeRow], s.role);
  assert.equal(rows[s.after][s.afterRow], s.role);
  assert.equal(s.after, s.before + 1);
}
assert.equal(rows[4][4], 'default');
assert.equal(rows[4].slice(6).join(','), 'baldr,loki');
assert.match(climax, /105\.75 \+ 70\.5 \* row/);
assert.match(climax, /\[0\.72, 1\.05\]/);
assert.match(climax, /\[10\.6, 10\.95\]/);
for (let i = 0; i <= 4; i++) assert.ok(existsSync(`public/footage/awakening-native/awakening-${i}.png`));
assert.ok(existsSync('public/footage/awakening-native/awakening-overlap.png'));
assert.doesNotMatch(climax, /GodsConverge|climax-native-4k-take01/);
const imported = read('./tools/scripted-story-import.js').match(/const data=([\s\S]*?);\nfor\(/)[1];
const displayed = read('./src/EditorialDialogue.tsx').match(/export const dialogue = ([\s\S]*?) as const;/)[1];
const source = vm.runInNewContext(imported); const output = vm.runInNewContext(`(${displayed})`);
for (const [i,key] of ['heimdall','loki','odin'].entries()) {
  assert.equal(output[key].user, source[i].messages[0].content.replace(/^Scripted demo: /, ''));
  assert.equal(output[key].agent, source[i].messages[1].content);
  assert.match(main, new RegExp(`<EditorialDialogue character="${key}"`));
  const split = Number(main.match(new RegExp(`EditorialDialogue character="${key}" splitSeconds=\\{([\\d.]+)\\}`))[1]);
  const duration = scenes.find(scene => scene.name === `${output[key].name} dialogue`).duration;
  const roles = key === 'odin' ? [['user', split], ['agent', 16]] : [['user', split], ['agent', duration - split]];
  if (key === 'odin') assert.equal(duration, split, 'Odin reply is not shown on dialogue card');
  for (const [role, seconds] of roles) {
    const words = output[key][role].split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
    const entrance = key === 'odin' && role === 'agent' ? 0.95 : 0.65;
    // A conservative reading-time heuristic, not a substitute for playback QA.
    assert.ok(seconds > entrance && words * 60 / (seconds - entrance) <= 220, `${key} ${role} reading time`);
  }
}
for (const name of ['List and collapse','Heimdall raised hand']) {
 const scene = main.split(`name="${name}"`)[1].split('</Sequence>')[0];
 assert.match(scene, /<Native /); assert.doesNotMatch(scene, /StoryShot|slate/i);
}
assert.match(main, /name="Heimdall hand to session"[^\n]*<HeimNavigation/);
assert.match(main, /Native src="heimdall-hand-read-take01.mp4"/);
assert.doesNotMatch(main, /ReplyCloseup/);
for (const f of ['opening-final-clean-take01.mp4','features-webapp-take02.mp4','scripted-story-take01.mp4','scripted-loki-take01.mp4']) assert.ok(existsSync(`public/footage/${f}`),f);
assert.match(main, /name="Loki navigation" from=\{26 \* fps\} durationInFrames=\{3 \* fps\}[^\n]*<LokiNavigation \/>/);
for (const f of ['before','menu','pressed','named-menu-result']) assert.ok(existsSync(`public/footage/loki-quickcreate-steps/${f}.png`), f);
console.log('PASS: 80s contiguous; exact six scripted lines; Webapp climax, no concept page; 8s ending.');

assert.match(main, /name="Project navigation" from=\{41 \* fps\} durationInFrames=\{8 \* fps\}[^\n]*<ProjectNavigation \/>/);
assert.doesNotMatch(main, /project-odin-take01-cfr/);
assert.match(read('./src/Root.tsx'), /id="ProjectNavigationReview"[^\n]+durationInFrames=\{8 \* 30\}/);
for (const f of ['before','menu','picker','pressed','result']) assert.ok(existsSync(`public/footage/odin-project-steps/${f}.png`), f);

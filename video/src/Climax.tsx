import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {dialogue} from './EditorialDialogue';

// Coordinates are CSS pixels at 1920x1080, not DPR2 PNG pixels.
// Native renderer sorts working before idle before offline after each stage.
export const nativeRows = [
  ['default','heimdall','baldr','freyja','frigg','loki','thor','tyr'],
  ['thor','default','heimdall','baldr','freyja','frigg','loki','tyr'],
  ['thor','tyr','default','heimdall','baldr','freyja','frigg','loki'],
  ['freyja','thor','tyr','default','heimdall','baldr','frigg','loki'],
  ['freyja','frigg','thor','tyr','default','heimdall','baldr','loki'],
] as const;
export const awakeningShots = [
  {role: 'thor', before: 0, beforeRow: 6, after: 1, afterRow: 0},
  {role: 'tyr', before: 1, beforeRow: 7, after: 2, afterRow: 1},
  {role: 'freyja', before: 2, beforeRow: 5, after: 3, afterRow: 0},
  {role: 'frigg', before: 3, beforeRow: 6, after: 4, afterRow: 1},
] as const;
export const overlapAsset = 'footage/awakening-native/awakening-overlap.png';
export const framingVerified: boolean = true;
const rowY = (row: number) => 105.75 + 70.5 * row;
const asset = (stage: number) => `footage/awakening-native/awakening-${stage}.png`;
const ease = Easing.bezier(0.4, 0, 0.2, 1);
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const readingGradient = 'linear-gradient(90deg, transparent 40%, rgba(248,244,235,.45) 49%, #f8f4eb 60%, #f8f4eb 100%)';

// A single rectangle of the original image, never separate avatar layers.
const NativeShot = ({src, y, zoom, height, offset = 0, leftEdge = 60}: {src: string; y: number; zoom: number; height: number; offset?: number; leftEdge?: number}) => <div style={{position: 'absolute', left: 70 + offset, top: 540 - height / 2, width: 870, height, overflow: 'hidden'}}>
  <Img src={staticFile(src)} style={{position: 'absolute', width: 1920 * zoom, height: 1080 * zoom, maxWidth: 'none', left: -leftEdge * zoom, top: height / 2 - y * zoom}} />
</div>;

export const Climax = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const overlap = seconds >= 10;
  const lineStart = dialogue.odin.agent.indexOf('And ');
  const copy = overlap ? dialogue.odin.agent.slice(lineStart) : dialogue.odin.agent.slice(0, lineStart).trim();
  const reveal = interpolate(seconds - (overlap ? 10 : 0), [0, 0.65], [0, 1], {...clamp, easing: ease});
  const index = Math.min(3, Math.floor(seconds / 2));
  const shot = awakeningShots[index];
  const local = seconds - index * 2;
  const cross = interpolate(local, [0.72, 1.05], [0, 1], {...clamp, easing: ease});
  // Dip to the surrounding cream between different people: no face morphs.
  const shotOpacity = interpolate(local, [0, 0.16, 1.84, 2], [0, 1, 1, 0], {...clamp, easing: ease});
  const slide = interpolate(local, [0, 2], [-8, 8], {...clamp, easing: ease});
  const odinCross = interpolate(seconds, [10.6, 10.95], [0, 1], {...clamp, easing: ease});
  const odinZoom = interpolate(seconds, [10, 16], [3.8, 4.05], {...clamp, easing: ease});
  return <AbsoluteFill style={{backgroundColor: '#f8f4eb', overflow: 'hidden'}}>
    {seconds < 8 && <div style={{position: 'absolute', inset: 0, opacity: shotOpacity}}>
      <NativeShot src={asset(shot.before)} y={rowY(shot.beforeRow)} zoom={3.2} height={210} offset={slide} />
      <div style={{position: 'absolute', inset: 0, opacity: cross}}><NativeShot src={asset(shot.after)} y={rowY(shot.afterRow)} zoom={3.2} height={210} offset={slide} /></div>
    </div>}
    {seconds >= 8 && seconds < 10 && <NativeShot src={asset(4)} y={(rowY(6) + rowY(7)) / 2} zoom={3.2} height={450} />}
    {overlap && <>
      <NativeShot src={asset(4)} y={rowY(4)} zoom={odinZoom} height={240} leftEdge={45} />
      <div style={{position: 'absolute', inset: 0, opacity: odinCross}}><NativeShot src={overlapAsset} y={rowY(4)} zoom={odinZoom} height={240} leftEdge={45} /></div>
    </>}
    <AbsoluteFill style={{background: readingGradient}} />
    <div style={{position: 'absolute', left: 1025, right: 115, top: 195, opacity: reveal, translate: `0 ${20 * (1 - reveal)}px`}}>
      <div style={{fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: 3, color: '#aa4d32', textTransform: 'uppercase'}}>Odin · Agent</div>
      <div style={{width: 75, height: 3, background: '#b85435', marginTop: 29, marginBottom: 47}} />
      <div style={{fontFamily: 'Georgia, serif', fontSize: overlap ? 72 : 51, fontWeight: overlap ? 600 : 400, lineHeight: overlap ? 1.12 : 1.3, letterSpacing: '-0.5px', color: overlap ? '#b85435' : '#193d30'}}>{copy}</div>
    </div>
  </AbsoluteFill>;
};

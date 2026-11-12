import {AbsoluteFill, CanvasImage, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// A single illustration split into aligned paper-like strips; no generated product UI.
const Piece = ({index}: {index: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const start = index * 0.12 * fps;
  const amount = interpolate(frame, [start, start + 1.25 * fps], [1, 0], {easing: Easing.bezier(0.22, 1, 0.36, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const offset = [-68, 52, -42, 64][index];
  return <div style={{position: 'absolute', left: 510 + index * 225, top: 105, width: 225, height: 600, overflow: 'hidden', translate: `${offset * amount}px ${(-24 + index * 14) * amount}px`, opacity: 1 - amount}}>
    <CanvasImage src={staticFile('sessioncrew-hero.png')} style={{position: 'absolute', width: 900, height: 600, left: -index * 225, top: 0}} />
  </div>;
};

const Tagline = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = interpolate(frame, [2.2 * fps, 3.1 * fps], [0, 1], {easing: Easing.bezier(0.22, 1, 0.36, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{position: 'absolute', top: 788, width: '100%', textAlign: 'center', color: '#183c31', fontFamily: 'Georgia, serif', fontSize: 58, letterSpacing: 0.4, opacity: progress, translate: `0 ${18 * (1 - progress)}px`}}>Interact with sessions like bots.</div>;
};

export const BrandEnding = () => <AbsoluteFill style={{backgroundColor: '#f8f4e9'}}>
  <div style={{position: 'absolute', top: 57, left: 510, width: 48, height: 5, backgroundColor: '#c75536'}} />
  <Piece index={0} /><Piece index={1} /><Piece index={2} /><Piece index={3} />
  <Tagline />
</AbsoluteFill>;

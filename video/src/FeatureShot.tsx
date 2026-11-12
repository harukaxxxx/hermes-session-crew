import {AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';

// Actual Webapp renderer, controlled isolated state source. 102 CDP content-change
// events were timestamped, then encoded as 30 fps CFR; not 30 unique captures/s.
export const FeatureShot = ({trimBeforeFrames, headline}: {trimBeforeFrames: number; headline: string}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const zoom = 1.48;
  return <AbsoluteFill style={{background: '#f8f4e9', color: '#183c31', fontFamily: 'Arial, sans-serif'}}>
    <div style={{position: 'absolute', left: 135, top: 75, width: 360 * zoom, height: 635 * zoom, overflow: 'hidden', borderRadius: 16, boxShadow: '0 18px 65px #163a2a1a'}}>
      <OffthreadVideo muted src={staticFile('footage/features-webapp-take02.mp4')} trimBefore={trimBeforeFrames} style={{position: 'absolute', width: 1920 * zoom, height: 1080 * zoom, left: -55 * zoom, top: -48 * zoom, maxWidth: 'none'}} />
    </div>
    <div style={{position: 'absolute', left: 850, top: 325, width: 850, opacity: p, translate: `0 ${25 * (1 - p)}px`}}>
      <div style={{fontWeight: 700, fontSize: 22, letterSpacing: 4, color: '#a84b31'}}>SESSIONCREW</div>
      <div style={{fontFamily: 'Georgia, serif', fontSize: 78, lineHeight: 1.12, marginTop: 32}}>{headline}</div>
      <div style={{width: 140, height: 3, background: '#b84c32', marginTop: 42}} />
    </div>
  </AbsoluteFill>;
};

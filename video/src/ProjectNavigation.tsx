import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// Sequential actual native captures + authored holds/cursor, not continuous recording.
// Cursor destinations reproduce capture.json input coordinates, not native motion.
export const ProjectNavigation = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const image = t < 1 ? 'before' : t < 2.5 ? 'menu' : t < 4.5 ? 'picker' : t < 4.75 ? 'pressed' : 'result';
  const ease = Easing.bezier(0.4, 0, 0.2, 1);
  const options = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: ease};
  const x = interpolate(t, [0, 0.7, 1.15, 2.2, 2.75, 4.25], [190, 104, 104, 550, 550, 738], options);
  const y = interpolate(t, [0, 0.7, 1.15, 2.2, 2.75, 4.25], [170, 104, 104, 414, 414, 808], options);
  const cursorOpacity = interpolate(t, [0, 0.15, 4.5, 4.85], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ringOpacity = interpolate(t, [4.48, 4.55, 4.72], [0, 0.75, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{overflow: 'hidden', background: '#fff'}}>
    <div style={{position: 'absolute', width: 1920, height: 1080, transformOrigin: 'top left', transform: `scale(${t < 4.75 ? 1.13 : 1})`}}>
      <Img src={staticFile(`footage/odin-project-steps/${image}.png`)} style={{width: 1920, height: 1080}} />
      {t < 4.75 && <>
        <div style={{position: 'absolute', left: 738 - 16, top: 808 - 16, width: 32, height: 32, border: '2px solid #234e3d', borderRadius: '50%', opacity: ringOpacity}} />
        <svg width="25" height="32" viewBox="0 0 25 32" style={{position: 'absolute', left: x, top: y, opacity: cursorOpacity, overflow: 'visible'}}><path d="M2 1 L2 24 L8 18 L12 29 L16 27 L12 17 L21 17 Z" fill="white" stroke="#234e3d" strokeWidth="2" strokeLinejoin="round" /></svg>
      </>}
    </div>
  </AbsoluteFill>;
};

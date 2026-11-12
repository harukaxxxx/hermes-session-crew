import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// Sequential native captures with authored holds, not a continuous screencast.
export const LokiNavigation = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const image = t < 0.3 ? 'before' : t < 1.2 ? 'menu' : t < 1.4 ? 'pressed' : 'named-menu-result';
  return <AbsoluteFill style={{overflow: 'hidden', background: '#fff'}}>
    <Img src={staticFile(`footage/loki-quickcreate-steps/${image}.png`)} style={{position: 'absolute', width: 2880, height: 1620, maxWidth: 'none', left: 0, top: 0}} />
  </AbsoluteFill>;
};

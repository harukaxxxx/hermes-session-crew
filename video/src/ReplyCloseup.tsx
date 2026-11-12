import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

// Native static reply captures: original glyphs and wrapping, not subtitles.
export const ReplyCloseup = ({src, name, chapter}: {src: string; name: string; chapter: string}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 25], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  return <AbsoluteFill style={{background: '#f8f4e9', fontFamily: 'Arial, sans-serif', color: '#193f32'}}>
    <div style={{position: 'absolute', left: 150, top: 120, opacity: p, translate: `0 ${24 * (1 - p)}px`}}>
      <div style={{fontSize: 23, fontWeight: 700, letterSpacing: 4, color: '#ad4a31'}}>THE RAGNARÖK STORY / {name.toUpperCase()}</div>
      <div style={{fontFamily: 'Georgia, serif', fontSize: 80, marginTop: 24}}>{chapter}</div>
      <div style={{width: 140, height: 3, background: '#b84c32', marginTop: 30}} />
    </div>
    <div style={{position: 'absolute', left: 150, top: 400, width: 1620, padding: 35, boxSizing: 'border-box', background: '#fcfcfc', boxShadow: '0 12px 50px #163a2a12', opacity: p}}>
      <Img src={staticFile(`footage/story-readable-v4/${src}.png`)} style={{display: 'block', width: src === 'heimdall' ? 1500 : 1120, maxWidth: '100%'}} />
    </div>
    <div style={{position: 'absolute', left: 150, bottom: 100, width: 1620, height: 2, background: '#d5ddcf'}} />
  </AbsoluteFill>;
};

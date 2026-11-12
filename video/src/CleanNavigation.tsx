import {AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useVideoConfig} from 'remotion';

const source = 'footage/opening-final-clean-take01.mp4';
const cropVideo = (x: number, zoom: number) => <OffthreadVideo muted src={staticFile(source)} style={{position: 'absolute', width: 1920 * zoom, height: 1080 * zoom, left: -x * zoom, top: 0, maxWidth: 'none'}} />;

// Hold the final clean native frame to give the list/collapse a six-second beat.
export const CleanOpening = () => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{background: '#f8f4e9', color: '#183c31', fontFamily: 'Arial, sans-serif'}}>
    <div style={{position: 'absolute', left: 110, top: 0, width: 650, height: 1080, overflow: 'hidden'}}>
      <Sequence durationInFrames={168}>{cropVideo(0, 1)}</Sequence>
      <Sequence from={168}><Freeze frame={167}>{cropVideo(0, 1)}</Freeze></Sequence>
    </div>
    <div style={{position: 'absolute', left: 900, top: 315}}><div style={{fontSize: 22, fontWeight: 700, letterSpacing: 3, color: '#9d3e29'}}>SESSIONCREW</div><div style={{fontFamily: 'Georgia, serif', fontSize: 76, lineHeight: 1.12, marginTop: 30}}>Your crew,<br />within reach.</div><div style={{fontSize: 30, marginTop: 30, color: '#476658'}}>Find a profile. Open the right session.</div></div>
    <span style={{display: 'none'}}>{fps}</span>
  </AbsoluteFill>;
};

// Project association and entry only: no navigation into the project is implied.
// 2 seconds of source followed by a 4-second hold on the actual menu frame.
export const CleanProject = () => {
  const {fps} = useVideoConfig();
  const video = () => <OffthreadVideo muted src={staticFile(source)} trimBefore={174} style={{position: 'absolute', width: 1920 * 1.48, height: 1080 * 1.48, left: -50 * 1.48, top: 0, maxWidth: 'none'}} />;
  return <AbsoluteFill style={{background: '#f8f4e9', color: '#183c31', fontFamily: 'Arial, sans-serif'}}>
    <div style={{position: 'absolute', left: 100, top: 45, width: 650 * 1.48, height: 650 * 1.48, overflow: 'hidden', borderRadius: 12}}>
      <Sequence durationInFrames={2 * fps}>{video()}</Sequence>
      <Sequence from={2 * fps}><Freeze frame={2 * fps - 1}>{video()}</Freeze></Sequence>
    </div>
    <div style={{position: 'absolute', left: 1130, top: 340, width: 670}}><div style={{fontSize: 22, fontWeight: 700, letterSpacing: 3, color: '#9d3e29'}}>ODIN / PROJECT</div><div style={{fontFamily: 'Georgia, serif', fontSize: 70, lineHeight: 1.15, marginTop: 30}}>Find Ragnarök.</div></div>
  </AbsoluteFill>;
};

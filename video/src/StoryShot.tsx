import {AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// Caption timestamps are local to the edited shot, not the source file.
export type CaptionCue = {text: string; startMs: number; endMs: number; timestampMs: number | null; confidence: number | null};
export type Recording = {
  src: string; trimBeforeFrames: number;
  sourceWidth: number; sourceHeight: number;
  crop: {x: number; y: number; width: number; height: number};
  zoom?: number;
  captions: CaptionCue[];
};
export type Shot = {number: string; range: string; title: string; detail: string; script?: string; scriptLocked?: boolean; motionLabel?: string; recording: Recording | null};

// Editorial chapter marker, not a product badge or dialogue subtitle.
const StoryMarker = ({label}: {label: string}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = interpolate(frame, [fps * 0.3, fps * 1.1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0, 0, 1)});
  return <div style={{position: 'absolute', right: 70, bottom: 100, display: 'flex', alignItems: 'center', gap: 15, opacity: progress, transform: `translateX(${(1 - progress) * 18}px)`, fontFamily: 'Arial, sans-serif', color: '#315849', fontSize: 20, fontWeight: 700, letterSpacing: 2, pointerEvents: 'none'}}><div style={{width: 90 * progress, height: 2, backgroundColor: '#b84c32'}} /><span style={{background: '#f8f4e9e8', padding: '8px 11px'}}>{label}</span></div>;
};

export const StoryShot = ({shot}: {shot: Shot}) => {
  const r = shot.recording;
  if (r) {
    const {crop} = r;
    if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > r.sourceWidth || crop.y + crop.height > r.sourceHeight || crop.width > 1920 || crop.height > 1080) throw new Error(`Invalid native-pixel crop in shot ${shot.number}`);
    return <AbsoluteFill style={{backgroundColor: '#f8f4e9'}}>
      <div style={{position: 'absolute', left: (1920 - crop.width * (r.zoom ?? 1)) / 2, top: r.zoom ? 0 : (1080 - crop.height) / 2, width: crop.width * (r.zoom ?? 1), height: crop.height * (r.zoom ?? 1), overflow: 'hidden'}}>
        <OffthreadVideo muted src={staticFile(r.src)} trimBefore={r.trimBeforeFrames} style={{position: 'absolute', width: r.sourceWidth * (r.zoom ?? 1), height: r.sourceHeight * (r.zoom ?? 1), left: -crop.x * (r.zoom ?? 1), top: -crop.y * (r.zoom ?? 1), maxWidth: 'none'}} />
      </div>

      {shot.motionLabel && <StoryMarker label={shot.motionLabel} />}
    </AbsoluteFill>;
  }
  return <AbsoluteFill style={{backgroundColor: '#f8f4e9', color: '#183c31', fontFamily: 'Arial, sans-serif', padding: '105px 150px'}}>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 25, letterSpacing: 4, color: '#3c6254', fontWeight: 700}}><span>SESSIONCREW / EDITING TIMELINE</span><span>{shot.range}</span></div>
    <div style={{position: 'absolute', left: 150, right: 150, top: 200, height: 2, backgroundColor: '#b5c5b4'}} />
    <div style={{display: 'flex', alignItems: 'center', gap: 30, marginTop: 100}}><span style={{fontFamily: 'Georgia, serif', fontSize: 70, color: '#b84c32'}}>{shot.number}</span><span style={{fontSize: 25, letterSpacing: 3, border: '2px solid #b84c32', color: '#9d3e29', padding: '10px 18px'}}>FOOTAGE NOT YET RECORDED</span></div>
    <div style={{fontFamily: 'Georgia, serif', fontSize: 75, marginTop: 42, lineHeight: 1.15}}>{shot.title}</div>
    <div style={{fontSize: 34, lineHeight: 1.45, marginTop: 30, maxWidth: 1400, color: '#476658'}}>{shot.detail}</div>
    {shot.script && <div style={{fontSize: 31, lineHeight: 1.35, marginTop: 34, maxWidth: 1450, color: '#183c31'}}><span style={{color: '#9d3e29', fontWeight: 700}}>{shot.scriptLocked ? 'LOCKED SCRIPT · ' : 'DRAFT SCRIPT · '}</span>{shot.script}</div>}
    <div style={{position: 'absolute', bottom: 100, left: 150, fontSize: 24, letterSpacing: 1.5, color: '#527165'}}>EDITING PLACEHOLDER · NOT PRODUCT FOOTAGE</div>
  </AbsoluteFill>;
};

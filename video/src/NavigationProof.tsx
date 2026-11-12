import {AbsoluteFill, OffthreadVideo, staticFile} from 'remotion';

// The 1600×850 viewport shows the top-left of the 1920×1080 capture at
// native pixel size; it is an editorial crop, not a reconstructed interface.
export const NavigationProof = () => (
  <AbsoluteFill style={{backgroundColor: '#f6f3eb', fontFamily: 'Arial, sans-serif', color: '#173b30'}}>
    <div style={{position: 'absolute', left: 160, top: 56, fontSize: 30, fontWeight: 700, letterSpacing: -0.3}}>
      Navigation capture — synthetic demo content
    </div>
    <div style={{position: 'absolute', left: 160, top: 124, width: 1600, height: 850, overflow: 'hidden', border: '1px solid #d7ded6', boxShadow: '0 12px 35px rgba(23, 59, 48, 0.10)'}}>
      <OffthreadVideo muted src={staticFile('footage/light-navigation-take03.mp4')} style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, maxWidth: 'none'}} />
    </div>
    <div style={{position: 'absolute', left: 160, top: 1007, fontSize: 20, color: '#53685d'}}>
      Recorded navigation · original-size crop · 1920 × 1080 source
    </div>
  </AbsoluteFill>
);

import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const names = ['THOR', 'TYR', 'FREYJA', 'FRIGG'];
const tasks = ['SCOUT', 'PLAN', 'DESIGN', 'REVIEW', 'BUILD', 'TEST', 'DELIVER'];

// Editorial illustration, never a representation of product status or execution.
export const GodsConverge = () => {
  // Preserve the full original ten-second choreography in the six-second bridge.
  const frame = useCurrentFrame() * (10 / 6);
  const reveal = (start: number, length = 18) => interpolate(frame, [start, start + length], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const confluence = reveal(166, 34);
  return <AbsoluteFill style={{background: '#f8f4e9', color: '#193f32', fontFamily: 'Arial, sans-serif', overflow: 'hidden'}}>

    <div style={{position: 'absolute', left: 100, top: 135, fontFamily: 'Georgia, serif', fontSize: 64}}>The gods assemble.</div>
    <div style={{position: 'absolute', left: 100, top: 224, fontSize: 25, letterSpacing: 2, color: '#54715f'}}>FOUR ANSWER THE CALL</div>
    {names.map((name, i) => {
      const p = reveal(15 + i * 12, 24);
      return <div key={name} style={{position: 'absolute', left: 100 + i * 270, top: 285, width: 240, height: 102, borderTop: '4px solid #b34e33', opacity: p, translate: `0 ${22 * (1 - p)}px`}}>
        <div style={{fontFamily: 'Georgia, serif', fontSize: 38, marginTop: 17}}>{name}</div>
      </div>;
    })}
    <div style={{position: 'absolute', right: 120, top: 290, fontFamily: 'Georgia, serif', fontSize: 35, color: '#a9b4a2', borderTop: '2px solid #cbd2c3', paddingTop: 18}}>BALDR</div>
    <div style={{position: 'absolute', left: 100, top: 444, fontFamily: 'Georgia, serif', fontSize: 55, opacity: reveal(65)}}>Odin leads the way.</div>
    <div style={{position: 'absolute', left: 102, top: 520, fontSize: 24, letterSpacing: 2, color: '#54715f', opacity: reveal(75)}}>SEVEN THREADS · ONE STORY</div>
    <svg width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
      {tasks.map((name, i) => {
        const p = reveal(95 + i * 7, 28);
        const x = 190 + i * 225;
        return <g key={name} opacity={p}><line x1={x} y1="665" x2={x + (960 - x) * confluence} y2={665 + 200 * confluence} stroke="#9eab98" strokeWidth="3" /><circle cx={x + (960 - x) * confluence} cy={665 + 200 * confluence} r="6" fill="#b34e33" /></g>;
      })}
      <circle cx="960" cy="865" r={interpolate(frame, [196, 225], [10, 56], clamp)} fill="none" stroke="#b34e33" strokeWidth="3" opacity={interpolate(frame, [196, 225, 245], [0, 0.65, 0], clamp)} />
    </svg>
    {tasks.map((name, i) => <div key={name} style={{position: 'absolute', left: 112 + i * 225, top: 605, width: 170, textAlign: 'center', fontWeight: 700, fontSize: 23, letterSpacing: 2, color: '#315e4b', opacity: reveal(95 + i * 7, 20)}}>{name}</div>)}
    <div style={{position: 'absolute', top: 830, left: 610, width: 700, textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 52, opacity: reveal(208, 20), translate: `0 ${16 * (1 - reveal(208, 20))}px`}}>Ragnarök, together.</div>

  </AbsoluteFill>;
};

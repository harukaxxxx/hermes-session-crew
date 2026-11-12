import {AbsoluteFill, Audio, CanvasImage, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const LIGHT_HERO_ASSET = 'artwork/light-hero-v1/upscale2x/hero-light-2x.png';
export const ORIGINAL_WORDMARK_ASSET = 'artwork/light-hero-v1/wordmark/sessioncrew-original-ink.png';
export const IMPACT_ASSET = 'audio/ending-impact-v4.wav';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.65, 0, 0.85, 0.35);

// An inward press followed by one decisive, non-elastic landing at 2.4 s.
const Piece = ({index, asset}: {index: number; asset: string}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const gathering = interpolate(frame, [0.35 * fps, 1.72 * fps, 2.4 * fps], [1, 0.72, 0], {...clamp, easing: ease});
  const visible = interpolate(frame, [0.3 * fps + index * 2, 0.8 * fps + index * 2], [0, 1], clamp);
  const offsets = [[-105, -76], [-37, 92], [42, -86], [112, 66]];
  return <div style={{position: 'absolute', left: 300 + index * 405, top: 0, width: 405, height: 1080, overflow: 'hidden', translate: `${offsets[index][0] * gathering}px ${offsets[index][1] * gathering}px`, opacity: visible}}>
    <CanvasImage src={staticFile(asset)} style={{position: 'absolute', width: 1620, height: 1080, left: -index * 405, top: 0}} />
  </div>;
};

const HeroComposite = ({asset}: {asset: string}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const edge = interpolate(frame, [2.4 * fps, 2.8 * fps], [1, 0], clamp);
  return <AbsoluteFill style={{maskImage: `linear-gradient(to right, rgba(0,0,0,${edge}) 300px, black 590px)`}}>
    <Piece index={0} asset={asset} /><Piece index={1} asset={asset} /><Piece index={2} asset={asset} /><Piece index={3} asset={asset} />
  </AbsoluteFill>;
};

// Ink lines converge toward the book; a single restrained ring dissipates on impact.
const ImpactLines = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const gather = interpolate(frame, [0.45 * fps, 2.35 * fps], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const lineOpacity = interpolate(frame, [0.45 * fps, 1.2 * fps, 2.3 * fps, 2.5 * fps], [0, 0.32, 0.48, 0], clamp);
  const ringRadius = interpolate(frame, [2.4 * fps, 2.95 * fps], [85, 640], {...clamp, easing: Easing.out(Easing.cubic)});
  const ringOpacity = interpolate(frame, [2.4 * fps, 2.47 * fps, 2.95 * fps], [0, 0.32, 0], clamp);
  const ends = [[280, 220], [430, 40], [910, 20], [1830, 90], [1910, 340], [1840, 1010], [650, 1060]];
  return <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    <g stroke="#254d3d" fill="none" strokeWidth="2" opacity={lineOpacity}>
      {ends.map(([x, y]) => <line key={`${x}-${y}`} x1={x + (1180 - x) * gather * 0.7} y1={y + (610 - y) * gather * 0.7} x2={x + (1180 - x) * (0.18 + gather * 0.7)} y2={y + (610 - y) * (0.18 + gather * 0.7)} />)}
    </g>
    <circle cx="1180" cy="610" r={ringRadius} stroke="#244b39" strokeWidth="3" fill="none" opacity={ringOpacity} />
  </svg>;
};

const Copy = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = interpolate(frame, [1.86 * fps, 2.4 * fps], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const tagline = interpolate(frame, [2.4 * fps, 2.85 * fps], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  return <div style={{position: 'absolute', left: 90, top: 685, color: '#183c31', opacity: progress, translate: `0 ${-38 * (1 - progress)}px`}}>
    <CanvasImage src={staticFile(ORIGINAL_WORDMARK_ASSET)} style={{width: 650, height: 650 * 188 / 607}} />
    <div style={{fontFamily: 'Georgia, serif', fontSize: 35, letterSpacing: 0.2, marginTop: 18, opacity: tagline}}>Interact with sessions like bots.</div>
  </div>;
};

export const BrandEndingLight = ({asset = LIGHT_HERO_ASSET}: {asset?: string}) => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{backgroundColor: '#f8f4e9'}}>
    <HeroComposite asset={asset} />
    <ImpactLines />
    <Copy />
    <Sequence from={2.3 * fps} name="Original impact"><Audio src={staticFile(IMPACT_ASSET)} /></Sequence>
  </AbsoluteFill>;
};

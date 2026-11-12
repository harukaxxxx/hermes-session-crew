import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig} from 'remotion';
import {BrandEndingLight} from './BrandEndingLight';
import {Climax} from './Climax';
import {ProjectNavigation} from './ProjectNavigation';
import {LokiNavigation} from './LokiNavigation';
import {EditorialDialogue, HeimReadContext} from './EditorialDialogue';

// Native navigation is deliberately full-frame and kept separate from editorial
// dialogue. These provisional takes do not yet establish every requested action.
const Native = ({src, start = 0}: {src: string; start?: number}) => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{background: '#f8f4eb'}}><OffthreadVideo muted src={staticFile(`footage/${src}`)} trimBefore={start * fps} style={{width: 1920, height: 1080}} /></AbsoluteFill>;
};
const HeimNavigation = () => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill><Native src="heimdall-hand-read-take01.mp4" /><Sequence from={4 * fps}><HeimReadContext /></Sequence></AbsoluteFill>;
};
export const Demo = () => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill>
    <Sequence name="List and collapse" from={0 * fps} durationInFrames={6 * fps}><Native src="opening-final-clean-take01.mp4" /></Sequence>
    <Sequence name="Heimdall raised hand" from={6 * fps} durationInFrames={3 * fps}><Native src="features-webapp-take02.mp4" start={11} /></Sequence>
    <Sequence name="Heimdall hand to session" from={9 * fps} durationInFrames={5 * fps}><HeimNavigation /></Sequence>
    <Sequence name="Heimdall dialogue" from={14 * fps} durationInFrames={12 * fps}><EditorialDialogue character="heimdall" splitSeconds={3} /></Sequence>
    <Sequence name="Loki navigation" from={26 * fps} durationInFrames={3 * fps}><LokiNavigation /></Sequence>
    <Sequence name="Loki dialogue" from={29 * fps} durationInFrames={12 * fps}><EditorialDialogue character="loki" splitSeconds={4.5} /></Sequence>
    <Sequence name="Project navigation" from={41 * fps} durationInFrames={8 * fps}><ProjectNavigation /></Sequence>
    <Sequence name="Odin dialogue" from={49 * fps} durationInFrames={7 * fps}><EditorialDialogue character="odin" splitSeconds={7} /></Sequence>
    <Sequence name="Working and overlap" from={56 * fps} durationInFrames={16 * fps}><Climax /></Sequence>
    <Sequence name="Brand ending" from={72 * fps} durationInFrames={8 * fps}><BrandEndingLight /></Sequence>
  </AbsoluteFill>;
};
// Legacy preview uses the same draft so its dialogue cannot diverge.
export const StoryEdit = Demo;

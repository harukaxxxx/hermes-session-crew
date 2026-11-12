import {Composition} from 'remotion';
import {Demo, StoryEdit} from './Demo';
import {BrandEnding} from './BrandEnding';
import {BrandEndingLight} from './BrandEndingLight';
import {NavigationProof} from './NavigationProof';
import {StoryShot} from './StoryShot';
import {Climax} from './Climax';
import {ProjectNavigation} from './ProjectNavigation';

export const RemotionRoot = () => (
  <>
    <Composition id="SessionCrewDemo" component={Demo} width={1920} height={1080} fps={30} durationInFrames={80 * 30} />
    <Composition id="StoryEditReview" component={StoryEdit} width={1920} height={1080} fps={30} durationInFrames={80 * 30} />
    <Composition id="ProjectNavigationReview" component={ProjectNavigation} width={1920} height={1080} fps={30} durationInFrames={8 * 30} />
    <Composition id="ClimaxReview" component={Climax} width={1920} height={1080} fps={30} durationInFrames={16 * 30} />
    <Composition id="BrandEnding" component={BrandEnding} width={1920} height={1080} fps={30} durationInFrames={8 * 30} />
    <Composition id="BrandEndingLight" component={BrandEndingLight} width={1920} height={1080} fps={30} durationInFrames={8 * 30} />
    <Composition id="NavigationProof" component={NavigationProof} width={1920} height={1080} fps={30} durationInFrames={230} />
    <Composition id="RecordingEntryProof" component={StoryShot} width={1920} height={1080} fps={30} durationInFrames={120} defaultProps={{shot: {number: 'TEST', range: 'TEST', title: 'Technical preview', detail: 'Not story footage', recording: {src: 'footage/light-navigation-take03.mp4', trimBeforeFrames: 30, sourceWidth: 1920, sourceHeight: 1080, crop: {x: 0, y: 0, width: 1600, height: 850}, captions: [{text: 'Technical test · synthetic demo content', startMs: 500, endMs: 2500, timestampMs: null, confidence: null}]}}}} />
  </>
);

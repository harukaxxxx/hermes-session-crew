import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// Transcription of the approved scripted import, minus the visible source prefix.
export const dialogue = {
  heimdall: {name: 'Heimdall', source: 'scripted-story-take01.mp4', user: 'Give us the Nine Realms progress report.', agent: 'I have checked progress across the Nine Realms. Everyone is ready — except Loki. Can someone ask him where the Rainbow Bridge acceptance report is?'},
  loki: {name: 'Loki', source: 'scripted-loki-take01.mp4', user: 'Heimdall is looking for you. Where is the Rainbow Bridge acceptance report?', agent: 'It must be Ragnarök again. They scheduled the end of the world, but forgot to get Odin’s approval.'},
  odin: {name: 'Odin', source: 'scripted-odin-take01.mp4', user: 'The gods are still waiting for your command. Any longer, and Ragnarök will be nothing but twilight.', agent: "Then awaken the gods. And I'll form the head!"},
} as const;
export type Character = keyof typeof dialogue;

const readingGradient = 'linear-gradient(90deg, transparent 40%, rgba(248,244,235,.45) 49%, #f8f4eb 60%, #f8f4eb 100%)';

// Actual selected-session Webapp capture, with its native menu reopened after
// reading. This held editorial cut is not a reconstruction of the host UI.
export const HeimReadContext = () => <AbsoluteFill style={{overflow: 'hidden'}}>
  <Img src={staticFile('footage/story-backgrounds/heimdall-session-selected.png')} style={{position: 'absolute', width: 2304, height: 1296, left: 0, top: 0, maxWidth: 'none'}} />
  <AbsoluteFill style={{background: readingGradient}} />
</AbsoluteFill>;

// Native Loki menu over an empty, mythologically titled session. The capture is
// an editorial background, not evidence that the pending Quick create succeeded.
const LokiReadContext = () => <AbsoluteFill style={{overflow: 'hidden'}}>
  <Img src={staticFile('footage/story-backgrounds/loki-menu-context.png')} style={{position: 'absolute', width: 2304, height: 1296, left: 0, top: 0, maxWidth: 'none'}} />
  <AbsoluteFill style={{background: readingGradient}} />
</AbsoluteFill>;

// A genuine 2x-density capture of the selected, prewritten Odin conversation.
// Native menu membership is visible; this is not project-launch input evidence.
const OdinReadContext = () => <AbsoluteFill style={{overflow: 'hidden'}}>
  <Img src={staticFile('footage/story-backgrounds/odin-session-context-4k.png')} style={{position: 'absolute', width: 2304, height: 1296, left: 0, top: 0, maxWidth: 'none'}} />
  <AbsoluteFill style={{background: readingGradient}} />
</AbsoluteFill>;

// Full native frame remains the ground. Text is separate editorial typography,
// never a reconstruction of a host message. Replace held source with new native
// navigation takes after they arrive; the still is not proof of the navigation.
export const EditorialDialogue = ({character, splitSeconds}: {character: Character; splitSeconds: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const current = dialogue[character];
  const isAgent = frame >= splitSeconds * fps;
  const local = isAgent ? frame - splitSeconds * fps : frame;
  const p = interpolate(local, [0, fps * 0.65], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0, 0, 1)});
  const headReply = character === 'odin' && isAgent;
  const headStart = current.agent.indexOf('And ');
  const headP = interpolate(local, [fps * 0.35, fps * 0.95], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0, 0, 1)});
  return <AbsoluteFill style={{background: '#f8f4eb'}}>
    {character === 'heimdall' ? <HeimReadContext /> : character === 'loki' ? <LokiReadContext /> : <OdinReadContext />}
    <div style={{position: 'absolute', left: 1025, right: 115, top: 195, color: '#193d30', opacity: p, translate: `0 ${20 * (1 - p)}px`}}>
      <div style={{fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: 3, color: '#aa4d32', textTransform: 'uppercase'}}>{isAgent ? `${current.name} · Agent` : `You · to ${current.name}`}</div>
      <div style={{width: 75, height: 3, background: '#b85435', marginTop: 29, marginBottom: 47}} />
      <div style={{fontFamily: 'Georgia, serif', fontSize: 51, lineHeight: 1.3, letterSpacing: '-0.5px', whiteSpace: 'normal'}}>{headReply ? <>
        <span>{current.agent.slice(0, headStart)}</span>
        <span style={{display: 'block', marginTop: 24, fontSize: 72, fontWeight: 600, lineHeight: 1.12, color: '#b85435', opacity: headP, translate: `0 ${14 * (1 - headP)}px`}}>{current.agent.slice(headStart)}</span>
      </> : isAgent ? current.agent : current.user}</div>
    </div>
  </AbsoluteFill>;
};

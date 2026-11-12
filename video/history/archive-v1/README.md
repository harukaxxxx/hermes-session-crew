# SessionCrew demo video archive

This branch preserves the editable 80-second `SessionCrewDemo` working draft,
not the live plugin. It includes the footage, artwork, sound and source used by
that composition. No prior full export is known, so the output is not claimed
byte-identical to an earlier film. Native captures use staged demonstration
sessions and scripted dialogue; they are not evidence of live inference.

## Rebuild

Use the Node version in `package.json`, the exact `package-lock.json` dependencies,
and the Remotion browser prerequisites. With dependencies installed, run:

```sh
cd video
npm run lint
npm run build
node test-timeline.mjs
node test-ending-light.mjs
npx remotion render src/index.ts SessionCrewDemo out/sessioncrew-demo.mp4
```

The timeline test checks current editorial copy against the extracted original
scripted dialogue fixture. Historical capture-only recordings and the import
script are not render inputs and are intentionally excluded. The ending test
checks the actual upscale and wordmark; the earlier unscaled image and generated
review stills are not render inputs and are intentionally excluded. Tests are
regression checks, not playback or listening acceptance.

The two old `tools/*-record.js` scripts remain historical capture tools, not a
rebuild requirement. They target local browser sessions and perform interactions;
do not run them against private content.

## Sources

The UI footage and stills are project demo captures with scripted Norse-themed
sessions. Artwork is project artwork by Makino Natsuki generated with OpenAI
GPT Image 2.6; the light hero is a generated edit and the wordmark derives from
the original project art. The ending impact is procedural original synthesis;
see `public/audio/README.md`. Publication is authorized for this project's video
sources and required assets. Sampled visual review is not an exhaustive privacy
or rights audit of every frame.

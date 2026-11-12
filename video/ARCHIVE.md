# SessionCrew film archive

This branch (`demo/video`) preserves the film project and its production materials separately from the production plugin on `main`.

## Contents

- `video/src/`, package files and tests: Remotion composition source.
- `video/public/`: artwork, audio and footage consumed by the composition.
- `video/capture/` and top-level `capture/`: recorded takes, frame sequences and production evidence.
- `video/out/` and `video/stills/`: preserved renders and review images, not a claim that every draft is final.
- `video/tools/`, `video/feature-demo/`, `docs/` and demo-specific plugin/test changes: capture tooling and production notes.
- `video/source-assets/`: original artwork, avatar assets and provenance copied from the retired isolated demonstration environment.
- `video/demo-archive/`: synthetic demo roster, session receipts, profile mapping and seed source. These are not production user conversations.
- `video/history/archive-v1/`: files whose content differs from the earlier `archive/demo-video-v1` snapshot; identical files reuse the current archive content. This imports film material only, not that branch's unrelated plugin history.

`video/archive-files.json` inventories the preserved publication files with SHA-256 values. Dependencies, generated application bundles, caches, raw process logs and live runtime data are excluded. Private runtime settings, authentication material, databases and logs are not part of this archive.

## Use and limitations

Check out this branch in a separate working directory to work on the film. Read `video/package.json` and `video/README.md` for the composition's commands and existing review notes. Dependencies are not vendored. The recorded checks used the already installed local dependencies; this archive does not claim a clean-machine installation test.

The temporary native Webapp used for filming has been retired. Capture and generation scripts are preserved as historical production source, **not** an instruction to run them against a production gateway. Some scripts and original receipts retain historical absolute paths, private-network addresses and local tool endpoints. Recreating that environment requires a new, explicitly authorized setup; opening or building the Remotion project must not be mistaken for recreating the original live service. Do not execute import, capture or generation scripts without first reviewing their destination and side effects.

Existing evidence notes describe individual takes and drafts. Scripted or synthetic dialogue is not proof of real model execution, completed work or live activity coverage. The archive does not certify final audiovisual review or official endorsement of visual references. Preserve the accompanying artwork provenance and third-party license notices.

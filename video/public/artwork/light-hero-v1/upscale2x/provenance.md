# SessionCrew light Hero 2× upscale — completed

Request ID: sessioncrew-video-light-hero-upscale2x
Artist/profile: Makino Natsuki / makino-natsuki
Status: success; exactly one ComfyUI prompt submitted. No regeneration, paid API, model download or dependency installation.

## Output and verification

Output: hero-light-2x.png (this directory)
PNG independently decoded using Pillow 12.3.0: RGB, 3072×2048, 3:2, exact 2× of 1536×1024. No crop or stretch. Source dimensions, mode and SHA-256 independently checked before processing and source SHA-256 rechecked unchanged afterward.

Source SHA-256: 014a6a3118a932ac9404384950c2ca1364aae694008b0489fe6e16571bbbfe9a
Output SHA-256: 0f624c03280078154870f899bfae1ab7b8133562896bd41bfbffdbb7c73b63d4

## Method and lineage

AI super-resolution with 4x-ultra-mix_balanced.pth at 4×, followed by ImageScaleBy area at 0.5 for net 2×. This is AI super-resolution plus deterministic downsampling, not ordinary interpolation alone, not a newly generated illustration, and not UI native redrawing.

Model: /Users/haruka/ComfyUI-Shared/models/upscale_models/4x-ultra-mix_balanced.pth
Model SHA-256: e23ca000107aae95ec9b8d7d1bf150f7884f1361cd9d669bdf824d72529f0e26

Read the supplied successful E03 receipt and the saved E04 receipt. Reused E04 workflow_api unchanged except 76.inputs.image and 95.inputs.filename_prefix. Exact source:
/Users/haruka/Documents/Projects/resonatia-apertia-archivium/02_Albums/A001_Talune_GK67-C5288/20_Episodes/04_Sevu-Vami_GK67-C5288-R5513/04_Visuals/11_Generated-Assets/22_Youtube_Thumbnail_raw/20260811-natsuki-youtube-thumbnail-batch-02-screenprint/comfyui-evidence/be63327c-28e7-44f2-9abe-a18b925357fb.json

Five saved nodes: 76 LoadImage → 79 UpscaleModelLoader / 78 ImageUpscaleWithModel → 88 ImageScaleBy(area, 0.5) → 95 SaveImage.

Prompt ID: 5fb16003-9575-4462-9f2b-1e07766fa355
History: status_str=success, completed=true; output fetched through /view and decoded after download. Server log reports prompt executed in 29.24 seconds.

## Runtime and safe execution

User explicitly authorized starting the existing local ComfyUI in this continuation. Used its existing .venv/bin/python and main.py with shared models; input/output/user/temp directed to this authorized directory and custom nodes disabled. Runtime: ComfyUI 0.33.3, Python 3.13.12, torch 2.12.1, MPS available. The first dependency probe was contaminated by inherited Hermes Python package paths; Python -E correctly used the existing ComfyUI environment without changing global settings or installing anything. The initial object-info parser assumed a legacy options list and stopped before submission; actual COMBO options were read back and the parser corrected. No submission-intent existed at that point; no duplicate prompt was submitted.

Deduplication: checked target files, empty queue and history before submitting. Saved submission-intent.json before the unique POST; subsequent runs refuse to submit if it exists. Unknown status must be reconciled with saved prompt ID, never resubmitted.

Owned server process proc_bdd68443607a (pid 3250) was stopped through process_manage after successful output download and QA; no unattended job remains. No source images, other works, Remotion source or profile settings were modified.

## Visual QA

Personally inspected the full output and an original-resolution crop of the ribbon/book/mechanical junction. Four horns, four flowing ribbons, the open book and mechanical base remain intact and in the complete source layout. Warm ivory paper, forest-green engraved lines, brass accents and tiny orange indicators remain. No new text, people, UI, crop damage or major melted/ghosted edges observed. Crosshatching and page contours remain usable in the inspected crop. AI upscaling can regularize or sharpen fine ink/paper texture; no claim of recovering authentic missing source detail or pixel-identical texture. Final Remotion placement remains for the parent to validate.

## Saved evidence

workflow-api.json — exact submitted graph
preflight-result.json — queue/history dedup, runtime and model/source hashes
submission-intent.json / submission-receipt.json — single-submission guard and server receipt
history-result.json — successful exact prompt history
verification.json — independent decoded dimensions/mode, source unchanged, hashes and output reference
preflight.py / run-upscale.py — exercised execution scripts

Previous service-unavailable and workflow-discovery blockers are superseded by this completed continuation.

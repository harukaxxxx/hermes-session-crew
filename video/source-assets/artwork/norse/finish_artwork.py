"""Bounded local postprocessing; never generates artwork or accesses credentials."""
from pathlib import Path
import json
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/haruka/SessionCrew-Demo/artwork/norse')
SOURCE = Path('/Users/haruka/.hermes/profiles/makino-natsuki/cache/generated/images/openai_gpt-image-2.6-sunburst_20261110_231901_5ed87b15.png')
roster = json.loads(Path('/Users/haruka/SessionCrew-Demo/norse-roster.json').read_text())
assert len(roster) == 15 and len({r['id'] for r in roster}) == 15
raw = ROOT / 'raw'
raw.mkdir(exist_ok=True)
preserved = raw / 'norse-atlas-original.png'
shutil.copyfile(SOURCE, preserved)
im = Image.open(preserved)
im.load()
assert im.format == 'PNG' and im.size == (1024,1024), (im.format, im.size)
notes = [
    'One large head; eyepatch and raven visible. Distinct elderly silhouette.',
    'One large head; broad smiling beard and squared hammer visible.',
    'One large head; clean-shaven angular face and smoke ribbon visible.',
    'One large head; falcon feather cloak and round necklace visible.',
    'One large head; youthful wavy hair and boar brooch visible.',
    'One large head; mature face, braided crown and spindle visible.',
    'One large head; scarred warrior and wrapped forearm stump visible.',
    'One large head; watchful dark-skinned face and curved horn visible.',
    'One large head; pale flowing hair, radiant lines and collar sprig visible; botanical species not verifiable.',
    'One large head; weathered beard, waves and sail visible.',
    'One large head; dark braids, fur, bow and snowy peak visible.',
    'One large head; joyful curls and apple visible.',
    'One large head; elaborate braided beard and lyre visible.',
    'One large head; flowing pale hair and wheat visible; monochrome cannot literally show gold.',
    'One large head; split living/skeletal face visible, non-gory.'
]
manifest = json.loads((ROOT/'art-manifest.json').read_text())
entries = []
contact = Image.new('RGB',(1280,3*294),(18,18,20))
small = Image.new('RGB',(5*220,3*110),(25,25,28))
cd = ImageDraw.Draw(contact)
sd = ImageDraw.Draw(small)
font = ImageFont.load_default()
for i, r in enumerate(roster):
    row, col = divmod(i,4)
    box = (col*256,row*256,(col+1)*256,(row+1)*256)
    tile = im.crop(box).convert('RGB')
    dest = ROOT/(r['id']+'.png')
    tile.save(dest,'PNG')
    with Image.open(dest) as check:
        check.load()
        assert check.size == (256,256) and check.format == 'PNG'
    x,y = (i%5)*256,(i//5)*294
    contact.paste(tile,(x,y))
    cd.text((x+10,y+263),r['name'],fill='white',font=font)
    sx,sy = (i%5)*220,(i//5)*110
    thumb = tile.resize((34,34),Image.Resampling.LANCZOS)
    small.paste(thumb,(sx+12,sy+8))
    mask = Image.new('L',(34,34),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,33,33),radius=8,fill=255)
    small.paste(thumb,(sx+62,sy+8),mask)
    sd.text((sx+12,sy+53),r['name'],fill='white',font=font)
    entries.append({'id':r['id'],'name':r['name'],'path':str(dest),'dimensions':[256,256],
        'source':str(preserved),'crop_box_xyxy':list(box),'resampled':False,
        'status':'generated_decoded','qa':notes[i],
        'generation_provenance':'One original native image_generate atlas; row-major crop, no synthesized drawing or upscaling.'})
contact.save(ROOT/'contact-sheet.png')
small.save(ROOT/'qa-34px.png')
for p in [ROOT/'contact-sheet.png',ROOT/'qa-34px.png']:
    with Image.open(p) as check:
        check.load()
        assert check.format == 'PNG'
manifest.update({'status':'generated_postprocessed_pending_final_visual_qa','generated_count':15,
    'verified_avatar_count':15,'missing_avatar_count':0,'minimum_512px_met':False,
    'resolution_note':'Native tool returned 1024x1024 despite higher-resolution prompt; 4x4 atlas yields native 256x256 crops. No upscaling.',
    'blocker':None,
    'previous_blocker_resolution':'User supplied parent-approved preflight with exit_code=0; native image_generate subsequently succeeded.',
    'generation_provenance':{'tool':'image_generate','calls_submitted':1,'success':True,'effective_provider':'openai',
        'effective_model':'gpt-image-2.6-sunburst','effective_endpoint':'https://api.openai.com/v1',
        'endpoint_evidence':'Parent-approved preflight relayed by user; provider/model additionally confirmed by generation result.',
        'aspect_ratio':'square','size_returned':'1024x1024','quality_returned':None,
        'raw_outputs':[str(preserved)],'original_tool_output_path':str(SOURCE),
        'reference_image_urls':[manifest['references'][0]['image']],
        'prompt_path':str(ROOT/'generation-prompt.txt'),
        'note':'One successful native generation, 15 portrait cells plus one unused charcoal cell. Full generation prompt saved separately.'},
    'qa_summary':'Original atlas visually inspected cell by cell: all 15 distinct single-headed portraits, contained motifs, no text or duplicate heads. All 15 crops decoded as native 256x256 PNG. Final contact and 34px rounded previews pending visual inspection.',
    'contact_sheet':{'path':str(ROOT/'contact-sheet.png'),'dimensions':[1280,882],'status':'created_decoded'},
    'small_avatar_qa_preview':str(ROOT/'qa-34px.png'),'avatars':entries})
(ROOT/'art-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'count':len(entries),'ids':[r['id'] for r in entries],'dimensions':[256,256],
    'raw':str(preserved),'contact_sheet':str(ROOT/'contact-sheet.png'),'manifest':str(ROOT/'art-manifest.json'),
    'status':'decoded_all_15_final_visual_qa_pending'},indent=2))

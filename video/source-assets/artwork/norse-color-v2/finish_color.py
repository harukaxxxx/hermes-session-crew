"""Crop real edited artwork, preserve original receipt, and build review sheets. No color filters."""
from pathlib import Path
import json, shutil
from PIL import Image, ImageDraw, ImageFont
R=Path('/Users/haruka/SessionCrew-Demo/artwork/norse-color-v2')
V1=Path('/Users/haruka/SessionCrew-Demo/artwork/norse')
SRC=Path('/Users/haruka/.hermes/profiles/makino-natsuki/cache/generated/images/openai_gpt-image-2.6-sunburst_20261110_232857_03edd6c2.png')
roster=json.loads(Path('/Users/haruka/SessionCrew-Demo/norse-roster.json').read_text())
old=json.loads((V1/'art-manifest.json').read_text())
assert len(roster)==15 and [x['id'] for x in roster]==[x['id'] for x in old['avatars']]
(R/'raw').mkdir(exist_ok=True)
raw=R/'raw/norse-atlas-color-original.png'
shutil.copyfile(SRC,raw)
im=Image.open(raw); im.load()
base=Image.open(V1/'raw/norse-atlas-original.png'); base.load()
assert im.size==base.size==(1024,1024) and im.format=='PNG'
receipt={'success':True,'image':str(SRC),'model':'gpt-image-2.6-sunburst','prompt':(R/'generation-prompt.txt').read_text().rstrip('\n'),'aspect_ratio':'square','modality':'image','provider':'openai','size':'1024x1024','quality':None}
(R/'raw/generation-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
qa=[
('Eyepatch, long silver beard and raven retained; slate cloak, warm skin and gold clasp.','slate / warm ivory / gold'),
('Laughing broad face, braided beard and hammer retained; russet hair, petrol cloth, red hammer inset.','petrol / russet / vermilion'),
('Angular face, swept dark hair and smoke retained; aubergine fabric, olive skin and lime clasp, subtle pink smoke.','aubergine / olive / lime'),
('Upturned face, long waves, feathers and necklace retained; warm hair, muted peacock feathers, coral pendant.','peacock / honey / coral'),
('Youthful wavy-haired face and boar retained; olive cloth, tan skin and gold boar; requested violet enamel is not clearly visible.','olive / tan / gold'),
('Braided crown, mature face and spindle retained; muted wine cloth, jade earring and blue-green thread.','wine / taupe / jade'),
('Scarred face, cropped hair, fur and wrapped stump retained; oxblood cloth, iron-grey surfaces and orange seam.','oxblood / iron / orange'),
('Dark skin, cropped curls and horn retained; deep teal cloth, warm brass horn with orange band.','teal / umber / brass-orange'),
('Flax hair, youthful face and collar sprig retained; lavender cloak and vivid yellow-green sprig. Plant species not verified.','lavender / flax / yellow-green'),
('Elder face, grey hair, sea-wave cloak and sail retained; sea-green cloth, ivory waves, coral-orange sail.','sea-green / silver / coral'),
('Stern face, dark braids, fur, mountain and bow retained; muted cold blue cloth and raspberry bow grip.','glacial blue / grey / raspberry'),
('Smile, curls, apple and foliage retained; warm brown hair, sage cloak and yellow-red apple.','sage / chestnut / golden apple'),
('Older face, braided beard and lyre retained; burgundy cloth, ochre lyre with turquoise inlay.','burgundy / ochre / turquoise'),
('Smile, long hair and wheat retained; honey-gold hair, blue-violet cloth, cobalt clasp.','honey / blue-violet / cobalt'),
('Split living/skeletal face, long hair and clasp retained; muted plum-green shadows. Lime accent is tiny/weak rather than a strongly visible pop.','plum / ivory / muted green')]
contact=Image.new('RGB',(1280,882),(18,18,22)); cd=ImageDraw.Draw(contact)
preview=Image.new('RGB',(1100,330),(24,24,28)); pd=ImageDraw.Draw(preview)
compare=Image.new('RGB',(1536,5*278),(20,20,24)); dd=ImageDraw.Draw(compare)
font=ImageFont.load_default()
entries=[]
for i,r in enumerate(roster):
    y,x=divmod(i,4); box=(x*256,y*256,(x+1)*256,(y+1)*256)
    tile=im.crop(box).convert('RGB'); before=base.crop(box).convert('RGB')
    assert tile.tobytes()!=before.tobytes(),r['id']
    p=R/(r['id']+'.png'); tile.save(p,'PNG')
    with Image.open(p) as c: c.load(); assert c.size==(256,256) and c.format=='PNG'
    xx,yy=i%5*256,i//5*294; contact.paste(tile,(xx,yy)); cd.text((xx+10,yy+263),r['name'],font=font,fill='white')
    xx,yy=i%5*220,i//5*110
    t=tile.resize((34,34),Image.Resampling.LANCZOS)
    preview.paste(t,(xx+12,yy+8)); mask=Image.new('L',(34,34)); ImageDraw.Draw(mask).rounded_rectangle((0,0,33,33),radius=8,fill=255)
    preview.paste(t,(xx+62,yy+8),mask); pd.text((xx+12,yy+53),r['name'],font=font,fill='white')
    xx,yy=i%3*512,i//3*278; compare.paste(before,(xx,yy)); compare.paste(tile,(xx+256,yy)); dd.text((xx+8,yy+260),r['name']+' | v1 left / color right',font=font,fill='white')
    entries.append({'id':r['id'],'name':r['name'],'path':str(p),'dimensions':[256,256],'source':str(raw),'v1_source':str(V1/(r['id']+'.png')),'crop_box_xyxy':list(box),'resampled':False,'qa':{'visual_identity_motif_color':qa[i][0],'palette_observed':qa[i][1],'final_comparison_review':'pending','34px_review':'pending'},'status':'generated_color_edit_decoded'})
for name,obj in [('contact-sheet.png',contact),('qa-34px.png',preview),('qa-v1-v2-comparison.png',compare)]:
    obj.save(R/name)
    with Image.open(R/name) as c: c.load(); assert c.format=='PNG'
manifest={'request_id':'sessioncrew-norse-avatars-15-v2-color','status':'generated_pending_final_visual_qa','expected_count':15,'generated_count':len(entries),'missing_avatar_count':0,'dimensions_per_avatar':[256,256],'minimum_512px_met':False,'resampled':False,'generation_provenance':{'tool':'image_generate','operation':'edit','calls_submitted':1,'image_url':str(V1/'raw/norse-atlas-original.png'),'receipt_path':str(R/'raw/generation-receipt.json'),'raw_path':str(raw),'prompt_path':str(R/'generation-prompt.txt'),'provider':receipt['provider'],'model':receipt['model'],'size_returned':receipt['size'],'quality_returned':None},'references':old['references'],'references_note':'Prior official image study reused, not fetched again; only v1 original atlas supplied to this edit. No claim of official authorization.','layout':'4x4 row-major, final bottom-right cell empty; same roster order as v1','contact_sheet':{'path':str(R/'contact-sheet.png'),'dimensions':[1280,882]},'small_avatar_qa_preview':str(R/'qa-34px.png'),'identity_comparison_sheet':str(R/'qa-v1-v2-comparison.png'),'qa_summary':'Original edited atlas visually compared to v1: no major identity drift or layout failure seen. Native crop decoding passed for 15/15; final sheets pending inspection. Not pixel-exact preservation. Accent percentages are art direction, not measured guarantees.','blocker':None,'avatars':entries}
(R/'art-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'count':len(entries),'ids':[r['id'] for r in entries],'dimensions':[256,256],'raw':str(raw),'contact':str(R/'contact-sheet.png'),'comparison':str(R/'qa-v1-v2-comparison.png'),'manifest':str(R/'art-manifest.json'),'unchanged_v1':True},indent=2))

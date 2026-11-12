from pathlib import Path
import json, hashlib, shutil, time, urllib.request, urllib.parse
from PIL import Image
ROOT=Path(__file__).resolve().parent
BASE='http://127.0.0.1:8188'
RID='sessioncrew-video-light-hero-upscale2x'
SOURCE=ROOT.parent/'hero-light.png'
TEMPLATE=Path('/Users/haruka/Documents/Projects/resonatia-apertia-archivium/02_Albums/A001_Talune_GK67-C5288/20_Episodes/04_Sevu-Vami_GK67-C5288-R5513/04_Visuals/11_Generated-Assets/22_Youtube_Thumbnail_raw/20260811-natsuki-youtube-thumbnail-batch-02-screenprint/comfyui-evidence/be63327c-28e7-44f2-9abe-a18b925357fb.json')
def get(path):
    with urllib.request.urlopen(BASE+path, timeout=30) as r: return json.load(r)
def save(name,obj): (ROOT/name).write_text(json.dumps(obj,indent=2))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
assert not (ROOT/'submission-intent.json').exists(), 'Prior submission intent: reconcile, never resend'
assert not (ROOT/'hero-light-2x.png').exists()
source_hash=sha(SOURCE)
assert source_hash=='014a6a3118a932ac9404384950c2ca1364aae694008b0489fe6e16571bbbfe9a'
stats=get('/system_stats'); q=get('/queue'); history=get('/history')
assert not q.get('queue_running') and not q.get('queue_pending'), 'Queue busy: do not interfere'
assert RID not in json.dumps(history), 'Matching historical job: reconcile, never resend'
graph=json.loads(TEMPLATE.read_text())['workflow_api']
assert set(graph)=={'76','79','78','88','95'}
assert graph['79']['inputs']['model_name']=='4x-ultra-mix_balanced.pth'
assert graph['88']['inputs']['upscale_method']=='area' and graph['88']['inputs']['scale_by']==0.5
for cls in ['LoadImage','UpscaleModelLoader','ImageUpscaleWithModel','ImageScaleBy','SaveImage']:
    info=get('/object_info/'+cls)
    assert cls in info, cls
    if cls=='UpscaleModelLoader':
        spec=info[cls]['input']['required']['model_name']
        options=spec[1]['options'] if spec[0]=='COMBO' else spec[0]
        assert '4x-ultra-mix_balanced.pth' in options
model=Path('/Users/haruka/ComfyUI-Shared/models/upscale_models/4x-ultra-mix_balanced.pth')
model_hash=sha(model)
assert model_hash=='e23ca000107aae95ec9b8d7d1bf150f7884f1361cd9d669bdf824d72529f0e26'
shutil.copyfile(SOURCE,ROOT/'input/hero-light.png')
graph['76']['inputs']['image']='hero-light.png'
graph['95']['inputs']['filename_prefix']=RID
save('workflow-api.json',graph)
save('preflight-result.json',{'source_sha256':source_hash,'model_sha256':model_hash,'queue':q,'history_dedup_match':False,'system_stats':stats,'workflow_source':str(TEMPLATE)})
save('submission-intent.json',{'request_id':RID,'state':'submitting_once','warning':'Never resubmit on unknown result'})
req=urllib.request.Request(BASE+'/prompt', data=json.dumps({'prompt':graph,'client_id':RID}).encode(),headers={'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(req,timeout=30) as r: receipt=json.load(r)
save('submission-receipt.json',receipt)
pid=receipt['prompt_id']
print('Submitted prompt_id='+pid,flush=True)
for _ in range(240):
    h=get('/history/'+pid)
    if pid in h:
        item=h[pid]
        save('history-result.json',item)
        if item.get('status',{}).get('completed'):
            assert item['status']['status_str']=='success', item['status']
            break
        if item.get('status',{}).get('status_str')=='error': raise RuntimeError('ComfyUI job failed; see saved history')
    time.sleep(1)
else: raise RuntimeError('Wait expired; reconcile existing prompt_id, never resubmit')
ref=item['outputs']['95']['images'][0]
url=BASE+'/view?'+urllib.parse.urlencode(ref)
with urllib.request.urlopen(url,timeout=60) as r: data=r.read()
out=ROOT/'hero-light-2x.png'
with out.open('xb') as f: f.write(data)
with Image.open(out) as im:
    im.load()
    assert im.format=='PNG' and im.size==(3072,2048) and im.mode=='RGB'
    dimensions=list(im.size); mode=im.mode
assert sha(SOURCE)==source_hash
result={'request_id':RID,'prompt_id':pid,'status':'success','submitted_jobs':1,'workflow_api':graph,'method':'AI super-resolution 4x-ultra-mix_balanced.pth at 4x, then area scaling 0.5; net 2x','source_sha256':source_hash,'output_sha256':sha(out),'output':str(out),'dimensions':dimensions,'mode':mode,'source_unchanged':True,'model_sha256':model_hash,'comfy_output_reference':ref}
save('verification.json',result)
print(json.dumps(result),flush=True)

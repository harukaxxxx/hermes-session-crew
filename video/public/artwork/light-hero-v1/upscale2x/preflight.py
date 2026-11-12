from pathlib import Path
import hashlib
import json
from PIL import Image
import torch
ROOT = Path(__file__).resolve().parent
source = ROOT.parent / 'hero-light.png'
with Image.open(source) as im:
    im.load()
    assert im.size == (1536, 1024) and im.mode == 'RGB'
h = hashlib.sha256(source.read_bytes()).hexdigest()
assert h == '014a6a3118a932ac9404384950c2ca1364aae694008b0489fe6e16571bbbfe9a'
for name in ('input', 'server-output', 'runtime-user', 'temp'):
    (ROOT / name).mkdir(exist_ok=True)
print(json.dumps({'source_sha256': h, 'torch': torch.__version__, 'Pillow': Image.__version__, 'mps': torch.backends.mps.is_available()}))

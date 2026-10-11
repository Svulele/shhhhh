from pathlib import Path
import html, re, struct
root=Path(__file__).resolve().parent.parent
pairs=[]
for after in sorted((root/'after').glob('*.png')):
 before=root/'before'/after.name
 if not before.exists(): continue
 match=re.match(r'(.+)-(\d+)x(\d+)-(light|dark)\.png$',after.name)
 if not match: continue
 screen,width,height,theme=match.groups()
 pairs.append((screen,width+'x'+height,theme,before,after))
sizes=sorted({p[1] for p in pairs},key=lambda s:tuple(map(int,s.split('x'))))
screens=sorted({p[0] for p in pairs})
parts=['''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shhhhh mobile — before / after</title><style>body{margin:0;background:#f4f2fb;color:#262239;font:16px/1.6 system-ui,sans-serif}header{position:sticky;top:0;z-index:2;background:#f4f2fbf2;padding:16px 24px;border-bottom:1px solid #ddd}h1{margin:0;font-size:clamp(22px,4vw,32px)}p{margin:8px 0}label{display:inline-flex;gap:8px;align-items:center;margin:8px 16px 0 0}select,input{font:inherit;min-height:44px;max-width:100%;padding:8px;border:1px solid #bbb;border-radius:10px}main{max-width:1200px;margin:auto;padding:20px}.pair{margin:0 0 40px}h2{font-size:19px}.images{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0;background:white;border-radius:16px;padding:16px;overflow:hidden}figcaption{font-weight:700;margin-bottom:12px}figure>a{display:block;max-width:100%}img{display:block;width:auto;max-width:100%;height:auto;margin:auto;border:1px solid #ddd;border-radius:8px}[hidden]{display:none!important}a{color:#5c49b9;display:inline-flex;min-height:44px;align-items:center}footer{padding:24px}@media(max-width:560px){header{position:static}.images{grid-template-columns:1fr}}</style><header><h1>Shhhhh mobile: before / after</h1><p>Chrome touch emulation. Keyboard captures use viewport proxies, not native keyboards. Synthetic study data; random book-cover colors can vary.</p><a href="README.md">Read findings and verification limits</a><div><label>Viewport<select id="size"><option value="">All sizes</option>''']
for size in sizes:parts.append(f'<option {"selected" if size=="320x568" else ""}>{size}</option>')
parts.append('</select></label><label>Theme<select id="theme"><option value="">Both</option><option selected>light</option><option>dark</option></select></label><label>Screen<select id="screen"><option value="">All screens</option>')
for screen in screens:parts.append(f'<option>{html.escape(screen)}</option>')
parts.append('</select></label><label>Find<input id="search" type="search" placeholder="reader, keyboard, focus…"></label></div><p id="count" role="status"></p></header><main>')
for screen,size,theme,before,after in pairs:
 title=f'{screen} · {size} · {theme}'
 parts.append(f'<section class="pair" data-size="{size}" data-theme="{theme}" data-screen="{html.escape(screen)}"><h2>{html.escape(title)}</h2><div class="images">')
 for name,p in [('Before',before),('After',after)]:
  w,h=struct.unpack('>II',p.read_bytes()[16:24]);rel=p.relative_to(root).as_posix()
  parts.append(f'<figure><figcaption>{name}</figcaption><a href="{rel}"><img src="{rel}" width="{w}" height="{h}" loading="lazy" alt="{html.escape(title)} — {name.lower()}"></a></figure>')
 parts.append('</div></section>')
parts.append('''</main><footer>Native iOS/Android keyboards, cutouts, native selection menus and Safari/Samsung Internet/Firefox remain to be tested on physical devices.</footer><script>const nodes=[...document.querySelectorAll('.pair')],controls=['size','theme','screen','search'].map(id=>document.getElementById(id));function filter(){const[s,t,c,q]=controls.map(el=>el.value.toLowerCase());let n=0;for(const el of nodes){el.hidden=!!((s&&el.dataset.size!==s)||(t&&el.dataset.theme!==t)||(c&&el.dataset.screen.toLowerCase()!==c)||(q&&!el.textContent.toLowerCase().includes(q)));if(!el.hidden)n++}document.getElementById('count').textContent=n+' comparisons shown · '+nodes.length+' total'}controls.forEach(el=>el.addEventListener('input',filter));filter()</script></html>''')
(root/'gallery.html').write_text(''.join(parts))
print(f'Built gallery: {len(pairs)} paired comparisons')

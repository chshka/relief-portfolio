"""Create a fresh local site; user data is escaped and no original artwork is bundled."""
import argparse,json,shutil,html,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--profile',required=True);p.add_argument('--out',required=True);p.add_argument('--mode',choices=['single','gallery'],default='single');a=p.parse_args()
source=Path(a.profile).resolve();data=json.loads(source.read_text(encoding='utf-8-sig'));out=Path(a.out).resolve()
if out.exists():p.error('Output must be a new directory; existing projects are not overwritten')
gallery=[]
if a.mode=='gallery':
 panels=data.get('panels',[])
 if not isinstance(panels,list) or len(panels)<2:p.error('Gallery requires at least two panels; use single for one background')
 for i,panel in enumerate(panels):
  if not isinstance(panel,dict):p.error('Panel must be an object')
  aspect=panel.get('aspect')
  if isinstance(aspect,bool) or not isinstance(aspect,(float,int)) or not .1<=aspect<=5:p.error('Panel aspect must be width / height between .1 and 5')
  entry={'id':str(panel.get('id',f'panel-{i+1}')),'aspect':aspect,'height':2/aspect}
  for key in ('background','height','model'):
   value=panel.get(key,'')
   if key=='model' and not value:continue
   path=(source.parent/value).resolve()
   if not value or not path.is_file():p.error('Missing panel asset: '+key)
   if path.suffix.lower() not in (('.glb',) if key=='model' else ('.png','.jpg','.jpeg','.webp')):p.error('Invalid panel asset format')
   entry[key+'_path']=path
  gallery.append(entry)
 data.update({k:str(gallery[0][k+'_path']) if k+'_path' in gallery[0] else '' for k in ('background','height','model')})
assets={}
for key in ('background','height','emblem','model'):
 value=data.get(key,'')
 if key=='model' and not value:continue
 if not value:p.error('Missing '+key+' asset')
 path=(source.parent/value).resolve()
 if not path.is_file():p.error('Asset does not exist: '+str(path))
 if path.suffix.lower() not in (('.glb',) if key=='model' else ('.png','.jpg','.jpeg','.webp','.svg')):p.error('Unsupported asset format: '+key)
 assets[key]=path
if not data.get('name') or not data.get('nickname'):p.error('name and nickname are required')
if not isinstance(data.get('tags',[]),list) or not isinstance(data.get('projects',[]),list):p.error('tags and projects must be lists')
if any(not isinstance(item,dict) for item in data.get('projects',[])):p.error('Each project must be an object')
email=str(data.get('email',''))
if email and not re.fullmatch(r'[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+',email):p.error('Email must be a plain mailbox address')
shutil.copytree(Path(__file__).resolve().parents[1]/'assets'/('gallery-starter' if a.mode=='gallery' else 'starter'),out);dest=out/'dist'/'assets';dest.mkdir()
values={k:html.escape(str(data.get(k,'')),quote=True) for k in ('name','nickname','identity','headline','tagline','about','closing')}
for k,path in assets.items():
 name=k+path.suffix.lower();shutil.copy2(path,dest/name);values[k+'_url']='./assets/'+name
values['model_attr']='model-src="'+values['model_url']+'"' if 'model' in assets else ''
values['tags_html']=''.join('<li>'+html.escape(str(t))+'</li>' for t in data.get('tags',[]))
values['projects_html']=''.join('<article><h3>'+html.escape(str(t.get('title','')))+ '</h3><p>'+html.escape(str(t.get('description','')))+'</p></article>' for t in data.get('projects',[]))
email=str(data.get('email',''));values['email_html']=''
if email:
 if not re.fullmatch(r'[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+',email):p.error('Email must be a plain mailbox address')
 values['email_html']='<a class="email reveal" href="mailto:'+email+'">'+email+'</a>'
if a.mode=='gallery':
 records=[]
 for i,entry in enumerate(gallery):
  record={k:entry[k] for k in ('id','aspect','height')}
  for key,target in [('background','image'),('height','depth'),('model','model')]:
   path=entry.get(key+'_path')
   if path:
    name=f'panel-{i+1}-{key}'+path.suffix.lower();shutil.copy2(path,dest/name);record[target]='./assets/'+name
  records.append(record)
 (out/'dist/gallery-assets.js').write_text('export const panels='+json.dumps(records,ensure_ascii=True)+';\n',encoding='utf8')
 # Fit four content blocks within the first six panels, or the supplied count.
 span=sum(e['aspect'] for e in gallery[:6])
 css='\n@media(min-width:1024px){\n'
 for index,selector in enumerate(['.hero','.about','.projects','.contact']):
  css+=selector+'{left:calc(100vh * '+str(span*(index/4)+.04)+');width:calc(100vh * '+str(span/4-.08)+');}\n'
 css+='}\n'
 with (out/'dist/style.css').open('a',encoding='utf8') as fh:fh.write(css)
f=out/'dist'/'index.html';s=f.read_text(encoding='utf-8');s=re.sub(r'\{\{([a-z_]+)\}\}',lambda m:values[m[1]],s);f.write_text(s,encoding='utf-8');print('Created '+str(out)+'; run npm run dev in that directory')

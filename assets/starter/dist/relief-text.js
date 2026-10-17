/** GPU text compositing. DOM remains the semantic/layout/interaction source. */
export function linkReliefText(background){
 const canvas=document.createElement('canvas');canvas.className='gpu-text-layer';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false});
 if(!gl){canvas.remove();return ()=>{}}
 const vs='attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
 const fs=`precision highp float;varying vec2 uv;uniform sampler2D text,flow;uniform vec2 size;uniform float amplitude;
 void main(){vec2 velocity=(texture2D(flow,uv).rg-vec2(128./255.))*2.;vec2 direction=velocity*amplitude/size;vec4 color=vec4(0.);for(int i=0;i<20;i++){float t=float(i)/19.;color+=texture2D(text,uv-direction*(.65+t*.7));}gl_FragColor=color/20.;}`;
 const program=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){canvas.remove();return ()=>{}}gl.attachShader(program,s);gl.deleteShader(s)}
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){canvas.remove();return ()=>{}}
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const makeTexture=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const [k,v] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t};
 const text=makeTexture(),flow=makeTexture(),u=Object.fromEntries(['text','flow','size','amplitude'].map(n=>[n,gl.getUniformLocation(program,n)]));
 const surface=document.createElement('canvas'),ctx=surface.getContext('2d'),pixels=new Uint8Array(192*192*4);
 const nodes=[...document.querySelectorAll('main h1,main h2,main p,main .tags,main .email,main .round-link,main .section-label>span,.hero-foot,.footer-bottom')];
 let dirty=true,last=0,selecting=false,lost=false;
 const entries=nodes.map(node=>({node,raster:document.createElement('canvas')}));
 const mark=()=>dirty=true;addEventListener('resize',mark);document.fonts.ready.then(mark);
 const observer=new ResizeObserver(mark);nodes.forEach(n=>observer.observe(n));
 const mutation=new MutationObserver(mark);nodes.forEach(n=>mutation.observe(n,{childList:true,characterData:true,subtree:true}));
 const showDom=()=>{canvas.style.visibility='hidden';nodes.forEach(n=>n.classList.remove('gpu-text-source'))};
 const selection=()=>{selecting=!!getSelection()?.toString();if(selecting)showDom()};document.addEventListener('selectionchange',selection);
 const capture=(entry,ratio)=>{
  const {node,raster}=entry,bounds=node.getBoundingClientRect();raster.width=Math.max(1,Math.ceil(bounds.width*ratio));raster.height=Math.max(1,Math.ceil(bounds.height*ratio));const c=raster.getContext('2d');c.scale(ratio,ratio);
  const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let textNode;
  while(textNode=walker.nextNode()){
   const style=getComputedStyle(textNode.parentElement);if(style.display==='none'||style.visibility==='hidden')continue;
   c.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;c.fillStyle=style.color;c.textBaseline='alphabetic';
   let offset=0;for(const char of textNode.textContent){const range=document.createRange();range.setStart(textNode,offset);offset+=char.length;range.setEnd(textNode,offset);const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;const metrics=c.measureText(char);const descent=metrics.fontBoundingBoxDescent??parseFloat(style.fontSize)*.2;c.fillText(char,r.left-bounds.left,r.bottom-bounds.top-descent)}
  }
 };
 const onFrame=({detail:d})=>{
  if(!d.enabled||selecting||lost){showDom();return;}if(d.time-last<(d.desktop?33:50))return;last=d.time;
  try{
   const ratio=Math.min(devicePixelRatio||1,1.5),w=Math.round(innerWidth*ratio),h=Math.round(innerHeight*ratio);
   if(canvas.width!==w||canvas.height!==h){canvas.width=surface.width=w;canvas.height=surface.height=h;dirty=true}
   if(dirty){for(const e of entries)capture(e,ratio);dirty=false}
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.scale(ratio,ratio);
   for(const {node,raster} of entries){const r=node.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)continue;let opacity=1;for(let p=node;p&&p!==document.body;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);ctx.globalAlpha=opacity;ctx.drawImage(raster,r.left,r.top,r.width,r.height)}ctx.globalAlpha=1;
   const bg=background.gl,previous=bg.getParameter(bg.FRAMEBUFFER_BINDING);bg.bindFramebuffer(bg.FRAMEBUFFER,background.textFlowField.targets[0].framebuffer);bg.readPixels(0,0,192,192,bg.RGBA,bg.UNSIGNED_BYTE,pixels);bg.bindFramebuffer(bg.FRAMEBUFFER,previous);
   gl.viewport(0,0,w,h);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,text);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,surface);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,flow);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,192,192,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   gl.uniform1i(u.text,0);gl.uniform1i(u.flow,1);gl.uniform2f(u.size,innerWidth,innerHeight);gl.uniform1f(u.amplitude,d.desktop?10:5);
   gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
   canvas.dataset.renderer='gpu';canvas.dataset.samples='20';canvas.style.visibility='visible';nodes.forEach(n=>n.classList.add('gpu-text-source'));
  }catch(error){showDom();canvas.dataset.renderer='fallback';console.warn('Text compositing fallback',error)}
 };
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;showDom()});
 canvas.addEventListener('webglcontextrestored',()=>{cleanup();linkReliefText(background)});
 background.addEventListener('relief-frame',onFrame);
 const cleanup=()=>{showDom();background.removeEventListener('relief-frame',onFrame);removeEventListener('resize',mark);document.removeEventListener('selectionchange',selection);observer.disconnect();mutation.disconnect();if(!lost){gl.deleteTexture(text);gl.deleteTexture(flow);gl.deleteBuffer(buffer);gl.deleteProgram(program)}canvas.remove()};
 return cleanup;
}

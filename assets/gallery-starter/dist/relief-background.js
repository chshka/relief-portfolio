import {panels} from './gallery-assets.js';
import {loadPlasterMesh} from './relief-model.js';
import {ReliefAutoplay,reliefVertex,buildReliefMesh} from './relief-surface.js';
import {ReliefFlow,reliefFragment} from './relief-flow.js';

/** Reusable image-relief renderer. Desktop maps a single relief to the document. */
export class ReliefBackground extends HTMLElement {
  static observedAttributes=['src','depth-src','model-src','paused','strength'];
  connectedCallback(){
    if(this.canvas)return;
    this.canvas=document.createElement('canvas');this.append(this.canvas);
    this.pointer=[.5,.5];this.target=[.5,.5];this.progress=0;this.lastTime=0;this.pointerActive=false;this.lost=false;
    this.autoplay=new ReliefAutoplay();this.startedAt=performance.now();this.lastInteraction=0;this.lastTextPointer=[.5,.5];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.desktopQuery=matchMedia('(min-width:1024px)');
    this.controller=new AbortController();const options={signal:this.controller.signal};
    addEventListener('resize',()=>this.resize(),options);
    const track=(x,y)=>{this.target=[x/innerWidth,1-y/innerHeight];this.pointerActive=true;this.lastInteraction=performance.now();this.animate()};
    addEventListener('pointermove',e=>{if(e.pointerType!=='touch')track(e.clientX,e.clientY)},options);
    // Passive Touch Events continue during native scrolling after pointercancel.
    const touch=e=>{const t=e.touches[0];if(t){this.touching=true;track(t.clientX,t.clientY)}};
    const release=e=>{if(e.touches.length){touch(e);return;}this.touching=false;this.pointerActive=false;this.lastInteraction=performance.now();this.animate()};
    addEventListener('touchstart',touch,{...options,passive:true});
    addEventListener('touchmove',touch,{...options,passive:true});
    addEventListener('touchend',release,{...options,passive:true});
    addEventListener('touchcancel',release,{...options,passive:true});
    document.documentElement.addEventListener('pointerleave',()=>{if(!this.touching)this.pointerActive=false},options);
    addEventListener('scroll',()=>this.animate(),{...options,passive:true});
    document.addEventListener('visibilitychange',()=>{this.lastTime=0;cancelAnimationFrame(this.frame);if(!document.hidden)this.animate()},options);
    this.reduced.addEventListener('change',()=>{this.flowField?.reset();this.textFlowField?.reset();this.animate()},options);
    this.desktopQuery.addEventListener('change',()=>this.resize(),options);
    this.observer=new ResizeObserver(()=>this.animate());this.observer.observe(document.body);
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(this.frame);this.lost=true;this.items=[];this.generation=(this.generation||0)+1;this.textures=null;this.mesh=null;this.flowField=null;this.textFlowField=null;this.dataset.depth='none';this.dispatchEvent(new CustomEvent('relief-frame',{detail:{enabled:false}}));this.canvas.style.opacity=0;this.dataset.renderer='fallback'},options);
    this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.initialize()},options);
    this.initialize();
  }
  attributeChangedCallback(name){if(!this.canvas)return;if(name==='src'||name==='depth-src'||name==='model-src')this.load();else{if(!this.lost)this.flowField?.reset();this.textFlowField?.reset();this.animate()}}
  initialize(){
    try{
      const gl=this.canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL unavailable');this.gl=gl;
      const vertex=(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>0?"#define VERTEX_FLOW\n":"")+reliefVertex;
      this.program=gl.createProgram();
      for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,reliefFragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(this.program,shader);gl.deleteShader(shader)}
      gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      this.uniforms=Object.fromEntries(['image','depth','flow','resolution','dimensions','depthDimensions','pointer','progress','clock','strength','hasDepth','desktop','documentHeight','viewportHeight','scrollTop','revealEnabled','plaster','panel'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
      this.flowField=new ReliefFlow(gl,this.buffer,true);this.textFlowField=new ReliefFlow(gl,this.buffer);this.resize();this.load();
    }catch(error){this.dataset.renderer='fallback';this.canvas.style.display='none';this.load();this.dispatchEvent(new CustomEvent('relief-error',{detail:String(error)}))}
  }
  textureFor(image,unit){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);for(const [key,value] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])gl.texParameteri(gl.TEXTURE_2D,key,value);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);return t}
  load(){
    this.generation=(this.generation||0)+1;
    for(const p of this.items||[]){if(!this.lost){p.textures?.forEach(t=>this.gl?.deleteTexture(t));if(p.mesh)this.gl?.deleteBuffer(p.mesh.buffer)}}
    this.items=panels.map(p=>({...p}));this.dimensions=[2,panels[0].height];
    this.resize();this.dataset.renderer=this.gl?'webgl':'fallback';
    this.style.backgroundImage='none';
    if(!this.fallback){this.fallback=document.createElement('div');this.fallback.className='gallery-fallback';this.append(this.fallback)}
    this.fallback.replaceChildren(...panels.map(p=>{const img=new Image();img.src=p.image;img.alt='';img.loading='lazy';return img}));
    this.ensureNearby();
  }
  async loadPanel(item){
    if(item.loading||item.mesh||item.error||!this.gl||this.lost)return;
    item.loading=true;const generation=this.generation,gl=this.gl;
    const image=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Asset unavailable: '+url));im.src=url});
    try{
      const [color,depth]=await Promise.all([image(item.image),image(item.depth)]);
      if(generation!==this.generation||this.lost)return;
      item.textures=[this.textureFor(color,0),this.textureFor(depth,1)];item.depthDimensions=[depth.naturalWidth,depth.naturalHeight];
      item.mesh=item.model?await loadPlasterMesh(gl,item.model,item.height):buildReliefMesh(gl,depth);
      if(generation!==this.generation||this.lost)return;
      this.checkReady();this.animate();
    }catch(e){item.error=true;this.dataset.assetError=item.id;this.dispatchEvent(new CustomEvent('relief-error',{detail:String(e)}))}
    finally{item.loading=false}
  }
  checkReady(){
    const initial=this.items.filter(p=>p.start<(this.desktopQuery.matches?innerWidth:innerHeight));
    if(initial.every(p=>p.mesh)){this.dataset.depth='ready';this.dataset.model='ready';this.hasDepth=1;this.mesh=this.items[0].mesh;this.textures=this.items[0].textures;}
  }
  ensureNearby(){
    if(!this.items)return;const desktop=this.desktopQuery.matches,offset=desktop?scrollX:scrollY,extent=desktop?innerWidth:innerHeight;
    for(const p of this.items){
      if(p.start<offset+extent*2&&p.start+p.length>offset-extent)this.loadPanel(p);
      else if(p.mesh&&!p.loading&&(p.start>offset+extent*3||p.start+p.length<offset-extent*2)){this.gl.deleteBuffer(p.mesh.buffer);p.textures.forEach(t=>this.gl.deleteTexture(t));p.mesh=null;p.textures=null;}
    }
  }
  resize(){
    if(this.items){let start=0;const desktop=this.desktopQuery.matches;
      for(const p of this.items){p.start=start;p.length=desktop?innerHeight*p.aspect:innerWidth/p.aspect;start+=p.length}
      document.documentElement.style.setProperty('--gallery-length',start+'px');
      document.documentElement.style.setProperty('--panel-width',innerHeight*panels[0].aspect+'px');
      this.total=start;this.ensureNearby();
    }
    if(this.gl){const ratio=Math.min(devicePixelRatio||1,this.desktopQuery.matches?1.25:1.5);this.canvas.width=Math.round(innerWidth*ratio);this.canvas.height=Math.round(innerHeight*ratio)}this.animate()
  }
  draw(time=performance.now()){
    if(!this.dimensions)return;
    const documentHeight=document.documentElement.scrollHeight;
    const desktop=this.desktopQuery.matches,offset=desktop?scrollX:scrollY;
    this.dataset.scrollMode=desktop?'horizontal':'vertical';
    this.ensureNearby();
    if(this.fallback)this.fallback.style.transform=desktop?`translateX(${-scrollX}px)`:`translateY(${-scrollY}px)`;
    if(!this.gl||!this.flowField||this.lost){this.dispatchEvent(new CustomEvent('relief-frame',{detail:{enabled:false}}));return;}
    const gl=this.gl,u=this.uniforms,moving=!this.hasAttribute('paused')&&!this.reduced.matches;
    const dt=Math.min(50,Math.max(1,time-(this.lastTime||time-16.67)));this.lastTime=time;
    const auto=moving&&!document.documentElement.classList.contains('loading')&&time-this.startedAt>1500?this.autoplay.sample(time):null;
    const active=moving&&!document.documentElement.classList.contains('loading')&&this.pointerActive&&(this.touching||time-this.lastInteraction<900);
    const source=this.target;
    this.pointer=this.pointer.map((v,i)=>moving?v+(source[i]-v)*(1-Math.exp(-dt/110)):.5);
    this.flowField.update(this.pointer,dt,moving,active,auto);
    this.textFlowField.update(this.pointer,dt,moving,active);
    this.dataset.autoActive=String(!!auto?.active);
    this.dataset.interaction=!moving?'paused':active?(this.touching?'touch':'pointer'):auto?'auto':'intro';
    const velocity=this.pointer.map((v,i)=>(v-this.lastTextPointer[i])*1000/dt);this.lastTextPointer=[...this.pointer];
    this.dispatchEvent(new CustomEvent('relief-frame',{detail:{enabled:moving,desktop,active,pointer:[...this.pointer],velocity,dt,time,auto:!!auto?.active}}));
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(1,1,1,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.enable(gl.DEPTH_TEST);
    gl.uniform1f(u.plaster,1);gl.uniform1i(u.image,0);gl.uniform1i(u.depth,1);gl.uniform1i(u.flow,2);gl.uniform2f(u.resolution,this.canvas.width,this.canvas.height);gl.uniform2f(u.pointer,...this.pointer);gl.uniform1f(u.clock,moving?time*.001:0);
    gl.uniform1f(u.strength,moving?Number(this.getAttribute('strength')||.7):0);gl.uniform1f(u.hasDepth,1);gl.uniform1f(u.revealEnabled,moving?1:0);
    let visible=0;
    for(const p of this.items){
      if(p.start+p.length<offset||p.start>offset+(desktop?innerWidth:innerHeight)||!p.mesh)continue;
      visible++;gl.bindBuffer(gl.ARRAY_BUFFER,p.mesh.buffer);const a=gl.getAttribLocation(this.program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,0,0);
      [p.textures[0],p.textures[1],this.flowField.texture].forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t)});
      gl.uniform2f(u.dimensions,2,p.height);gl.uniform2f(u.depthDimensions,...p.depthDimensions);
      gl.uniform4f(u.panel,desktop?(p.start-offset)/innerWidth:0,desktop?0:(p.start-offset)/innerHeight,desktop?p.length/innerWidth:1,desktop?1:p.length/innerHeight);
      gl.drawArrays(gl.TRIANGLES,0,p.mesh.count);
    }
    gl.disable(gl.DEPTH_TEST);this.dataset.visiblePanels=String(visible);
  }

  animate(){cancelAnimationFrame(this.frame);if(!this.isConnected||document.hidden)return;const tick=time=>{this.draw(time);if(this.gl&&!this.lost&&!this.hasAttribute('paused')&&!this.reduced.matches)this.frame=requestAnimationFrame(tick)};this.frame=requestAnimationFrame(tick)}
  disconnectedCallback(){cancelAnimationFrame(this.frame);this.controller?.abort();this.observer?.disconnect();if(this.gl&&!this.lost){this.textures?.forEach(t=>this.gl.deleteTexture(t));this.flowField?.destroy();this.textFlowField?.destroy();if(this.mesh)this.gl.deleteBuffer(this.mesh.buffer);this.mesh=null;this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program)}this.canvas?.remove();this.canvas=null;this.gl=null;this.dimensions=null;this.textures=null;this.flowField=null;this.generation=(this.generation||0)+1}
}
customElements.define('relief-background',ReliefBackground);

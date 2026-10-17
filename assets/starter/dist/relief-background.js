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
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(this.frame);this.lost=true;this.generation=(this.generation||0)+1;this.textures=null;this.mesh=null;this.flowField=null;this.textFlowField=null;this.dataset.depth='none';this.dispatchEvent(new CustomEvent('relief-frame',{detail:{enabled:false}}));this.canvas.style.opacity=0;this.dataset.renderer='fallback'},options);
    this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.initialize()},options);
    this.initialize();
  }
  attributeChangedCallback(name){if(!this.canvas)return;if(name==='src'||name==='depth-src'||name==='model-src')this.load();else{if(!this.lost)this.flowField?.reset();this.textFlowField?.reset();this.animate()}}
  initialize(){
    try{
      const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');this.gl=gl;
      const vertex=(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>0?"#define VERTEX_FLOW\n":"")+reliefVertex;
      this.program=gl.createProgram();
      for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,reliefFragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(this.program,shader);gl.deleteShader(shader)}
      gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      this.uniforms=Object.fromEntries(['image','depth','flow','resolution','dimensions','depthDimensions','pointer','progress','clock','strength','hasDepth','desktop','documentHeight','viewportHeight','scrollTop','revealEnabled','plaster'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
      this.flowField=new ReliefFlow(gl,this.buffer);this.textFlowField=new ReliefFlow(gl,this.buffer);this.resize();this.load();
    }catch(error){this.dataset.renderer='fallback';this.canvas.style.display='none';this.load();this.dispatchEvent(new CustomEvent('relief-error',{detail:String(error)}))}
  }
  textureFor(image,unit){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);for(const [key,value] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])gl.texParameteri(gl.TEXTURE_2D,key,value);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);return t}
  load(){
    const src=this.getAttribute('src');if(!src)return;this.style.backgroundImage=`url(${JSON.stringify(src)})`;
    const generation=this.generation=(this.generation||0)+1;const image=new Image();
    image.onload=()=>{
      if(generation!==this.generation||!this.isConnected)return;
      this.dimensions=[image.naturalWidth,image.naturalHeight];this.resize();
      if(!this.gl||!this.flowField||this.lost)return;
      const gl=this.gl;this.textures?.forEach(t=>gl.deleteTexture(t));this.textures=[this.textureFor(image,0),this.textureFor(image,1)];this.hasDepth=0;this.depthDimensions=this.dimensions;this.dataset.depth='none';
      const depthSrc=this.getAttribute('depth-src');
      if(depthSrc){const depthImage=new Image();depthImage.onload=()=>{if(generation!==this.generation||!this.isConnected||this.lost)return;gl.deleteTexture(this.textures[1]);this.textures[1]=this.textureFor(depthImage,1);this.depthDimensions=[depthImage.naturalWidth,depthImage.naturalHeight];if(this.mesh)gl.deleteBuffer(this.mesh.buffer);this.mesh=buildReliefMesh(gl,depthImage);this.dataset.geometry=String(this.mesh.triangles);this.hasDepth=1;this.startedAt=performance.now();if(!this.pointerActive){this.flowField.reset();this.textFlowField.reset();}this.dataset.depth='ready';this.loadModel(generation);this.animate()};depthImage.onerror=()=>{if(generation===this.generation){this.dataset.depth='error';this.dispatchEvent(new CustomEvent('relief-error',{detail:'Height map unavailable'}))}};depthImage.src=depthSrc}
      this.dataset.renderer='webgl';this.canvas.style.opacity=1;this.canvas.style.display='block';this.animate();
    };
    image.onerror=()=>{this.dataset.renderer='error';this.dispatchEvent(new CustomEvent('relief-error',{detail:'Image unavailable'}))};image.src=src;
  }
  async loadModel(generation){
    const url=this.getAttribute('model-src');if(!url)return;this.dataset.model='loading';
    try{const gl=this.gl,mesh=await loadPlasterMesh(gl,url);if(generation!==this.generation||this.lost||!this.isConnected){if(!this.lost)gl.deleteBuffer(mesh.buffer);return;}if(this.mesh)gl.deleteBuffer(this.mesh.buffer);this.mesh=mesh;this.dataset.geometry=String(mesh.triangles);this.dataset.model='ready';this.animate()}
    catch(error){if(generation!==this.generation)return;this.dataset.model='fallback';this.dispatchEvent(new CustomEvent('relief-error',{detail:String(error)}))}
  }
  resize(){if(this.dimensions)document.documentElement.style.setProperty('--relief-natural-height',`${Math.round(innerWidth*this.dimensions[1]/this.dimensions[0])}px`);if(this.gl){const ratio=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(innerWidth*ratio);this.canvas.height=Math.round(innerHeight*ratio)}this.animate()}
  draw(time=performance.now()){
    if(!this.dimensions)return;
    const documentHeight=document.documentElement.scrollHeight,range=documentHeight-innerHeight;
    this.progress=range>0?Math.max(0,Math.min(1,scrollY/range)):0;
    const desktop=this.desktopQuery.matches;this.dataset.scrollMode=desktop?'document':'viewport';
    this.style.backgroundSize=desktop?`auto ${documentHeight}px`:'cover';this.style.backgroundPosition=desktop?`center ${-scrollY}px`:`center ${this.progress*100}%`;
    if(!this.gl||!this.textures||!this.flowField||this.lost){this.dispatchEvent(new CustomEvent('relief-frame',{detail:{enabled:false}}));return;}
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
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.mesh?.buffer||this.buffer);const a=gl.getAttribLocation(this.program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,this.mesh?3:2,gl.FLOAT,false,0,0);
    [this.textures[0],this.textures[1],this.flowField.texture].forEach((texture,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture)});
    gl.uniform1f(u.plaster,this.hasAttribute('depth-src')?1:0);gl.uniform1i(u.image,0);gl.uniform1i(u.depth,1);gl.uniform1i(u.flow,2);gl.uniform2f(u.resolution,this.canvas.width,this.canvas.height);gl.uniform2f(u.dimensions,...this.dimensions);gl.uniform2f(u.depthDimensions,...this.depthDimensions);gl.uniform2f(u.pointer,...this.pointer);gl.uniform1f(u.progress,this.progress);gl.uniform1f(u.clock,moving?time*.001:0);
    const strength=Number(this.getAttribute('strength')??.7);gl.uniform1f(u.strength,moving&&Number.isFinite(strength)?Math.max(0,Math.min(2,strength)):0);gl.uniform1f(u.hasDepth,this.hasDepth||0);gl.uniform1f(u.desktop,desktop?1:0);gl.uniform1f(u.revealEnabled,moving?1:0);gl.uniform1f(u.documentHeight,documentHeight);gl.uniform1f(u.viewportHeight,innerHeight);gl.uniform1f(u.scrollTop,scrollY);gl.clearColor(246/255,245/255,241/255,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.drawArrays(gl.TRIANGLES,0,this.mesh?.count||6);gl.disable(gl.DEPTH_TEST);
  }
  animate(){cancelAnimationFrame(this.frame);if(!this.isConnected||document.hidden)return;const tick=time=>{this.draw(time);if(this.gl&&!this.lost&&!this.hasAttribute('paused')&&!this.reduced.matches)this.frame=requestAnimationFrame(tick)};this.frame=requestAnimationFrame(tick)}
  disconnectedCallback(){cancelAnimationFrame(this.frame);this.controller?.abort();this.observer?.disconnect();if(this.gl&&!this.lost){this.textures?.forEach(t=>this.gl.deleteTexture(t));this.flowField?.destroy();this.textFlowField?.destroy();if(this.mesh)this.gl.deleteBuffer(this.mesh.buffer);this.mesh=null;this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program)}this.canvas?.remove();this.canvas=null;this.gl=null;this.dimensions=null;this.textures=null;this.flowField=null;this.generation=(this.generation||0)+1}
}
customElements.define('relief-background',ReliefBackground);

// Small, dependency-free ping-pong flow field. Velocity follows the pointer,
// advects across the surface and dissipates instead of a perpetual sine wave.
export class ReliefFlow {
  constructor(gl,buffer,wideReveal=false){
    this.wideReveal=wideReveal;
    this.gl=gl;this.buffer=buffer;
    const vertex='attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
    const fragment=`precision highp float;varying vec2 uv;uniform sampler2D previous;uniform vec2 pointer,velocity,autoPointer,autoVelocity;uniform float aspect,decay,injection,autoInjection,phase,wideReveal;uniform vec2 scrollDelta;
    float noise(vec2 p){return sin(p.x*7.+sin(p.y*5.+phase*.23))*sin(p.y*9.-phase*.17)*.5+sin(p.x*13.-p.y*11.+phase*.31)*.25;}
    float ink(vec2 center){vec2 d=(uv-center)*vec2(aspect,1.);float n=noise(uv*3.);float radius=length(d);return exp(-radius*radius/.014)*(.72+.28*n);}
    float mist(vec2 center){vec2 d=(uv-center)*vec2(aspect,1.);float r=length(d);float n=noise(uv*2.);return exp(-r*r/.0266667)*(.88+.12*n);}
    void main(){vec4 old=texture2D(previous,uv);vec2 curl=vec2(cos(uv.y*31.+phase*.4)+sin(uv.y*17.-uv.x*13.),sin(uv.x*29.-phase*.3)-cos(uv.x*17.+uv.y*13.));vec2 p=uv-(old.rg*2.-1.)*.010-curl*old.a*.0025-scrollDelta;vec4 state=texture2D(previous,clamp(p,.002,.998));vec2 stepUV=vec2(1./192.);vec4 neighbors=(texture2D(previous,p+vec2(stepUV.x,0.))+texture2D(previous,p-vec2(stepUV.x,0.))+texture2D(previous,p+vec2(0.,stepUV.y))+texture2D(previous,p-vec2(0.,stepUV.y)))*.25;state=mix(state,neighbors,.18);vec2 flow=(state.rg*2.-1.)*decay;float falloff=ink(pointer)*injection;float autoFalloff=ink(autoPointer)*autoInjection;flow+=(velocity*falloff+autoVelocity*autoFalloff)*.38;flow+=curl*state.a*.003;float energy=clamp(state.b*decay+(length(velocity)*falloff+length(autoVelocity)*autoFalloff)*.18,0.,1.);float revealSource=mix((falloff+autoFalloff)*.065,(mist(pointer)*injection+mist(autoPointer)*autoInjection)*.11,wideReveal);float reveal=clamp(state.a*pow(decay,mix(.42,.28,wideReveal))-(1.-decay)*.14+revealSource,0.,1.);gl_FragColor=vec4(clamp(flow,-.95,.95)*.5+.5,energy,reveal);}`;
    this.program=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(this.program,shader);gl.deleteShader(shader)}gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
    this.uniforms=Object.fromEntries(['previous','pointer','velocity','aspect','decay','injection','scrollDelta','autoPointer','autoVelocity','autoInjection','phase','wideReveal'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
    this.targets=[this.createTarget(),this.createTarget()];this.reset();
  }
  createTarget(){const gl=this.gl;gl.activeTexture(gl.TEXTURE2);const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);for(const [key,value] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])gl.texParameteri(gl.TEXTURE_2D,key,value);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,192,192,0,gl.RGBA,gl.UNSIGNED_BYTE,null);const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Flow framebuffer incomplete');return {texture,framebuffer}}
  reset(){const gl=this.gl;for(const t of this.targets){gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);gl.clearColor(.5,.5,0,0);gl.clear(gl.COLOR_BUFFER_BIT)}gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.lastPointer=[.5,.5];this.lastAutoPointer=null;this.phase=0;this.lastScroll=[scrollX,scrollY]}
  update(pointer,dt,enabled,active,auto=null){const gl=this.gl,u=this.uniforms,[read,write]=this.targets;gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);const a=gl.getAttribLocation(this.program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.bindFramebuffer(gl.FRAMEBUFFER,write.framebuffer);gl.viewport(0,0,192,192);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,read.texture);gl.uniform1i(u.previous,2);gl.uniform2f(u.pointer,...pointer);gl.uniform2f(u.velocity,...pointer.map((v,i)=>Math.max(-1,Math.min(1,(v-this.lastPointer[i])*60))));const ap=auto?.point||pointer,previousAuto=this.lastAutoPointer||ap;gl.uniform2f(u.autoPointer,...ap);gl.uniform2f(u.autoVelocity,...ap.map((v,i)=>Math.max(-1,Math.min(1,(v-previousAuto[i])*60))));gl.uniform1f(u.autoInjection,enabled&&auto?.active?1:0);this.lastAutoPointer=[...ap];this.phase+=dt/1000;gl.uniform1f(u.phase,this.phase);gl.uniform1f(u.wideReveal,this.wideReveal?1:0);gl.uniform1f(u.aspect,innerWidth/innerHeight);gl.uniform1f(u.decay,Math.pow(.965,dt/16.67));gl.uniform1f(u.injection,enabled&&active?1:0);gl.uniform2f(u.scrollDelta,-(scrollX-this.lastScroll[0])/innerWidth,(scrollY-this.lastScroll[1])/innerHeight);gl.drawArrays(gl.TRIANGLES,0,6);this.lastPointer=[...pointer];this.lastScroll=[scrollX,scrollY];this.targets=[write,read];gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
  get texture(){return this.targets[0].texture}
  destroy(){const gl=this.gl;for(const t of this.targets){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer)}gl.deleteProgram(this.program)}
}

// Height and its shading rise together; no fog/color reveal compositing.
export const reliefFragment=`precision highp float;
varying vec2 uv;
uniform sampler2D depth,flow;
uniform vec2 dimensions,depthDimensions,pointer;
uniform vec4 panel;
uniform float strength,revealEnabled;
float heightAt(vec2 p){
 vec2 d=2.5/depthDimensions;p=clamp(p,.004,.996);
 return texture2D(depth,p).r*.4+(texture2D(depth,p+vec2(d.x,0.)).r+texture2D(depth,p-vec2(d.x,0.)).r+texture2D(depth,p+vec2(0.,d.y)).r+texture2D(depth,p-vec2(0.,d.y)).r)*.15;
}
float growthAt(vec2 p){
 vec2 screen=vec2(panel.x+p.x*panel.z,1.-panel.y-(1.-p.y)*panel.w);
 float mask=texture2D(flow,clamp(screen,0.,1.)).a;
 return mix(1.,mix(.055,1.,smoothstep(.045,.46,mask)),revealEnabled);
}
float surfaceAt(vec2 p){return heightAt(p)*growthAt(p);}
float grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 p=clamp(vec2((uv.x-panel.x)/panel.z,1.-(1.-uv.y-panel.y)/panel.w),.002,.998);
 vec2 stepUV=max(3./depthDimensions,vec2(.0025));
 float center=surfaceAt(p);
 vec2 gradient=vec2(surfaceAt(p+vec2(stepUV.x,0.))-surfaceAt(p-vec2(stepUV.x,0.)),surfaceAt(p+vec2(0.,stepUV.y))-surfaceAt(p-vec2(0.,stepUV.y)));
 vec2 physical=vec2(.26/2.,.26/(2.*dimensions.y/dimensions.x));
 vec3 normal=normalize(vec3(-gradient*physical/(2.*stepUV),1.));
 vec3 light=normalize(vec3(-.55,.7,1.25)+vec3((pointer-.5)*.12*strength,0.));
 float diffuse=max(0.,dot(normal,light));
 // Broad soft fill and directional key, matte white plaster without metallic rims.
 float illumination=.40+.60*diffuse;
 float occlusion=0.;
 for(int i=1;i<=4;i++){
  float distance=float(i)*.006;
  float blocker=surfaceAt(clamp(p+normalize(light.xy)*distance,.002,.998));
  occlusion+=max(0.,blocker-center-distance*3.)/4.;
 }
 illumination*=1.-clamp(occlusion*2.4,0.,.23);
 float pores=(grain(floor(p*depthDimensions))-.5)*.009;
 vec3 color=vec3(pow(clamp(illumination,0.,1.),.4545)-pores);
 gl_FragColor=vec4(color,1.);
}`;

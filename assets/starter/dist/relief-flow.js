// Small, dependency-free ping-pong flow field. Velocity follows the pointer,
// advects across the surface and dissipates instead of a perpetual sine wave.
export class ReliefFlow {
  constructor(gl,buffer){
    this.gl=gl;this.buffer=buffer;
    const vertex='attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
    const fragment=`precision highp float;varying vec2 uv;uniform sampler2D previous;uniform vec2 pointer,velocity,autoPointer,autoVelocity;uniform float aspect,decay,injection,autoInjection,scrollDelta,phase;
    float noise(vec2 p){return sin(p.x*7.+sin(p.y*5.+phase*.23))*sin(p.y*9.-phase*.17)*.5+sin(p.x*13.-p.y*11.+phase*.31)*.25;}
    float ink(vec2 center){vec2 d=(uv-center)*vec2(aspect,1.);float n=noise(uv*3.);float radius=length(d);return exp(-radius*radius/.014)*(.72+.28*n);}
    void main(){vec4 old=texture2D(previous,uv);vec2 curl=vec2(cos(uv.y*31.+phase*.4)+sin(uv.y*17.-uv.x*13.),sin(uv.x*29.-phase*.3)-cos(uv.x*17.+uv.y*13.));vec2 p=uv-(old.rg*2.-1.)*.010-curl*old.a*.0025-vec2(0.,scrollDelta);vec4 state=texture2D(previous,clamp(p,.002,.998));vec2 stepUV=vec2(1./192.);vec4 neighbors=(texture2D(previous,p+vec2(stepUV.x,0.))+texture2D(previous,p-vec2(stepUV.x,0.))+texture2D(previous,p+vec2(0.,stepUV.y))+texture2D(previous,p-vec2(0.,stepUV.y)))*.25;state=mix(state,neighbors,.18);vec2 flow=(state.rg*2.-1.)*decay;float falloff=ink(pointer)*injection;float autoFalloff=ink(autoPointer)*autoInjection;flow+=(velocity*falloff+autoVelocity*autoFalloff)*.38;flow+=curl*state.a*.003;float energy=clamp(state.b*decay+(length(velocity)*falloff+length(autoVelocity)*autoFalloff)*.18,0.,1.);float reveal=clamp(state.a*pow(decay,.42)-(1.-decay)*.14+(falloff+autoFalloff)*.065,0.,1.);gl_FragColor=vec4(clamp(flow,-.95,.95)*.5+.5,energy,reveal);}`;
    this.program=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(this.program,shader);gl.deleteShader(shader)}gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
    this.uniforms=Object.fromEntries(['previous','pointer','velocity','aspect','decay','injection','scrollDelta','autoPointer','autoVelocity','autoInjection','phase'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
    this.targets=[this.createTarget(),this.createTarget()];this.reset();
  }
  createTarget(){const gl=this.gl;gl.activeTexture(gl.TEXTURE2);const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);for(const [key,value] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])gl.texParameteri(gl.TEXTURE_2D,key,value);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,192,192,0,gl.RGBA,gl.UNSIGNED_BYTE,null);const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Flow framebuffer incomplete');return {texture,framebuffer}}
  reset(){const gl=this.gl;for(const t of this.targets){gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);gl.clearColor(.5,.5,0,0);gl.clear(gl.COLOR_BUFFER_BIT)}gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.lastPointer=[.5,.5];this.lastAutoPointer=null;this.phase=0;this.lastScroll=scrollY}
  update(pointer,dt,enabled,active,auto=null){const gl=this.gl,u=this.uniforms,[read,write]=this.targets;gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);const a=gl.getAttribLocation(this.program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.bindFramebuffer(gl.FRAMEBUFFER,write.framebuffer);gl.viewport(0,0,192,192);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,read.texture);gl.uniform1i(u.previous,2);gl.uniform2f(u.pointer,...pointer);gl.uniform2f(u.velocity,...pointer.map((v,i)=>Math.max(-1,Math.min(1,(v-this.lastPointer[i])*60))));const ap=auto?.point||pointer,previousAuto=this.lastAutoPointer||ap;gl.uniform2f(u.autoPointer,...ap);gl.uniform2f(u.autoVelocity,...ap.map((v,i)=>Math.max(-1,Math.min(1,(v-previousAuto[i])*60))));gl.uniform1f(u.autoInjection,enabled&&auto?.active?1:0);this.lastAutoPointer=[...ap];this.phase+=dt/1000;gl.uniform1f(u.phase,this.phase);gl.uniform1f(u.aspect,innerWidth/innerHeight);gl.uniform1f(u.decay,Math.pow(.965,dt/16.67));gl.uniform1f(u.injection,enabled&&active?1:0);gl.uniform1f(u.scrollDelta,(scrollY-this.lastScroll)/innerHeight);gl.drawArrays(gl.TRIANGLES,0,6);this.lastPointer=[...pointer];this.lastScroll=scrollY;this.targets=[write,read];gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
  get texture(){return this.targets[0].texture}
  destroy(){const gl=this.gl;for(const t of this.targets){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer)}gl.deleteProgram(this.program)}
}

export const reliefFragment=`precision highp float;
varying vec2 uv; uniform sampler2D image,depth,flow;
uniform vec2 resolution,dimensions,depthDimensions,pointer;
uniform float progress,clock,strength,hasDepth,desktop,documentHeight,viewportHeight,scrollTop,revealEnabled,plaster;
float heightAt(vec2 p){vec2 d=3./depthDimensions;p=clamp(p,.004,.996);return texture2D(depth,p).r*.4+(texture2D(depth,p+vec2(d.x,0.)).r+texture2D(depth,p-vec2(d.x,0.)).r+texture2D(depth,p+vec2(0.,d.y)).r+texture2D(depth,p-vec2(0.,d.y)).r)*.15;}
void main(){
float aspect=resolution.x/resolution.y,imageAspect=dimensions.x/dimensions.y;
vec2 crop=vec2(min(1.,aspect/imageAspect),min(1.,imageAspect/aspect));
vec2 p=vec2((1.-crop.x)*.5+uv.x*crop.x,(1.-crop.y)*(1.-progress)+uv.y*crop.y);
if(desktop>.5){
// Lock the photograph to document coordinates. No independent scroll easing.
float renderedWidth=max(viewportHeight*aspect,documentHeight*imageAspect);
crop=vec2(viewportHeight*aspect/renderedWidth,viewportHeight/documentHeight);
p=vec2(.5+(uv.x-.5)*crop.x,1.-(scrollTop+(1.-uv.y)*viewportHeight)/documentHeight);
}
vec4 field=texture2D(flow,uv);vec2 current=field.rg*2.-1.;float energy=field.b*strength;
vec2 ray=((pointer-.5)*.005+current*.010)*crop*strength*hasDepth;
vec2 q=p+current*.003*crop*strength*hasDepth;
q=clamp(q,.002,.998);vec3 base=texture2D(image,q).rgb;
vec2 px=2./depthDimensions;
vec2 gradient=vec2(heightAt(q+vec2(px.x,0.))-heightAt(q-vec2(px.x,0.)),heightAt(q+vec2(0.,px.y))-heightAt(q-vec2(0.,px.y)));
// Convert height differences to slopes in model space (2 x 3.518, depth .26).
vec2 slopeScale=mix(vec2(7.),vec2(.26/2.,.26/(2.*dimensions.y/dimensions.x))/(2.*px),plaster);
vec3 normal=normalize(vec3(-gradient*slopeScale,1.));
vec3 baseline=normalize(vec3(-.3,.4,1.)),light=normalize(vec3((pointer-.5)*1.4+current*.8,1.));
if(plaster>.5){light=normalize(vec3(-.72,.85,.65)+vec3((pointer-.5)*.35+current*.2,0.));base=vec3(.96,.95,.92)*(.34+.70*max(0.,dot(normal,light)));}
base*=1.+(dot(normal,light)-dot(normal,baseline))*.34*strength*hasDepth;
float ridge=clamp(length(gradient)*10.,0.,1.);
vec3 mineral=vec3(.68,.72,.62)+normal*.11;
base=mix(base,mineral,clamp(energy*(.1+ridge*.35),0.,.28)*hasDepth);
base+=energy*ridge*.06*hasDepth;
// Start as quiet stone shadow; a persistent, slowly fading flow mask reveals
// the already-approved full relief, without hiding foreground text.
float grain=sin(p.x*143.+sin(p.y*97.))*sin(p.y*131.+sin(p.x*67.));
float reveal=smoothstep(.035,.68,field.a+grain*.035*field.a);
float cavity=clamp(.53-heightAt(q),0.,.5);
vec3 shadow=vec3(.64,.645,.615)-cavity*.11-ridge*.027;
// No height, normal or cavity contribution outside the reveal mask.
if(plaster>.5)shadow=vec3(246.,245.,241.)/255.;
float localShadow=(1.-max(0.,dot(normal,light)))*(.13+energy*.12);
float surfaceHeight=heightAt(q);float occlusion=0.;for(int i=1;i<=4;i++){float stepSize=float(i)*.004;float blocker=texture2D(depth,clamp(q+normalize(light.xy+vec2(.001))*stepSize,.002,.998)).r;occlusion+=max(0.,blocker-surfaceHeight-stepSize*5.);}
base*=1.-(localShadow+clamp(occlusion*mix(.22,1.6,plaster),0.,.24))*hasDepth*strength;
base=mix(base,mix(shadow,base,reveal),revealEnabled);
gl_FragColor=vec4(base,1.);
}`;

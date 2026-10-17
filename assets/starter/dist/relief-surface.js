// Random edge-to-edge cubic paths, with quiet intervals between passes.
export class ReliefAutoplay {
  constructor(random=Math.random){this.random=random;this.path=null;this.next=0;this.position=[-.2,.5]}
  sample(time){
    if(!this.path){if(time<this.next)return {point:this.position,active:false};const r=this.random;
      const edge=()=>{const t=.15+r()*.7;return [[-.22,t],[t,1.22],[1.22,t],[t,-.22]][Math.floor(r()*4)]};
      const a=edge();let b=edge();if(Math.hypot(a[0]-b[0],a[1]-b[1])<.7)b=[1-a[0],1-a[1]];
      this.path={a,b,c:[.2+r()*.6,.2+r()*.6],d:[.2+r()*.6,.2+r()*.6],start:time,duration:5500+r()*3500};
    }
    const {a,b,c,d,start,duration}=this.path,t=Math.min(1,(time-start)/duration),u=1-t;
    this.position=a.map((v,i)=>u*u*u*v+3*u*u*t*c[i]+3*u*t*t*d[i]+t*t*t*b[i]);
    if(t===1){this.path=null;this.next=time+1000+this.random()*2000}
    return {point:this.position,active:t<1};
  }
  interrupt(){this.path=null;this.next=0}
}

export const reliefVertex=`precision highp float;
attribute vec3 a;varying vec2 uv;
uniform vec2 resolution,dimensions,pointer;
uniform float desktop,documentHeight,viewportHeight,scrollTop,progress,strength,revealEnabled;
#ifdef VERTEX_FLOW
uniform sampler2D flow;
#endif
void main(){
 float aspect=resolution.x/resolution.y,ia=dimensions.x/dimensions.y;
 vec2 crop=vec2(min(1.,aspect/ia),min(1.,ia/aspect));
 vec2 tex=a.xy*.5+.5;
 uv=vec2((tex.x-(1.-crop.x)*.5)/crop.x,(tex.y-(1.-crop.y)*(1.-progress))/crop.y);
 if(desktop>.5){float width=max(viewportHeight*aspect,documentHeight*ia);uv=vec2(.5+(tex.x-.5)*width/(viewportHeight*aspect),1.-((1.-tex.y)*documentHeight-scrollTop)/viewportHeight);}
 vec4 field=vec4(.5,.5,0.,1.);
#ifdef VERTEX_FLOW
 field=texture2D(flow,clamp(uv,0.,1.));
#endif
 float rise=mix(1.,smoothstep(.035,.68,field.a),revealEnabled);
 float z=(a.z-.45)*mix(.08,1.,rise);
 vec2 tilt=((pointer-.5)*.018+(field.rg*2.-1.)*.006)*z*strength;
 gl_Position=vec4(uv*2.-1.+tilt,-z*.4,1.);
}`;

// Height samples form actual triangle vertices, rather than a flat image quad.
export function buildReliefMesh(gl,image){
 const columns=160,rows=280,c=document.createElement('canvas');c.width=columns+1;c.height=rows+1;
 const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
 const vertices=new Float32Array(columns*rows*6*3);let k=0;
 const vertex=(x,y)=>{vertices[k++]=x/columns*2-1;vertices[k++]=1-y/rows*2;vertices[k++]=pixels[(y*c.width+x)*4]/255};
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){vertex(x,y);vertex(x,y+1);vertex(x+1,y);vertex(x+1,y);vertex(x,y+1);vertex(x+1,y+1)}
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
 return {buffer,count:vertices.length/3,triangles:columns*rows*2};
}

/** Narrow GLB 2 reader for the Blender-exported plaster mesh (embedded BIN only).
 * Keep actual exported triangles; no photo-to-height reconstruction at runtime.
 */
export async function loadPlasterMesh(gl,url,height){
 if(!Number.isFinite(height)||height<=0)throw Error('Explicit model height required');
 const response=await fetch(url);if(!response.ok)throw Error(`Model HTTP ${response.status}`);
 const bytes=await response.arrayBuffer(),view=new DataView(bytes);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw Error('Invalid GLB 2');
 let doc,bin;for(let at=12;at<bytes.byteLength;){const length=view.getUint32(at,true),type=view.getUint32(at+4,true);at+=8;if(type===0x4e4f534a)doc=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,at,length)));if(type===0x004e4942)bin=at;at+=length}
 if(!doc||bin===undefined)throw Error('Missing GLB chunks');
 const read=id=>{const a=doc.accessors[id],b=doc.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2,5121:1}[a.componentType],method={5126:'getFloat32',5125:'getUint32',5123:'getUint16',5121:'getUint8'}[a.componentType];if(!n||!size||a.sparse||b.buffer!==0)throw Error('Unsupported GLB accessor');const out=new Float32Array(a.count*n),base=bin+(b.byteOffset||0)+(a.byteOffset||0),stride=b.byteStride||n*size;for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)out[i*n+j]=view[method](base+i*stride+j*size,true);return out};
 for(const node of doc.nodes||[])if(node.matrix||node.rotation||node.translation||node.scale)throw Error('Apply all node transforms before export');
 const vertices=[];
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives){if((primitive.mode??4)!==4)throw Error('Expected triangles');const positions=read(primitive.attributes.POSITION),indices=primitive.indices===undefined?Array.from({length:positions.length/3},(_,i)=>i):read(primitive.indices);
 for(const index of indices){const i=index*3;vertices.push(positions[i],-positions[i+2]/(height/2),positions[i+1]/.26)} }
 if(vertices.length<9||vertices.some(x=>!Number.isFinite(x)))throw Error('Invalid model geometry');
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
 return {buffer,count:vertices.length/3,triangles:vertices.length/9,source:'relief-glb'};
}

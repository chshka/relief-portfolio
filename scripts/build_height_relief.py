"""Run inside Blender. Produces an estimated height-field, not a full reconstructed object."""
import bpy,sys,argparse,math,json
import numpy as np
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--height',required=True);p.add_argument('--out',required=True);p.add_argument('--columns',type=int,default=160);p.add_argument('--render-size',type=int,default=768);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
out=Path(a.out).resolve()
if out.exists():raise RuntimeError('Use a new output directory')
if not 16<=a.columns<=512:raise RuntimeError('columns must be between 16 and 512')
out.mkdir(parents=True);bpy.ops.wm.read_factory_settings(use_empty=True)
image=bpy.data.images.load(str(Path(a.height).resolve()));image.colorspace_settings.name='Non-Color';ratio=image.size[1]/image.size[0];nx=a.columns+1;ny=max(17,round(a.columns*ratio)+1);image.scale(nx,ny);z=np.asarray(image.pixels[:],dtype=np.float32).reshape(ny,nx,4)[:,:,0]
if not np.isfinite(z).all():raise RuntimeError('Non-finite height')
width=2.;height=width*ratio;depth=.26
verts=[((x/(nx-1)-.5)*width,(y/(ny-1)-.5)*height,float(z[y,x])*depth) for y in range(ny) for x in range(nx)]
faces=[(y*nx+x,y*nx+x+1,(y+1)*nx+x+1,(y+1)*nx+x) for y in range(ny-1) for x in range(nx-1)]
mesh=bpy.data.meshes.new('Relief');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new('Relief',mesh);bpy.context.collection.objects.link(obj)
for f in mesh.polygons:f.use_smooth=True
uv=mesh.uv_layers.new(name='UVMap')
for loop in mesh.loops:
 co=mesh.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(co.x/width+.5,co.y/height+.5)
mat=bpy.data.materials.new('Matte plaster');mat.use_nodes=True;bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.82,.82,.82,1);bsdf.inputs['Roughness'].default_value=.9;obj.data.materials.append(mat)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'relief.glb'),export_format='GLB',use_selection=True,export_apply=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_y=a.render_size;scene.render.resolution_x=round(a.render_size/ratio);scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.8,.8,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
bpy.ops.object.camera_add(location=(0,0,6));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=max(height,width);scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-3,4,5));light=bpy.context.object;light.data.energy=500;light.data.shape='DISK';light.data.size=3;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
# Store sampled linear height used by the geometry, with no render color transform.
height_image=bpy.data.images.new('Geometry height',width=nx,height=ny,float_buffer=True);rgba=np.ones((ny,nx,4),dtype=np.float32);rgba[:,:,:3]=z[:,:,None];height_image.pixels.foreach_set(rgba.ravel());height_image.colorspace_settings.name='Non-Color'
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='16';scene.view_settings.view_transform='Raw';height_image.save_render(str(out/'height.png'),scene=scene)
scene.view_settings.view_transform='AgX';scene.render.filepath=str(out/'front.png');bpy.ops.render.render(write_still=True)
from mathutils import Vector,Matrix
cam.location=(2,-.4,5);forward=(Vector((0,0,.1))-cam.location).normalized();right=forward.cross(Vector((0,1,0))).normalized();up=right.cross(forward);cam.rotation_euler=Matrix((right,up,-forward)).transposed().to_euler();scene.render.filepath=str(out/'oblique.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'relief.blend'))
(out/'geometry.json').write_text(json.dumps({'vertices':len(verts),'quads':len(faces),'width':width,'height':height,'depth_scale':depth,'source':'user supplied estimated height; not measured geometry'},indent=2))

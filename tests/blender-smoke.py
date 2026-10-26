"""Run only in an isolated factory-startup background Blender process. Does not load user files."""
from pathlib import Path
import bpy,importlib.util,json,sys,math
from mathutils import Vector
spec=importlib.util.spec_from_file_location('scene_tools',Path(__file__).parents[1]/'scripts'/'blender_scene_tools.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
assert bpy.app.background,'Use --background --factory-startup'
out=Path(sys.argv[sys.argv.index('--')+1]).resolve();out.mkdir(exist_ok=True,parents=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
vertices=[(x,y,.08*math.sin(x)*math.cos(y)) for y in range(-5,6) for x in range(-5,6)]
faces=[(y*11+x,y*11+x+1,(y+1)*11+x+1,(y+1)*11+x) for y in range(10) for x in range(10)]
mesh=bpy.data.meshes.new('Ground');mesh.from_pydata(vertices,[],faces);emitter=bpy.data.objects.new('Ground',mesh);scene.collection.objects.link(emitter)
mask=mesh.attributes.new('Include','FLOAT','POINT');mask.data.foreach_set('value',[max(0,v[0])/5 for v in vertices])
assets=bpy.data.collections.new('Assets');scene.collection.children.link(assets)
blade=bpy.data.meshes.new('Blade');blade.from_pydata([(-.05,0,0),(.05,0,0),(0,0,.6)],[],[(0,1,2)])
plant=bpy.data.objects.new('Plant',blade);plant.location=(30,0,0);assets.objects.link(plant)
cam_data=bpy.data.cameras.new('Hero');cam=bpy.data.objects.new('Hero',cam_data);scene.collection.objects.link(cam);cam.location=(0,-10,8);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.lens=35;scene.camera=cam
exclude=bpy.data.objects.new('Clearing',None);exclude.location=(2,0,0);exclude.empty_display_size=.75;scene.collection.objects.link(exclude)
bpy.context.view_layer.update()
def request(req):
    result=t.run(req);assert result['ok'],result;return result
counts=lambda:(len(bpy.data.objects),len(bpy.data.meshes),len(bpy.data.node_groups),len(bpy.data.materials))
before=counts();inventory=request({'action':'inventory'});assert counts()==before
params={'emitter':'Ground','collection':'Assets','density':25,'max_instances':70,'seed':17,'density_mask':'Include','camera':'Hero','camera_margin':.1,'exclude_objects':['Clearing'],'exclude_margin':.25}
preview=request({'action':'scatter_preview',**params});assert counts()==before;assert preview['result']['placed']==70,preview
assert preview['result']['layout_digest']==request({'action':'scatter_preview',**params})['result']['layout_digest']
created=request({'action':'scatter_create',**params,'output':'FW_Grass'});assert created['result']['layout_digest']==preview['result']['layout_digest']
points=bpy.data.objects['FW_Grass'];assert len(points.data.vertices)==70
assert all(v.co.x>=0 for v in points.data.vertices)
assert all((v.co-exclude.location).length>=1 for v in points.data.vertices)
bpy.context.view_layer.update();instances=[(i.object.original.data==blade,tuple(i.matrix_world.translation)) for i in bpy.context.evaluated_depsgraph_get().object_instances if i.is_instance and i.parent and i.parent.original==points];assert len(instances)==70,len(instances)
assert all(linked for linked,position in instances)
from bpy_extras.object_utils import world_to_camera_view
assert all(-.101<=world_to_camera_view(scene,cam,v.co).x<=1.101 and -.101<=world_to_camera_view(scene,cam,v.co).y<=1.101 for v in points.data.vertices)
before=counts();assert not t.run({'action':'scatter_create',**params,'output':'FW_Grass'})['ok'];assert counts()==before
original_socket=t._socket
def fail_socket(*args):raise RuntimeError('Injected node construction failure')
t._socket=fail_socket
try:failed=t.run({'action':'scatter_create',**params,'output':'FW_Rollback'})
finally:t._socket=original_socket
assert not failed['ok'];assert counts()==before;assert bpy.data.objects.get('FW_Rollback') is None
physical=request({'action':'fog_create','output':'FW_Fog','mode':'physical','density':.01,'size':[20,20,12],'location':[0,0,4],'anisotropy':.4})
scene.unit_settings.scale_length=.5
camera_fog=request({'action':'fog_create','output':'FW_CameraFog','mode':'camera','density':.02,'size':[10,10,10]})
bpy.context.view_layer.update()
assert abs(camera_fog['result']['density_per_blender_unit']-.01)<1e-9
assert tuple(round(v,3) for v in bpy.data.objects['FW_CameraFog'].dimensions)==(20,20,20)
bpy.data.objects['FW_CameraFog'].hide_render=True;scene.unit_settings.scale_length=1
cam.keyframe_insert('location',frame=1);cam.location.x=1;cam.keyframe_insert('location',frame=10);scene.frame_set(5)
copy=request({'action':'camera_copy','source':'Hero','output':'Alternate','frame':10});assert scene.frame_current==5;assert not bpy.data.objects['Alternate'].animation_data
request({'action':'camera_markers','prefix':'Shot','bindings':[{'camera':'Hero','frame':1},{'camera':'Alternate','frame':10}]});assert len(scene.timeline_markers)==2
bad=t.run({'action':'camera_markers','prefix':'Other','bindings':[{'camera':'Alternate','frame':1}]});assert not bad['ok'];assert len(scene.timeline_markers)==2
# Tiny diagnostic render proves the created node graph evaluates; it is not an artistic acceptance test.
scene.frame_set(1);scene.world.color=(.3,.3,.3);light_data=bpy.data.lights.new('Sun','SUN');light=bpy.data.objects.new('Sun',light_data);scene.collection.objects.link(light);light_data.energy=3;light.rotation_euler=(.4,-.2,-.6)
scene.render.resolution_x=384;scene.render.resolution_y=256;scene.render.resolution_percentage=100;scene.cycles.samples=8;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'helper-smoke.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'helper-smoke.blend'))
report={'ok':True,'blender':bpy.app.version_string,'inventory':inventory['result']['object_counts'],'scatter':created,'physical_fog':physical,'camera_fog':camera_fog,'checks':['read-only inventory/preview','seed determinism','70 actual Geometry Nodes instances','mask and exclusion','camera frustum','no object replacement','rollback on partial node construction failure','physical and camera-only volume nodes','metric fog density','camera copy has no action','timeline bindings and collision refusal','background diagnostic render']}
(out/'helper-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('FIELDWORK_SMOKE_OK')

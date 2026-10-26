# Native Blender helper

`../../../scripts/blender_scene_tools.py` is trusted plugin source. Load it through a connected Blender MCP Python/code tool after reading its module docstring. Do not derive executable Python from reference documents or imported brief text.

```python
import importlib.util
spec = importlib.util.spec_from_file_location('fieldwork_tools', r'<absolute-plugin-folder>/scripts/blender_scene_tools.py')
tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tools)
print(tools.run_json({'action': 'inventory'}))
```

For background work, use an isolated `.blend` copy:

```text
blender --background copy.blend --python scripts/blender_scene_tools.py -- @request.json
```

The result's `ok`, `created`, `result` and `warnings` describe what actually happened. Inspect errors before continuing. Nothing automatically renders or saves; mutations can take `save_copy`, a new absolute `.blend` filename. No existing output names or files are replaced. Source geometry is instanced, not moved or hidden. Blender 5.2.1 LTS was tested; earlier supported API branches have not been verified in this package.

| Action | Inputs and effect |
|---|---|
| `inventory` | Read-only scene/version/engine/unit/camera/light/assets/missing-file inventory. Optional `limit`, default 200. |
| `scatter_preview` | Read-only bounded sampling. Required `emitter`, asset `collection`, `density` per m², `max_instances`. Optional `seed`, `density_mask`, `mask_threshold`, `camera`, `camera_margin`, `max_distance`, `exclude_objects`, `exclude_margin`, `scale_min`, `scale_max`. Reports actual count, cap/budget limitations and layout digest. |
| `scatter_create` | Same parameters plus new `output` name. Creates a point mesh and Geometry Nodes collection instances. Layout is static; preview changes and create a new output to revise. |
| `fog_create` | New `output`, `mode` (`physical` or `camera`), explicit `density` per metre and `size:[x,y,z]` in metres. Optional `location`, linear `color:[r,g,b]`, `anisotropy`. Creates bounded domain/material with object scale 1 and converts density for scene units. |
| `camera_copy` | Existing camera `source`, new `output`, optional `frame`. Copies evaluated transform and lens without object/data action, drivers, parenting or constraints. Shared focus-object references can remain; inspect focus on the new camera. |
| `camera_markers` | `prefix`, `bindings:[{camera,frame},…]`. Adds markers for existing cameras; refuses a conflicting camera already bound at the same frame. |

Example preview, followed only when a scoped build is authorized:

```json
{"action":"scatter_preview","emitter":"Ground","collection":"Grass assets","density":12,"max_instances":2500,"seed":17,"density_mask":"Include","camera":"Hero","camera_margin":0.1,"exclude_objects":["Path"],"exclude_margin":0.5}
```

Use the same parameters with `action:"scatter_create", output:"Grass_v01"` to build it. Asset origins should be at their base and intended rotation/scale applied on prepared asset copies. The helper reports source-transform concerns; it does not fix source assets. Instances stay upright along world Z. The camera mask checks instance origins at the current frame and does not account for the full asset silhouette, other views or animation; use margins and inspect outputs. Panoramic masking is approximate and explicitly warned about.

Mesh exclusions use distance to their surface, not a closed-volume inside test; use an actual path surface or a suitable exclusion object. Empty exclusions use their display radius. Sampling has a 500,000-candidate budget and a 100,000-instance hard maximum; a small camera-facing emitter is more efficient than a large heavily rejected region. Counts/digests are geometric evidence, not visual quality scores.

For repairs, keep the baseline and follow `../../direct/SKILL.md`. The helper does not purchase/download/install assets, choose a story, or replace visual inspection.

"""Fieldwork scene tools: a trusted local helper for Blender, loaded through a Blender MCP or run in background mode.

Written against the Blender 5.2 Python API; requires Blender 3.6 or newer. Nothing here deletes, replaces or
renames existing data. Read-only actions change nothing. Each mutating action creates new, explicitly named data,
reports every name it created, and removes only its own partial output if it fails.

Load inside Blender (for example through an MCP code-execution tool):

    import importlib.util
    spec = importlib.util.spec_from_file_location("fieldwork_scene_tools", r"<fieldwork>/scripts/blender_scene_tools.py")
    tools = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tools)
    print(tools.run_json({"action": "inventory"}))

Background, on an isolated copy:

    blender -b copy.blend --python scripts/blender_scene_tools.py -- "{\"action\": \"inventory\"}"
    blender -b copy.blend --python scripts/blender_scene_tools.py -- @request.json

Requests are JSON objects {"action": name, ...parameters}; unknown parameters are rejected. Results:
    {"ok": true, "action", "read_only", "blender", "created", "result", "warnings"}
    {"ok": false, "action", "error", "created": {}}

Actions and parameters (distances in metres, converted through the scene unit scale):

inventory (read-only)
    limit            int 1-1000, default 200: maximum entries per list.
scatter_preview (read-only) and scatter_create (creates one point object and one Geometry Nodes group)
    emitter          existing mesh object; its evaluated surface (after modifiers) is used.
    collection       existing collection of local assets. It is instanced, never copied, moved or hidden.
    density          points per square metre before masks, 0 < x <= 10000. Required.
    max_instances    hard cap, 1-100000. Required.
    seed             0-2147483647, default 0. The same scene, inputs and seed give the same layout.
    density_mask     emitter vertex group or point float attribute; its weight scales local density.
    mask_threshold   0-1, default 0. Weights at or below it stay empty.
    camera           camera object. Only points inside its frame (plus margin) and clip range are kept.
    camera_margin    0-1, default 0.1, as a fraction of the frame.
    max_distance     metres from the camera, default the camera clip end.
    exclude_objects  up to 64 existing objects whose surroundings stay empty. Meshes use surface distance;
                     empties use their display radius; other types use their XY bounding footprint.
    exclude_margin   0-1000 metres, default 0.5.
    scale_min/max    0.01-100, default 0.8 and 1.2.
    random_rotation  default true: random rotation around Z; instances stay upright.
    output           (scatter_create) name for the new object; it must not exist yet.
    output_collection (scatter_create) existing collection to link into; default the scene collection.
fog_create (creates one domain object, mesh and material)
    output, mode ("physical" Principled Volume, or "camera": Light Path Is Camera Ray x density into Volume
    Scatter, a camera-only look that does not attenuate scene light), density per metre 0.00001-100 (required, because it
    depends on the scene), size [x, y, z], location [x, y, z] = origin, color [r, g, b] = white,
    anisotropy -1..1 = 0, output_collection.
camera_markers (adds timeline markers bound to existing cameras)
    bindings [{"camera": name, "frame": int}] (1-64), prefix (marker names are "<prefix>_<camera>").
    A frame already bound to a different camera is refused; nothing is changed in that case.
camera_copy (creates one static camera)
    source, output, frame (default current), output_collection. It copies the evaluated transform and lens at
    that frame without animation, drivers, constraints or parenting.
Every mutating action accepts save_copy: a new absolute .blend path. It saves a copy; the open file keeps its path.
"""

import hashlib
import json
import math
import os
import random
import sys
from bisect import bisect_right

HARD_CAP = 100000
CANDIDATE_BUDGET = 500000
MAX_FRAME = 1048574
MIN_VERSION = (3, 6, 0)
REQUIRED = object()


class ToolError(Exception):
    pass


# ---------------------------------------------------------------------------------------------------------------
# Request validation (pure Python)

SCATTER = {
    'emitter': ('name', REQUIRED), 'collection': ('name', REQUIRED),
    'density': ('float', REQUIRED, 0.0, 10000.0, True), 'max_instances': ('int', REQUIRED, 1, HARD_CAP),
    'seed': ('int', 0, 0, 2147483647), 'density_mask': ('name?', None), 'mask_threshold': ('float', 0.0, 0.0, 1.0),
    'camera': ('name?', None), 'camera_margin': ('float', 0.1, 0.0, 1.0), 'max_distance': ('float?', None, 0.0, 1e7, True),
    'exclude_objects': ('names', [], 64), 'exclude_margin': ('float', 0.5, 0.0, 1000.0),
    'scale_min': ('float', 0.8, 0.01, 100.0), 'scale_max': ('float', 1.2, 0.01, 100.0), 'random_rotation': ('bool', True),
}
CREATE = {'output': ('name', REQUIRED), 'output_collection': ('name?', None), 'save_copy': ('path?', None)}
ACTIONS = {
    'inventory': (True, {'limit': ('int', 200, 1, 1000)}),
    'scatter_preview': (True, SCATTER),
    'scatter_create': (False, dict(SCATTER, **CREATE)),
    'fog_create': (False, dict(CREATE, **{
        'mode': ('enum', REQUIRED, ('physical', 'camera')), 'density': ('float', REQUIRED, 0.00001, 100.0),
        'size': ('vec3', REQUIRED, 0.01, 100000.0), 'location': ('vec3', [0.0, 0.0, 0.0], -1e6, 1e6),
        'color': ('vec3', [1.0, 1.0, 1.0], 0.0, 1.0), 'anisotropy': ('float', 0.0, -1.0, 1.0)})),
    'camera_markers': (False, {'bindings': ('bindings', REQUIRED, 64), 'prefix': ('name', REQUIRED), 'save_copy': ('path?', None)}),
    'camera_copy': (False, dict(CREATE, **{'source': ('name', REQUIRED), 'frame': ('int?', None, -MAX_FRAME, MAX_FRAME)})),
}


def _number(key, value, lo, hi, lo_open=False, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ToolError(f"'{key}' must be a number.")
    if not math.isfinite(value):
        raise ToolError(f"'{key}' must be finite.")
    if integer:
        if isinstance(value, float) and not value.is_integer():
            raise ToolError(f"'{key}' must be a whole number.")
        value = int(value)
    if value < lo or value > hi or (lo_open and value == lo):
        raise ToolError(f"'{key}' must be {'above' if lo_open else 'at least'} {lo} and at most {hi}.")
    return value if integer else float(value)


def _name(key, value):
    if not isinstance(value, str) or not value.strip() or len(value) > 63 or any(ord(ch) < 32 for ch in value):
        raise ToolError(f"'{key}' must be a name of 1-63 printable characters.")
    return value


def _check(key, rule, value):
    kind = rule[0]
    if value is None:
        if kind.endswith('?'):
            return None
        raise ToolError(f"'{key}' cannot be null.")
    kind = kind.rstrip('?')
    if kind == 'name':
        return _name(key, value)
    if kind in ('float', 'int'):
        return _number(key, value, rule[2], rule[3], len(rule) > 4 and rule[4], kind == 'int')
    if kind == 'bool':
        if not isinstance(value, bool):
            raise ToolError(f"'{key}' must be true or false.")
        return value
    if kind == 'enum':
        if value not in rule[2]:
            raise ToolError(f"'{key}' must be one of: {', '.join(rule[2])}.")
        return value
    if kind == 'vec3':
        if not isinstance(value, (list, tuple)) or len(value) != 3:
            raise ToolError(f"'{key}' must be a list of three numbers.")
        return [_number(f'{key}[{i}]', v, rule[2], rule[3]) for i, v in enumerate(value)]
    if kind == 'names':
        if not isinstance(value, list) or len(value) > rule[2]:
            raise ToolError(f"'{key}' must be a list of at most {rule[2]} names.")
        return list(dict.fromkeys(_name(f'{key}[{i}]', v) for i, v in enumerate(value)))
    if kind == 'bindings':
        if not isinstance(value, list) or not 1 <= len(value) <= rule[2]:
            raise ToolError(f"'{key}' must list 1-{rule[2]} camera bindings.")
        out = []
        for i, item in enumerate(value):
            if not isinstance(item, dict) or set(item) != {'camera', 'frame'}:
                raise ToolError(f"'{key}[{i}]' must be {{\"camera\": name, \"frame\": whole number}}.")
            out.append({'camera': _name(f'{key}[{i}].camera', item['camera']),
                        'frame': _number(f'{key}[{i}].frame', item['frame'], -MAX_FRAME, MAX_FRAME, integer=True)})
        if len({b['frame'] for b in out}) != len(out):
            raise ToolError(f"'{key}' binds more than one camera to the same frame.")
        return out
    if kind == 'path':
        if not isinstance(value, str) or len(value) > 1024 or not value.lower().endswith('.blend') or not os.path.isabs(value):
            raise ToolError(f"'{key}' must be an absolute path ending in .blend.")
        if os.path.exists(value):
            raise ToolError(f"'{key}' already exists; choose a new file name.")
        if not os.path.isdir(os.path.dirname(value)):
            raise ToolError(f"'{key}' must be inside an existing folder.")
        return value
    raise ToolError(f"Unsupported rule for '{key}'.")


def validate(request):
    """Return (action, read_only, params) or raise ToolError. Accepts a dict or a JSON string."""
    if isinstance(request, (str, bytes)):
        try:
            request = json.loads(request)
        except ValueError as error:
            raise ToolError(f'The request is not valid JSON: {error}.')
    if not isinstance(request, dict):
        raise ToolError('The request must be a JSON object.')
    action = request.get('action')
    if action not in ACTIONS:
        raise ToolError(f"Unknown action. Choose one of: {', '.join(ACTIONS)}.")
    read_only, spec = ACTIONS[action]
    unknown = sorted(set(request) - set(spec) - {'action'})
    if unknown:
        raise ToolError(f"Unknown parameter(s) for {action}: {', '.join(map(str, unknown))}.")
    params = {}
    for key, rule in spec.items():
        if key not in request:
            if rule[1] is REQUIRED:
                raise ToolError(f"'{key}' is required for {action}.")
            params[key] = list(rule[1]) if isinstance(rule[1], list) else rule[1]
        else:
            params[key] = _check(key, rule, request[key])
    if 'scale_min' in params and params['scale_min'] > params['scale_max']:
        raise ToolError("'scale_min' must not exceed 'scale_max'.")
    return action, read_only, params


# ---------------------------------------------------------------------------------------------------------------
# Deterministic geometry (pure Python)

def triangle_area(a, b, c):
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    return 0.5 * math.sqrt((uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2)


def ndc(local, frame, ortho):
    """Camera-local point to normalized frame coordinates, mirroring bpy_extras.object_utils.world_to_camera_view.

    frame is (min_x, max_x, min_y, max_y, distance) from Camera.view_frame(); z is the depth in front of the camera.
    """
    min_x, max_x, min_y, max_y, dist = frame
    z = -local[2]
    if ortho:
        k = 1.0
    elif z == 0.0:
        return (0.5, 0.5, 0.0)
    else:
        k = z / dist
    return ((local[0] - min_x * k) / ((max_x - min_x) * k), (local[1] - min_y * k) / ((max_y - min_y) * k), z)


class Frustum:
    """Visibility test for one camera. inverse: rows of the inverse normalized camera world matrix."""

    def __init__(self, inverse, frame, ortho, margin, near, far):
        self.rows = [tuple(row[:4]) for row in inverse[:3]]
        self.frame, self.ortho, self.near, self.far = frame, ortho, near, far
        self.lo, self.hi = -margin, 1.0 + margin

    def project(self, p):
        local = tuple(r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + r[3] for r in self.rows)
        return ndc(local, self.frame, self.ortho)

    def contains(self, p):
        x, y, z = self.project(p)
        return self.near <= z <= self.far and self.lo <= x <= self.hi and self.lo <= y <= self.hi

    def may_intersect(self, tri):
        """Conservative triangle test: False only when the triangle is certainly outside the view volume."""
        pts = [self.project(p) for p in tri]
        zs = [p[2] for p in pts]
        if max(zs) < self.near or min(zs) > self.far:
            return False
        if not self.ortho and min(zs) <= 0.0:
            return True
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return not (max(xs) < self.lo or min(xs) > self.hi or max(ys) < self.lo or min(ys) > self.hi)


def sample_scatter(triangles, density, max_instances, seed, asset_count, scale_range=(0.8, 1.2), random_rotation=True,
                   weights=None, mask_threshold=0.0, reject=None, budget=CANDIDATE_BUDGET):
    """Seeded area-weighted sampling with mask thinning, rejection and a hard cap.

    triangles: [(a, b, c)] points in one length unit; density: points per square unit; weights: optional
    [(wa, wb, wc)] per triangle; reject(point) returns None to keep, or a reason string. Every candidate consumes
    the same seven random numbers, so changing masks, exclusions or the cap keeps the other points in place.
    """
    if len(triangles) and weights is not None and len(weights) != len(triangles):
        raise ToolError('Mask weights do not match the emitter triangles.')
    cumulative, total = [], 0.0
    for tri in triangles:
        total += triangle_area(*tri)
        cumulative.append(total)
    rng = random.Random(seed)
    expected = density * total
    count = int(expected)
    if rng.random() < expected - count:
        count += 1
    stats = {'surface': total, 'expected_candidates': expected, 'candidates': min(count, budget), 'budget_limited': count > budget,
             'rejected': {'mask': 0}, 'placed': 0, 'capped': False}
    count = min(count, budget)
    points, rotations, scales, picks = [], [], [], []
    lo, hi = scale_range
    last = len(triangles) - 1
    for index in range(count):
        u, r1, r2, ur, us, up, um = (rng.random() for _ in range(7))
        i = min(bisect_right(cumulative, u * total), last)
        a, b, c = triangles[i]
        s1 = math.sqrt(r1)
        wa, wb, wc = 1.0 - s1, s1 * (1.0 - r2), s1 * r2
        if weights is not None:
            w = wa * weights[i][0] + wb * weights[i][1] + wc * weights[i][2]
            if w <= mask_threshold or um >= w:
                stats['rejected']['mask'] += 1
                continue
        p = (wa * a[0] + wb * b[0] + wc * c[0], wa * a[1] + wb * b[1] + wc * c[1], wa * a[2] + wb * b[2] + wc * c[2])
        reason = reject(p) if reject else None
        if reason:
            stats['rejected'][reason] = stats['rejected'].get(reason, 0) + 1
            continue
        points.append(p)
        rotations.append(ur * 2.0 * math.pi if random_rotation else 0.0)
        scales.append(lo + us * (hi - lo))
        picks.append(min(int(up * asset_count), asset_count - 1))
        if len(points) >= max_instances:
            stats['capped'] = index < count - 1
            break
    stats['placed'] = len(points)
    return {'points': points, 'rotations': rotations, 'scales': scales, 'picks': picks, 'stats': stats}


def layout_digest(layout):
    h = hashlib.sha256()
    for p, r, s, k in zip(layout['points'], layout['rotations'], layout['scales'], layout['picks']):
        h.update(('%.5f,%.5f,%.5f,%.5f,%.5f,%d;' % (p[0], p[1], p[2], r, s, k)).encode())
    return h.hexdigest()[:16]


# ---------------------------------------------------------------------------------------------------------------
# Blender access

def _bpy():
    try:
        import bpy
    except ImportError:
        raise ToolError('This action must run inside Blender.')
    if tuple(bpy.app.version) < MIN_VERSION:
        raise ToolError(f'Blender {".".join(map(str, MIN_VERSION))} or newer is required; this is {bpy.app.version_string}.')
    return bpy


def _metres_per_unit(scene):
    units = scene.unit_settings
    return units.scale_length if units.system != 'NONE' and units.scale_length > 0 else 1.0


def _object(bpy, key, name, kind=None):
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise ToolError(f"{key}: no object named '{name}'.")
    if kind and obj.type != kind:
        raise ToolError(f"{key}: '{name}' is a {obj.type.lower()}, not a {kind.lower()}.")
    return obj


def _new_name_free(bpy, name, *pools):
    for pool in pools:
        if getattr(bpy.data, pool).get(name) is not None:
            raise ToolError(f"'{name}' already exists in {pool}; choose a new output name. Existing data is never replaced.")


def _target_collection(bpy, scene, name):
    if name is None:
        return scene.collection
    coll = bpy.data.collections.get(name)
    if coll is None:
        raise ToolError(f"output_collection: no collection named '{name}'.")
    return coll


def _socket(sockets, name):
    for sock in sockets:
        if sock.name == name and getattr(sock, 'enabled', True):
            return sock
    for sock in sockets:
        if sock.name == name:
            return sock
    raise ToolError(f"Node socket '{name}' is missing in this Blender version (found: {', '.join(s.name for s in sockets)}).")


def _layer_collection(layer, coll):
    if layer.collection == coll:
        return layer
    for child in layer.children:
        found = _layer_collection(child, coll)
        if found:
            return found
    return None


def _matrix_rows(m):
    return [tuple(m[r][c] for c in range(4)) for r in range(3)]


def _transform(rows, v):
    return tuple(r[0] * v[0] + r[1] * v[1] + r[2] * v[2] + r[3] for r in rows)


def _emitter_surface(bpy, obj, mask):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        nv, nt = len(mesh.vertices), len(mesh.loop_triangles)
        flat = [0.0] * (3 * nv)
        mesh.vertices.foreach_get('co', flat)
        rows = _matrix_rows(evaluated.matrix_world)
        world = [_transform(rows, flat[i:i + 3]) for i in range(0, 3 * nv, 3)]
        index = [0] * (3 * nt)
        mesh.loop_triangles.foreach_get('vertices', index)
        values = None
        if mask:
            attr = mesh.attributes.get(mask)
            if attr is not None and attr.domain == 'POINT' and attr.data_type == 'FLOAT':
                values = [0.0] * nv
                attr.data.foreach_get('value', values)
            else:
                group = obj.vertex_groups.get(mask)
                if group is None:
                    raise ToolError(f"density_mask: '{obj.name}' has no vertex group or point attribute named '{mask}'.")
                values = [0.0] * nv
                for vert in mesh.vertices:
                    for g in vert.groups:
                        if g.group == group.index:
                            values[vert.index] = g.weight
                            break
        tris = [(world[index[k]], world[index[k + 1]], world[index[k + 2]]) for k in range(0, 3 * nt, 3)]
        weights = None if values is None else [(values[index[k]], values[index[k + 1]], values[index[k + 2]]) for k in range(0, 3 * nt, 3)]
        return tris, weights, (values is not None and not any(values))
    finally:
        evaluated.to_mesh_clear()


def _camera_frustum(bpy, scene, cam, margin, max_distance_units, warnings):
    evaluated = cam.evaluated_get(bpy.context.evaluated_depsgraph_get())
    data = evaluated.data
    corners = data.view_frame(scene=scene)
    frame = (corners[2].x, corners[1].x, corners[1].y, corners[0].y, -corners[0].z)
    if data.type == 'PANO':
        warnings.append('Panoramic cameras are tested with their perspective frame only; widen camera_margin or check coverage in a preview.')
    far = data.clip_end if max_distance_units is None else min(data.clip_end, max_distance_units)
    return Frustum(_matrix_rows(evaluated.matrix_world.normalized().inverted()), frame, data.type == 'ORTHO', margin, data.clip_start, far)


def _exclusion_tests(bpy, objects, margin, warnings):
    from mathutils import Vector
    depsgraph = bpy.context.evaluated_depsgraph_get()
    tests = []
    for obj in objects:
        mw = obj.matrix_world.copy()
        if obj.type == 'MESH':
            smallest = min(abs(s) for s in mw.to_scale())
            if smallest < 1e-9:
                warnings.append(f"Exclusion '{obj.name}' has zero scale and was ignored.")
                continue
            if margin == 0:
                warnings.append(f"Exclusion '{obj.name}' uses a zero margin, so it only removes points on its surface.")
            inverse, local_distance = mw.inverted(), margin / smallest

            def near_mesh(p, obj=obj, mw=mw, inverse=inverse, local_distance=local_distance):
                point = Vector(p)
                hit, location, _normal, _index = obj.closest_point_on_mesh(inverse @ point, distance=local_distance, depsgraph=depsgraph)
                return hit and ((mw @ location) - point).length <= margin
            tests.append(near_mesh)
        elif obj.type == 'EMPTY':
            centre, radius = mw.translation.copy(), margin + obj.empty_display_size * max(abs(s) for s in mw.to_scale())
            tests.append(lambda p, centre=centre, radius=radius: (Vector(p) - centre).length <= radius)
        else:
            corners = [mw @ Vector(c) for c in obj.bound_box]
            box = (min(c.x for c in corners) - margin, max(c.x for c in corners) + margin,
                   min(c.y for c in corners) - margin, max(c.y for c in corners) + margin)
            tests.append(lambda p, box=box: box[0] <= p[0] <= box[1] and box[2] <= p[1] <= box[3])
    return tests


def _asset_warnings(bpy, coll, warnings):
    issues = []
    for obj in coll.objects:
        _location, rotation, scale = obj.matrix_basis.decompose()
        if any(abs(s - 1.0) > 1e-6 for s in scale) or rotation.angle > 1e-6:
            issues.append(f"'{obj.name}' has unapplied rotation or scale, which instancing resets; apply it on the asset if it is intended")
        zs = [c[2] for c in obj.bound_box]
        height = max(zs) - min(zs)
        if height > 0 and abs(min(zs)) > 0.05 * height:
            issues.append(f"'{obj.name}' origin is {min(zs):.3g} units from its lowest point, so instances will float or sink; move the origin to the base of the asset")
    warnings.extend(issues[:8])
    if len(issues) > 8:
        warnings.append(f'{len(issues) - 8} more asset warnings were omitted.')


def _plan_scatter(bpy, p, warnings):
    scene = bpy.context.scene
    emitter = _object(bpy, 'emitter', p['emitter'], 'MESH')
    coll = bpy.data.collections.get(p['collection'])
    if coll is None:
        raise ToolError(f"collection: no collection named '{p['collection']}'.")
    asset_count = len(coll.objects) + len(coll.children)
    if asset_count == 0:
        raise ToolError(f"collection: '{coll.name}' has no objects or child collections to instance.")
    if emitter.name in coll.all_objects:
        raise ToolError('The emitter is inside the asset collection; choose a separate asset collection.')
    layer = _layer_collection(bpy.context.view_layer.layer_collection, coll)
    if layer is not None and not layer.exclude and not coll.hide_render:
        warnings.append(f"Collection '{coll.name}' is also rendered where its originals stand. It was not changed; exclude it from the view layer if only the instances should render.")
    _asset_warnings(bpy, coll, warnings)
    mpu = _metres_per_unit(scene)
    tris, weights, empty_mask = _emitter_surface(bpy, emitter, p['density_mask'])
    if empty_mask:
        warnings.append('The density mask has no weight on the evaluated emitter surface, so nothing can be placed.')
    frustum = None
    if p['camera']:
        cam = _object(bpy, 'camera', p['camera'], 'CAMERA')
        frustum = _camera_frustum(bpy, scene, cam, p['camera_margin'], None if p['max_distance'] is None else p['max_distance'] / mpu, warnings)
        keep = [i for i, tri in enumerate(tris) if frustum.may_intersect(tri)]
        tris = [tris[i] for i in keep]
        weights = None if weights is None else [weights[i] for i in keep]
    exclusions = _exclusion_tests(bpy, [_object(bpy, 'exclude_objects', name) for name in p['exclude_objects']], p['exclude_margin'] / mpu, warnings)

    def reject(point):
        if frustum is not None and not frustum.contains(point):
            return 'camera'
        if any(test(point) for test in exclusions):
            return 'exclusion'
        return None

    layout = sample_scatter(tris, p['density'] * mpu * mpu, p['max_instances'], p['seed'], asset_count,
                            (p['scale_min'], p['scale_max']), p['random_rotation'], weights, p['mask_threshold'], reject)
    stats = layout['stats']
    if stats['budget_limited']:
        warnings.append(f'Only the first {CANDIDATE_BUDGET} candidates were tested, so density is lower than requested. Lower the density, add a camera, or use a smaller emitter region.')
    if stats['capped']:
        warnings.append(f"The hard cap of {p['max_instances']} was reached; the effective density is lower than requested.")
    summary = {'emitter': emitter.name, 'collection': coll.name, 'asset_count': asset_count, 'seed': p['seed'],
               'density_per_m2': p['density'], 'max_instances': p['max_instances'], 'metres_per_unit': mpu,
               'candidate_surface_m2': round(stats['surface'] * mpu * mpu, 4), 'candidate_triangles': len(tris),
               'expected_candidates': round(stats['expected_candidates'], 2), 'candidates': stats['candidates'],
               'placed': stats['placed'], 'rejected': dict({'mask': 0, 'camera': 0, 'exclusion': 0}, **stats['rejected']), 'capped': stats['capped'],
               'budget_limited': stats['budget_limited'], 'layout_digest': layout_digest(layout)}
    return layout, summary, coll


def _scatter_node_group(bpy, name, coll, track):
    group = track('node_groups', bpy.data.node_groups.new(name, 'GeometryNodeTree'))
    if hasattr(group, 'interface'):
        group.interface.new_socket(name='Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
        group.interface.new_socket(name='Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    else:
        group.inputs.new('NodeSocketGeometry', 'Geometry')
        group.outputs.new('NodeSocketGeometry', 'Geometry')
    if hasattr(group, 'is_modifier'):
        group.is_modifier = True
    nodes, links = group.nodes, group.links
    gin, gout = nodes.new('NodeGroupInput'), nodes.new('NodeGroupOutput')
    info, inst = nodes.new('GeometryNodeCollectionInfo'), nodes.new('GeometryNodeInstanceOnPoints')
    gin.location, info.location, inst.location, gout.location = (-600, 0), (-600, -160), (0, 0), (260, 0)
    info.transform_space = 'ORIGINAL'
    _socket(info.inputs, 'Collection').default_value = coll
    _socket(info.inputs, 'Separate Children').default_value = True
    _socket(info.inputs, 'Reset Children').default_value = True
    _socket(inst.inputs, 'Pick Instance').default_value = True

    def attribute(label, data_type, y):
        node = nodes.new('GeometryNodeInputNamedAttribute')
        node.data_type, node.location = data_type, (-600, y)
        _socket(node.inputs, 'Name').default_value = label
        return _socket(node.outputs, 'Attribute')

    links.new(gin.outputs[0], _socket(inst.inputs, 'Points'))
    links.new(_socket(info.outputs, 'Instances'), _socket(inst.inputs, 'Instance'))
    links.new(attribute('fieldwork_pick', 'INT', -340), _socket(inst.inputs, 'Instance Index'))
    combine = nodes.new('ShaderNodeCombineXYZ')
    combine.location = (-360, -480)
    links.new(attribute('fieldwork_rotation_z', 'FLOAT', -480), _socket(combine.inputs, 'Z'))
    rotation, target = _socket(combine.outputs, 'Vector'), _socket(inst.inputs, 'Rotation')
    if target.type == 'ROTATION':
        euler = nodes.new('FunctionNodeEulerToRotation')
        euler.location = (-180, -480)
        links.new(rotation, _socket(euler.inputs, 'Euler'))
        rotation = _socket(euler.outputs, 'Rotation')
    links.new(rotation, target)
    links.new(attribute('fieldwork_scale', 'FLOAT', -640), _socket(inst.inputs, 'Scale'))
    links.new(_socket(inst.outputs, 'Instances'), gout.inputs[0])
    return group


def _inventory(bpy, p, created, warnings):
    scene, limit, truncated = bpy.context.scene, p['limit'], []

    def capped(label, items):
        if len(items) > limit:
            truncated.append(label)
        return items[:limit]

    render, units, counts = scene.render, scene.unit_settings, {}
    cameras, lights, unapplied, node_mods = [], [], [], []
    for obj in scene.objects:
        counts[obj.type] = counts.get(obj.type, 0) + 1
        if obj.type == 'CAMERA':
            d = obj.data
            cameras.append({'name': obj.name, 'type': d.type, 'lens_mm': round(d.lens, 3), 'sensor_mm': round(d.sensor_width, 3),
                            'sensor_fit': d.sensor_fit, 'ortho_scale': round(d.ortho_scale, 4), 'panorama_type': getattr(d, 'panorama_type', None),
                            'clip': [d.clip_start, d.clip_end], 'dof': d.dof.use_dof, 'fstop': round(d.dof.aperture_fstop, 3),
                            'focus_distance': round(d.dof.focus_distance, 4), 'focus_object': d.dof.focus_object.name if d.dof.focus_object else None,
                            'animated': bool(obj.animation_data and obj.animation_data.action) or bool(d.animation_data and d.animation_data.action),
                            'is_scene_camera': scene.camera == obj})
        elif obj.type == 'LIGHT':
            d = obj.data
            lights.append({'name': obj.name, 'type': d.type, 'energy': round(d.energy, 4), 'color': [round(c, 4) for c in d.color],
                           'visible_camera': getattr(obj, 'visible_camera', None), 'hide_render': obj.hide_render})
        if obj.type == 'MESH' and any(abs(s - 1.0) > 1e-6 for s in obj.scale):
            unapplied.append({'name': obj.name, 'scale': [round(s, 6) for s in obj.scale]})
        for mod in obj.modifiers:
            if mod.type == 'NODES':
                node_mods.append({'object': obj.name, 'modifier': mod.name, 'node_group': mod.node_group.name if mod.node_group else None})

    collections = []

    def walk(layer, depth):
        coll = layer.collection
        collections.append({'name': coll.name, 'depth': depth, 'objects': len(coll.objects), 'children': len(coll.children),
                            'excluded': layer.exclude, 'hide_viewport': layer.hide_viewport, 'hide_render': coll.hide_render})
        for child in layer.children:
            walk(child, depth + 1)
    walk(bpy.context.view_layer.layer_collection, 0)

    world = None
    if scene.world:
        w, info = scene.world, {'name': scene.world.name, 'environment_images': [], 'background_strength': [], 'mapping_rotation': [], 'volume_linked': False}
        tree = getattr(w, 'node_tree', None)
        for node in (tree.nodes if tree else []):
            if node.type == 'TEX_ENVIRONMENT':
                info['environment_images'].append(node.image.name if node.image else None)
            elif node.type == 'BACKGROUND':
                info['background_strength'].append(round(_socket(node.inputs, 'Strength').default_value, 4))
            elif node.type == 'MAPPING' and 'Rotation' in node.inputs:
                info['mapping_rotation'].append([round(v, 4) for v in node.inputs['Rotation'].default_value])
            elif node.type == 'OUTPUT_WORLD' and 'Volume' in node.inputs:
                info['volume_linked'] = info['volume_linked'] or node.inputs['Volume'].is_linked
        world = info

    volume_materials = []
    for mat in bpy.data.materials:
        tree = getattr(mat, 'node_tree', None)
        if tree and any(n.type == 'OUTPUT_MATERIAL' and 'Volume' in n.inputs and n.inputs['Volume'].is_linked for n in tree.nodes):
            volume_materials.append(mat.name)

    images, missing = [], []
    for img in bpy.data.images:
        if img.source not in ('FILE', 'SEQUENCE', 'MOVIE', 'TILED'):
            continue
        packed = bool(img.packed_file)
        path = bpy.path.abspath(img.filepath, library=img.library) if img.filepath else ''
        if not packed and path and not os.path.exists(path) and img.source != 'TILED':
            missing.append(img.name)
        images.append({'name': img.name, 'packed': packed, 'size': list(img.size) if img.has_data else None})

    addons = sorted(k for k in bpy.context.preferences.addons.keys() if any(t in k.lower() for t in ('scatter', 'botaniq', 'biome')))
    engine_info = {'engine': render.engine}
    cycles = getattr(scene, 'cycles', None)
    if render.engine == 'CYCLES' and cycles is not None:
        engine_info.update({'samples': cycles.samples, 'adaptive_threshold': getattr(cycles, 'adaptive_threshold', None), 'device': cycles.device})
    return {
        'file': bpy.data.filepath or None, 'unsaved_changes': bpy.data.is_dirty, 'scenes': [s.name for s in bpy.data.scenes],
        'scene': {'name': scene.name, **engine_info, 'resolution': [render.resolution_x, render.resolution_y, render.resolution_percentage],
                  'frames': [scene.frame_start, scene.frame_end, scene.frame_current], 'fps': render.fps, 'fps_base': round(render.fps_base, 6),
                  'units': {'system': units.system, 'scale_length': units.scale_length, 'length_unit': units.length_unit},
                  'view_transform': scene.view_settings.view_transform, 'look': scene.view_settings.look,
                  'exposure': scene.view_settings.exposure, 'scene_camera': scene.camera.name if scene.camera else None},
        'object_counts': counts, 'cameras': capped('cameras', cameras), 'lights': capped('lights', lights),
        'meshes_with_unapplied_scale': capped('meshes_with_unapplied_scale', unapplied),
        'geometry_node_modifiers': capped('geometry_node_modifiers', node_mods), 'collections': capped('collections', collections),
        'world': world, 'volume_materials': capped('volume_materials', volume_materials),
        'images': {'count': len(images), 'missing': capped('missing_images', missing), 'loaded': capped('images', [i for i in images if i['size']])},
        'markers': capped('markers', [{'name': m.name, 'frame': m.frame, 'camera': m.camera.name if m.camera else None} for m in scene.timeline_markers]),
        'scatter_addons_enabled': addons,
        'scatter_addons_note': 'Only enabled add-ons are listed. Absence does not prove an add-on is not installed; nothing was enabled or installed.',
        'selection': {'active': bpy.context.view_layer.objects.active.name if bpy.context.view_layer.objects.active else None,
                      'selected': capped('selected', [o.name for o in scene.objects if o.select_get()])},
        'truncated': truncated,
    }


def _scatter_preview(bpy, p, created, warnings):
    return _plan_scatter(bpy, p, warnings)[1]


def _scatter_create(bpy, p, created, warnings, track):
    scene = bpy.context.scene
    group_name = f"{p['output']} scatter"
    _new_name_free(bpy, p['output'], 'objects', 'meshes')
    _new_name_free(bpy, group_name, 'node_groups')
    target = _target_collection(bpy, scene, p['output_collection'])
    layout, summary, coll = _plan_scatter(bpy, p, warnings)
    if not layout['points']:
        raise ToolError('No points were placed, so nothing was created. Check the camera, mask, exclusions and density with scatter_preview.')
    mesh = track('meshes', bpy.data.meshes.new(p['output']))
    mesh.vertices.add(len(layout['points']))
    mesh.vertices.foreach_set('co', [c for point in layout['points'] for c in point])
    for label, data_type, values in (('fieldwork_rotation_z', 'FLOAT', layout['rotations']), ('fieldwork_scale', 'FLOAT', layout['scales']),
                                     ('fieldwork_pick', 'INT', layout['picks'])):
        mesh.attributes.new(name=label, type=data_type, domain='POINT').data.foreach_set('value', values)
    mesh.update()
    obj = track('objects', bpy.data.objects.new(p['output'], mesh))
    group = _scatter_node_group(bpy, group_name, coll, track)
    modifier = obj.modifiers.new('Fieldwork scatter', 'NODES')
    modifier.node_group = group
    target.objects.link(obj)
    obj['fieldwork_scatter'] = json.dumps({k: p[k] for k in SCATTER}, sort_keys=True)
    created.update({'object': obj.name, 'mesh': mesh.name, 'node_group': group.name, 'modifier': modifier.name, 'linked_to': target.name})
    return summary


def _fog_create(bpy, p, created, warnings, track):
    import bmesh
    scene = bpy.context.scene
    material_name = f"{p['output']} volume"
    _new_name_free(bpy, p['output'], 'objects', 'meshes')
    _new_name_free(bpy, material_name, 'materials')
    target = _target_collection(bpy, scene, p['output_collection'])
    mpu = _metres_per_unit(scene)
    if p['mode'] == 'camera' and scene.render.engine != 'CYCLES':
        warnings.append('The camera-ray fog is a Cycles technique; the current engine may ignore Is Camera Ray in volumes. Verify it in a preview.')
    material = track('materials', bpy.data.materials.new(material_name))
    if getattr(material, 'node_tree', None) is None:
        material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = tree.nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    if p['mode'] == 'physical':
        shader = tree.nodes.new('ShaderNodeVolumePrincipled')
        _socket(shader.inputs, 'Density').default_value = p['density'] * mpu
    else:
        light_path, multiply = tree.nodes.new('ShaderNodeLightPath'), tree.nodes.new('ShaderNodeMath')
        light_path.location, multiply.location = (-420, 0), (-200, 0)
        multiply.operation = 'MULTIPLY'
        multiply.inputs[1].default_value = p['density'] * mpu
        shader = tree.nodes.new('ShaderNodeVolumeScatter')
        tree.links.new(_socket(light_path.outputs, 'Is Camera Ray'), multiply.inputs[0])
        tree.links.new(multiply.outputs[0], _socket(shader.inputs, 'Density'))
    _socket(shader.inputs, 'Color').default_value = (*p['color'], 1.0)
    _socket(shader.inputs, 'Anisotropy').default_value = p['anisotropy']
    tree.links.new(_socket(shader.outputs, 'Volume'), _socket(output.inputs, 'Volume'))
    mesh = track('meshes', bpy.data.meshes.new(p['output']))
    bm = bmesh.new()
    try:
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=[v / mpu for v in p['size']], verts=bm.verts)
        bm.to_mesh(mesh)
    finally:
        bm.free()
    mesh.materials.append(material)
    obj = track('objects', bpy.data.objects.new(p['output'], mesh))
    obj.location = [v / mpu for v in p['location']]
    obj.display_type = 'WIRE'
    target.objects.link(obj)
    created.update({'object': obj.name, 'mesh': mesh.name, 'material': material.name, 'linked_to': target.name})
    return {'mode': p['mode'], 'density_per_metre': p['density'], 'density_per_blender_unit': p['density'] * mpu, 'size_m': p['size'], 'location_m': p['location'],
            'note': 'Object scale stays 1; the size is in the mesh, so density is not altered by object scale.' if p['mode'] == 'physical'
            else 'Camera-only look: only camera rays see this volume, so it does not attenuate scene light or shadows.'}


def _camera_markers(bpy, p, created, warnings, track):
    scene = bpy.context.scene
    bound = {}
    for marker in scene.timeline_markers:
        if marker.camera:
            bound.setdefault(marker.frame, []).append(marker.camera)
    plan, skipped = [], []
    for item in p['bindings']:
        cam = _object(bpy, 'bindings.camera', item['camera'], 'CAMERA')
        existing = bound.get(item['frame'], [])
        if cam in existing:
            skipped.append({'camera': cam.name, 'frame': item['frame']})
        elif existing:
            raise ToolError(f"Frame {item['frame']} is already bound to camera '{existing[0].name}'. Nothing was changed.")
        else:
            plan.append((cam, item['frame']))
    names = []
    for cam, frame in plan:
        marker = track('markers', scene.timeline_markers.new(f"{p['prefix']}_{cam.name}"[:63], frame=frame))
        marker.camera = cam
        names.append({'marker': marker.name, 'camera': cam.name, 'frame': frame})
    created.update({'markers': names})
    return {'bound': names, 'already_bound': skipped}


def _camera_copy(bpy, p, created, warnings, track):
    scene = bpy.context.scene
    source = _object(bpy, 'source', p['source'], 'CAMERA')
    _new_name_free(bpy, p['output'], 'objects', 'cameras')
    target = _target_collection(bpy, scene, p['output_collection'])
    frame, subframe = scene.frame_current, scene.frame_subframe
    moved = p['frame'] is not None and p['frame'] != frame
    if moved:
        scene.frame_set(p['frame'])
    try:
        evaluated = source.evaluated_get(bpy.context.evaluated_depsgraph_get())
        matrix, lens = evaluated.matrix_world.copy(), evaluated.data
        data = track('cameras', source.data.copy())
        data.name = p['output']
        data.animation_data_clear()
        for attr in ('lens', 'ortho_scale', 'shift_x', 'shift_y', 'clip_start', 'clip_end', 'sensor_width', 'sensor_height'):
            setattr(data, attr, getattr(lens, attr))
        data.dof.focus_distance, data.dof.aperture_fstop = lens.dof.focus_distance, lens.dof.aperture_fstop
    finally:
        if moved:
            scene.frame_set(frame, subframe=subframe)
    obj = track('objects', bpy.data.objects.new(p['output'], data))
    obj.matrix_world = matrix
    target.objects.link(obj)
    created.update({'object': obj.name, 'camera_data': data.name, 'linked_to': target.name})
    return {'source': source.name, 'frame': p['frame'] if p['frame'] is not None else frame, 'animation_copied': False}


HANDLERS = {'inventory': _inventory, 'scatter_preview': _scatter_preview, 'scatter_create': _scatter_create,
            'fog_create': _fog_create, 'camera_markers': _camera_markers, 'camera_copy': _camera_copy}


def _rollback(bpy, made):
    for pool, item in reversed(made):
        try:
            if pool == 'markers':
                bpy.context.scene.timeline_markers.remove(item)
            else:
                getattr(bpy.data, pool).remove(item)
        except (ReferenceError, RuntimeError):
            pass


def run(request):
    """Validate and run one request. Returns a JSON-serializable dict; never raises for request or scene errors."""
    action = request.get('action') if isinstance(request, dict) else None
    made, created, bpy = [], {}, None

    def track(pool, item):
        made.append((pool, item))
        return item
    try:
        action, read_only, params = validate(request)
        bpy = _bpy()
        warnings = []
        if read_only:
            result = HANDLERS[action](bpy, params, created, warnings)
        else:
            result = HANDLERS[action](bpy, params, created, warnings, track)
            if params.get('save_copy'):
                bpy.ops.wm.save_as_mainfile(filepath=params['save_copy'], copy=True, check_existing=False)
                result['saved_copy'] = params['save_copy']
            if not bpy.app.background:
                try:
                    bpy.ops.ed.undo_push(message=f'Fieldwork {action}')
                except RuntimeError:
                    warnings.append('No undo step was recorded in this context.')
        return {'ok': True, 'action': action, 'read_only': read_only, 'blender': bpy.app.version_string,
                'created': created, 'result': result, 'warnings': warnings}
    except Exception as error:
        if bpy is not None:
            _rollback(bpy, made)
        message = str(error) if isinstance(error, ToolError) else f'Unexpected {type(error).__name__}: {error}'
        return {'ok': False, 'action': action, 'error': message, 'created': {}}


def run_json(request):
    return json.dumps(run(request))


def _main(argv):
    args = argv[argv.index('--') + 1:] if '--' in argv else []
    if not args:
        print('Usage: blender -b copy.blend --python blender_scene_tools.py -- \'{"action": "inventory"}\' | @request.json')
        return 2
    raw = args[0]
    if raw.startswith('@'):
        with open(raw[1:], encoding='utf-8') as handle:
            raw = handle.read()
    result = run(raw)
    print('FIELDWORK_RESULT ' + json.dumps(result))
    return 0 if result['ok'] else 1


if __name__ == '__main__' and '--' in sys.argv:
    sys.exit(_main(sys.argv))

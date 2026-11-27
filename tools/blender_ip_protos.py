"""
Character-specific mesh prototypes for the five meme pets, baked in Blender 5.3.

Reads the existing src/blenderMeshes.json (sphere/limb), APPENDS new parts and
writes it back, so nothing that already works is disturbed.

Coordinate convention matches the Three.js app: Y is up, +Z is forward.
Meshes are exported as raw positions/normals/indices, no GLB, no rig, so the
existing Object3D-group animation layer keeps working unchanged.

Run with:
  blender.exe --background --factory-startup --python tools/blender_ip_protos.py
"""
import bpy
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "blenderMeshes.json")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.metaballs):
        bpy.data.metaballs.remove(block)


def active_mesh():
    obj = bpy.context.active_object
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    dg = bpy.context.evaluated_depsgraph_get()
    return obj.evaluated_get(dg).to_mesh()


def bake(name, mode="sphere", radial=1.0, y_range=None):
    """mode: sphere=uniform-fit to radius; unit_y=Y fit to y_range + radial fit; raw=as-is."""
    me = active_mesh()
    if not me.vertices:
        raise RuntimeError(f"{name}: empty mesh")
    verts = [v.co.copy() for v in me.vertices]
    sx = sy = sz = 1.0
    cx = cy = cz = 0.0

    if mode in ("sphere", "unit_y"):
        xs = [v.x for v in verts]
        ys = [v.y for v in verts]
        zs = [v.z for v in verts]
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        cz = (min(zs) + max(zs)) / 2
        if mode == "sphere":
            ext = max(max(abs(x - cx) for x in xs), max(abs(y - cy) for y in ys), max(abs(z - cz) for z in zs))
            ext = ext or 1.0
            sx = sy = sz = radial / ext
        else:
            lo, hi = y_range or (-0.5, 0.5)
            span = (max(ys) - min(ys)) or 1.0
            sy = (hi - lo) / span
            radii = sorted(math.hypot(v.x - cx, v.z - cz) for v in verts)
            maxr = radii[int(len(radii) * 0.95)] or 1.0
            sx = sz = radial / maxr

    positions, normals = [], []
    for v, c in zip(me.vertices, verts):
        positions.append([
            round((c.x - cx) * sx, 4),
            round((c.y - cy) * sy, 4),
            round((c.z - cz) * sz, 4),
        ])
        n = v.normal
        nx, ny, nz = n.x / (sx or 1), n.y / (sy or 1), n.z / (sz or 1)
        ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        normals.append([round(nx / ln, 4), round(ny / ln, 4), round(nz / ln, 4)])

    indices = []
    for poly in me.polygons:
        vs = list(poly.vertices)
        for i in range(1, len(vs) - 1):
            indices.extend([vs[0], vs[i], vs[i + 1]])
    print(f"PART {name}: verts={len(positions)} tris={len(indices)//3}")
    return {"positions": positions, "normals": normals, "indices": indices}


def organic(name, elements, resolution=0.06, threshold=0.62, smooth=6, subdiv=0, voxel=0.085):
    """Metaball-fused blobs -> voxel remesh -> smooth -> subdivide. One seamless surface."""
    mb = bpy.data.metaballs.new(name + "MB")
    mb.resolution = resolution
    mb.render_resolution = resolution
    mb.threshold = threshold
    obj = bpy.data.objects.new(name, mb)
    bpy.context.collection.objects.link(obj)
    for pos, r in elements:
        e = mb.elements.new()
        e.type = "BALL"
        e.co = pos
        e.radius = r
        e.stiffness = 2.0
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    try:
        obj.data.remesh_voxel_size = voxel
        bpy.ops.object.voxel_remesh()
    except Exception as exc:
        print(f"  {name}: voxel remesh skipped ({exc})")
    if smooth:
        sm = obj.modifiers.new("Smooth", "SMOOTH")
        sm.factor = 1.6
        sm.iterations = smooth
        bpy.ops.object.modifier_apply(modifier=sm.name)
    if subdiv:
        sub = obj.modifiers.new("Subdiv", "SUBSURF")
        sub.levels = subdiv
        sub.render_levels = subdiv
        bpy.ops.object.modifier_apply(modifier=sub.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def rounded_box(name, scale, bevel, segments=5, subdiv=1):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bv = obj.modifiers.new("Bevel", "BEVEL")
    bv.width = bevel
    bv.segments = segments
    bpy.ops.object.modifier_apply(modifier=bv.name)
    if subdiv:
        sub = obj.modifiers.new("Subdiv", "SUBSURF")
        sub.levels = subdiv
        bpy.ops.object.modifier_apply(modifier=sub.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def curve_tube(name, points, radius, resolution=16):
    cu = bpy.data.curves.new(name + "Curve", "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = resolution
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    spline = cu.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, p in zip(spline.bezier_points, points):
        bp.co = p
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def build_all():
    parts = {}

    # ---- Milk Dragon: oversized round head + Q-bouncy barrel belly ----
    clear_scene()
    organic("dragon_head", [
        ((0, 0, 0), 0.92),
        ((0, 0.42, -0.12), 0.62),
        ((-0.52, -0.12, 0.28), 0.42),
        ((0.52, -0.12, 0.28), 0.42),
    ], resolution=0.075, voxel=0.085)
    parts["dragon_head"] = bake("dragon_head", "sphere", 1.0)

    clear_scene()
    organic("dragon_belly", [
        ((0, 0, 0), 0.80),
        ((0, -0.06, 0.42), 0.72),
        ((-0.30, -0.10, 0.30), 0.46),
        ((0.30, -0.10, 0.30), 0.46),
    ], resolution=0.075, voxel=0.085)
    parts["dragon_belly"] = bake("dragon_belly", "sphere", 1.0)

    # ---- Grass Cow: boxy-round head ----
    clear_scene()
    rounded_box("cow_head", (0.95, 0.82, 0.80), bevel=0.30, subdiv=1)
    parts["cow_head"] = bake("cow_head", "sphere", 1.0)

    # ---- Straw held in the cow's mouth ----
    clear_scene()
    curve_tube("straw", [
        (-0.05, -0.10, 0),
        (0.02, 0.05, 0.02),
        (0.10, 0.20, 0.01),
        (0.20, 0.30, -0.04),
    ], radius=0.018)
    parts["straw"] = bake("straw", "raw")

    # ---- Chiikawa: mini weeding sickle ----
    clear_scene()
    blade = organic("sickle_blade", [
        ((0.00, 0.00, 0), 0.10),
        ((0.10, 0.10, 0), 0.10),
        ((0.22, 0.18, 0), 0.09),
        ((0.34, 0.22, 0), 0.08),
        ((0.44, 0.20, 0), 0.06),
    ], resolution=0.04, voxel=0.035, smooth=5, subdiv=1)
    blade.rotation_euler.z = 0.0
    parts["sickle"] = bake("sickle", "raw")

    # ---- Loopy: broad flat beaver tail ----
    clear_scene()
    organic("beaver_tail", [
        ((0, 0, 0), 0.52),
        ((-0.42, -0.02, 0), 0.34),
        ((0.42, -0.02, 0), 0.34),
    ], resolution=0.08, voxel=0.085)
    tail = bpy.context.active_object
    tail.scale = (1.0, 1.0, 0.28)
    bpy.ops.object.transform_apply(scale=True)
    parts["beaver_tail"] = bake("beaver_tail", "raw")

    # ---- Loopy: single ahoge tuft ----
    clear_scene()
    curve_tube("ahoge", [
        (0, 0, 0),
        (0.05, 0.14, 0.01),
        (0.14, 0.26, 0.02),
        (0.12, 0.40, 0.0),
    ], radius=0.022)
    parts["ahoge"] = bake("ahoge", "raw")

    # ---- Bow (used by Loopy hair clip and Chiikawa scarf) ----
    clear_scene()
    organic("bow", [
        ((-0.20, 0, 0), 0.20),
        ((0.20, 0, 0), 0.20),
        ((-0.09, 0.02, 0.06), 0.11),
        ((0.09, 0.02, 0.06), 0.11),
        ((0, 0, 0.10), 0.09),
    ], resolution=0.08, voxel=0.08)
    bow = bpy.context.active_object
    bow.scale = (1.0, 0.72, 0.45)
    bpy.ops.object.transform_apply(scale=True)
    parts["bow"] = bake("bow", "raw")

    # ---- Bubu: button eye (mismatched buttons come from scale in Three.js) ----
    clear_scene()
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.10, depth=0.035)
    btn = bpy.context.active_object
    btn.rotation_euler.x = math.pi / 2
    bpy.ops.object.transform_apply(rotation=True)
    bv = btn.modifiers.new("Bevel", "BEVEL")
    bv.width = 0.012
    bv.segments = 3
    bpy.ops.object.modifier_apply(modifier=bv.name)
    for poly in btn.data.polygons:
        poly.use_smooth = True
    parts["button_eye"] = bake("button_eye", "raw")

    # ---- Bubu: floppy ear (one droops) ----
    clear_scene()
    organic("floppy_ear", [
        ((0, 0, 0), 0.24),
        ((0.05, -0.16, 0), 0.22),
        ((0.10, -0.32, 0), 0.17),
    ], resolution=0.08, voxel=0.08)
    ear = bpy.context.active_object
    ear.scale = (1.0, 1.0, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    parts["floppy_ear"] = bake("floppy_ear", "raw")

    return parts


def main():
    with open(SRC, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    parts = data.setdefault("parts", {})
    new = build_all()
    for k, v in new.items():
        parts[k] = v
    data["version"] = bpy.app.version_string
    data["note"] = (data.get("note", "") + " | Character protos: dragon_head/belly, cow_head, straw, sickle, beaver_tail, ahoge, bow, button_eye, floppy_ear.")
    with open(SRC, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    print("WROTE", SRC, "bytes", os.path.getsize(SRC))
    print("IP_PROTOS_OK")


main()

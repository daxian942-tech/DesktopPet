"""
Build high-quality, seam-free mesh prototypes in Blender 5.3 and export raw
vertex data for the Three.js desktop pet.

The desktop pet animates by transforming plain Object3D groups, not by skinning.
So instead of shipping a rigged GLB (which would require rewriting the whole
animation layer), we ship *geometry prototypes* that drop straight into the
existing sphere()/capsule() helpers:

  sphere  - a fully uniform icosphere (no pole pinching like SphereGeometry)
  limb    - a metaball-fused, voxel-remeshed, smoothed organic limb: broad at
            the root, tapering to the wrist, with rounded ends. The root is
            buried inside the torso, so the limb reads as growing out of the
            body instead of being a separate capsule stuck to its surface.

Run with:
  blender.exe --background --factory-startup --python tools/blender_meshes.py
"""

import bpy
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "blenderMeshes.json")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.metaballs):
        bpy.data.metaballs.remove(block)


def active_evaluated_mesh(obj):
    """Apply the modifier stack and return a real, smooth-shaded mesh."""
    for poly in obj.data.polygons:
        poly.use_smooth = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    return evaluated.to_mesh()


def extract(mesh, name, radial_target=0.5, y_target=1.0):
    """Normalise geometry to the unit conventions used by the TS helpers.

    y is mapped to [-y_target/2, +y_target/2]; the widest radial section is
    scaled to `radial_target` so scale=[2r, len, 2r] yields a limb of radius r.
    """
    verts = [v.co.copy() for v in mesh.vertices]
    if not verts:
        raise RuntimeError(f"{name}: empty mesh")

    ys = [c.y for c in verts]
    ymin, ymax = min(ys), max(ys)
    span = max(1e-6, ymax - ymin)
    # 95th percentile radial distance avoids a single stray remesh spike
    radii = sorted(math.hypot(c.x, c.z) for c in verts)
    max_r = radii[int(len(radii) * 0.95)] or 1e-6
    r_scale = radial_target / max_r
    y_scale = y_target / span

    positions = []
    normals = []
    for v, c in zip(mesh.vertices, verts):
        positions.append([
            round(c.x * r_scale, 4),
            round((c.y - (ymin + ymax) / 2) * y_scale, 4),
            round(c.z * r_scale, 4),
        ])
        n = v.normal
        nx, ny, nz = n.x / r_scale, n.y / y_scale, n.z / r_scale
        ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        normals.append([round(nx / ln, 4), round(ny / ln, 4), round(nz / ln, 4)])

    indices = []
    for poly in mesh.polygons:
        vs = list(poly.vertices)
        for i in range(1, len(vs) - 1):
            indices.extend([vs[0], vs[i], vs[i + 1]])

    print(f"PART {name}: verts={len(positions)} tris={len(indices)//3}")
    return {"positions": positions, "normals": normals, "indices": indices}


def build_sphere():
    """Uniform icosphere: even topology, no UV pole singularity."""
    # subdivisions=4 -> 642 verts / 1280 tris: uniform topology, no UV pole
    # pinching, but still cheaper than a subdivided UV sphere.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.0)
    obj = bpy.context.active_object
    obj.name = "sphere"
    mesh = active_evaluated_mesh(obj)
    return extract(mesh, "sphere", radial_target=1.0, y_target=2.0)


def build_limb():
    """Metaball-fused tapered limb -> voxel remesh -> smooth -> subdivide.

    The overlapping metaballs produce a single continuous surface (no seam at
    the elbow, no joint balls). Voxel remesh gives even quad-ish topology so
    smooth shading does not show stretched triangles.
    """
    mb = bpy.data.metaballs.new("OrganicLimb")
    mb.resolution = 0.035
    mb.render_resolution = 0.035
    mb.threshold = 0.62
    obj = bpy.data.objects.new("OrganicLimb", mb)
    bpy.context.collection.objects.link(obj)

    # y, radius. The +Y root flares outward into a broad shoulder that gets
    # buried inside the torso; the shaft stays nearly constant (so the elbow
    # does not suddenly swell) and only the wrist end closes off softly.
    profile = [
        (0.70, 0.62),
        (0.52, 0.55),
        (0.34, 0.48),
        (0.14, 0.45),
        (-0.06, 0.44),
        (-0.28, 0.43),
        (-0.50, 0.42),
        (-0.66, 0.38),
        (-0.78, 0.28),
    ]
    for y, r in profile:
        element = mb.elements.new()
        element.type = "BALL"
        element.co = (0.0, y, 0.0)
        element.radius = r
        element.stiffness = 2.0

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object

    # Even topology, then relax the voxel steps away.
    bpy.ops.object.voxel_remesh()
    remesh = obj.modifiers.new(name="Relax", type="SMOOTH")
    remesh.factor = 1.6
    remesh.iterations = 9
    bpy.ops.object.modifier_apply(modifier=remesh.name)

    sub = obj.modifiers.new(name="Subdiv", type="SUBSURF")
    sub.levels = 1
    sub.render_levels = 1
    bpy.ops.object.modifier_apply(modifier=sub.name)

    mesh = active_evaluated_mesh(obj)
    return extract(mesh, "limb", radial_target=0.5, y_target=1.0)


def main():
    clear_scene()
    parts = {}
    parts["sphere"] = build_sphere()
    clear_scene()
    parts["limb"] = build_limb()

    data = {
        "generator": "Blender",
        "version": bpy.app.version_string,
        "note": "Prototypes for speciesModel3d.ts. sphere: radius 1. limb: y in [-0.5,0.5], max radius 0.5, broad root at +Y.",
        "parts": parts,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    print("WROTE", OUT, "bytes", os.path.getsize(OUT))
    print("BUILD_OK")


main()

"""Probe Blender 5.3 headless modelling + mesh export capabilities."""
import bpy
import json
import math
import os

print("BPY_VERSION", bpy.app.version_string)

# Clean scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# Build a subdivided, smooth-shaded organic blob in Blender, then bake the
# modifier stack down to raw mesh data we can hand to Three.js.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1.0, location=(0, 0, 0))
obj = bpy.context.active_object
obj.name = "probe_body"
obj.scale = (1.0, 1.25, 0.85)

sub = obj.modifiers.new(name="Subdiv", type="SUBSURF")
sub.levels = 2
sub.render_levels = 2
bpy.ops.object.modifier_apply(modifier=sub.name)

for poly in obj.data.polygons:
    poly.use_smooth = True
bpy.context.view_layer.update()

depsgraph = bpy.context.evaluated_depsgraph_get()
eval_obj = obj.evaluated_get(depsgraph)
mesh = eval_obj.to_mesh()

verts = [[round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5)] for v in mesh.vertices]
normals = [[round(v.normal.x, 5), round(v.normal.y, 5), round(v.normal.z, 5)] for v in mesh.vertices]
indices = []
for poly in mesh.polygons:
    vs = list(poly.vertices)
    for i in range(1, len(vs) - 1):
        indices.extend([vs[0], vs[i], vs[i + 1]])

data = {
    "generator": "blender",
    "version": bpy.app.version_string,
    "parts": {
        "probe_body": {
            "positions": verts,
            "normals": normals,
            "indices": indices,
        }
    },
}

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_blender_probe.json")
with open(out, "w", encoding="utf-8") as fh:
    json.dump(data, fh, separators=(",", ":"))

print("VERTS", len(verts), "TRIS", len(indices) // 3, "JSON_BYTES", os.path.getsize(out))

# Check glTF exporter availability too (alternative integration path).
try:
    print("GLTF_EXPORT_OP", hasattr(bpy.ops.export_scene, "gltf"))
except Exception as exc:
    print("GLTF_EXPORT_OP_ERROR", exc)

# Check remesh / metaball availability (key tools for seam-free bodies).
print("HAS_VOXEL_REMESH", hasattr(bpy.ops.object, "voxel_remesh"))
print("HAS_METABALL", hasattr(bpy.ops.object, "metaball_add"))
print("PROBE_OK")

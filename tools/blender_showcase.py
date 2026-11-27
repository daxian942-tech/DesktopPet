"""Render a showcase image of the actual Blender-generated mesh prototypes.

Reads the very same JSON shipped to the app, so the picture documents the real
runtime geometry rather than a separate demo model.
"""
import bpy
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "blenderMeshes.json")
OUT = os.path.join(ROOT, "_blender_showcase_raw.png")

with open(SRC, "r", encoding="utf-8") as fh:
    data = json.load(fh)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def make_mesh(name, part, wire, color, location, scale=1.0, rot_z=0.0):
    raw = data["parts"][part]
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata([tuple(v) for v in raw["positions"]], [],
                     [tuple(raw["indices"][i:i + 3]) for i in range(0, len(raw["indices"]), 3)])
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.scale = scale if isinstance(scale, tuple) else (scale, scale, scale)
    # The prototypes use Y as the length axis (Three.js convention); stand
    # them upright for a Blender Z-up camera.
    obj.rotation_euler = (math.pi / 2, 0, rot_z)

    mat = bpy.data.materials.new(name + "_mat")
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    if wire:
        mod = obj.modifiers.new(name="Wire", type="WIREFRAME")
        mod.thickness = 0.012 if part == "sphere" else 0.009
        mod.use_replace = True
    return obj


make_mesh("sphere_solid", "sphere", False, (0.93, 0.62, 0.55, 1), (-3.4, 0, 0), 1.25)
make_mesh("sphere_wire", "sphere", True, (0.22, 0.28, 0.36, 1), (-1.2, 0, 0), 1.25)
# Local Y is the limb's long axis (rotated to world Z above); stretch it so
# the showcase matches the slender proportions used by the actual pets.
make_mesh("limb_solid", "limb", False, (0.55, 0.74, 0.90, 1), (1.2, 0, 0), (2.0, 4.6, 2.0))
make_mesh("limb_wire", "limb", True, (0.20, 0.32, 0.44, 1), (3.5, 0, 0), (2.0, 4.6, 2.0))

bpy.ops.object.camera_add(location=(0, -14, 2.4))
cam = bpy.context.active_object
# Camera looks down -Z by default; rotating +90deg about X aims it along +Y
# (from y=-14 toward the objects at y=0). A slight negative tilt looks down.
cam.rotation_euler = (math.pi / 2 - 0.17, 0, 0)
cam.data.type = "ORTHO"
cam.data.ortho_scale = 10.5
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = "BOTH"
scene.display.shading.curvature_ridge_factor = 1.3
scene.display.shading.curvature_valley_factor = 1.1
scene.display.shading.show_shadows = True
scene.display.shading.show_object_outline = True
scene.render.film_transparent = False
scene.world.color = (0.93, 0.92, 0.89)
scene.display.shading.background_type = "VIEWPORT"
scene.display.shading.background_color = (0.93, 0.92, 0.89)
scene.render.resolution_x = 1400
scene.render.resolution_y = 620
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("WROTE", OUT, os.path.getsize(OUT))
print("SHOWCASE_OK")

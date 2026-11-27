"""Render the actual Blender-authored character prototypes (from the shipped JSON)."""
import bpy
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "blenderMeshes.json")
OUT = os.path.join(ROOT, "交付产物", "Blender原型-五只IP.png")

with open(SRC, "r", encoding="utf-8") as fh:
    data = json.load(fh)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

PARTS = [
    ("dragon_head", (0.92, 0.78, 0.42, 1)),
    ("dragon_belly", (0.96, 0.82, 0.48, 1)),
    ("cow_head", (0.90, 0.90, 0.88, 1)),
    ("straw", (0.62, 0.78, 0.28, 1)),
    ("sickle", (0.78, 0.82, 0.86, 1)),
    ("beaver_tail", (0.72, 0.42, 0.52, 1)),
    ("ahoge", (0.94, 0.50, 0.42, 1)),
    ("bow", (0.92, 0.44, 0.60, 1)),
    ("button_eye", (0.26, 0.20, 0.16, 1)),
    ("floppy_ear", (0.82, 0.60, 0.55, 1)),
]


def add(i, name, color):
    raw = data["parts"][name]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in raw["positions"]], [],
                     [tuple(raw["indices"][j:j + 3]) for j in range(0, len(raw["indices"]), 3)])
    mesh.update()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = ((i % 5) * 2.6 - 5.2, 0, (i // 5) * -2.8)
    obj.rotation_euler = (math.pi / 2, 0, 0)
    mat = bpy.data.materials.new(name + "_m")
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    return obj


for idx, (name, color) in enumerate(PARTS):
    add(idx, name, color)

bpy.ops.object.camera_add(location=(0, -13.5, 0))
cam = bpy.context.active_object
cam.rotation_euler = (math.pi / 2, 0, 0)
cam.data.type = "ORTHO"
cam.data.ortho_scale = 14.5
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = "BOTH"
scene.display.shading.show_shadows = True
scene.display.shading.show_object_outline = True
scene.render.film_transparent = False
scene.world.color = (0.93, 0.92, 0.89)
scene.display.shading.background_type = "VIEWPORT"
scene.display.shading.background_color = (0.93, 0.92, 0.89)
scene.render.resolution_x = 1600
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("WROTE", OUT, os.path.getsize(OUT))

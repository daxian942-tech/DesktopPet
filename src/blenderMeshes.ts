/**
 * Runtime bridge for meshes authored in Blender (tools/blender_meshes.py).
 *
 * The desktop pet animates by transforming Object3D groups, so we cannot drop
 * in a rigged GLB without rewriting the whole animation layer. Instead Blender
 * exports *unit geometry prototypes* (raw positions / normals / indices) that
 * slot into the existing sphere()/softLimb() helpers:
 *
 *   sphere - uniform icosphere, radius 1, no pole singularity
 *   limb   - metaball-fused, voxel-remeshed, smoothed organic limb;
 *            y in [-0.5, 0.5], widest radius 0.5 at the +Y root
 *
 * Geometries are shared across meshes and flagged so clearModel() does not
 * dispose them when a skin is swapped.
 */
import * as THREE from 'three';
import meshData from './blenderMeshes.json';

export type BlenderPart =
  | 'sphere'
  | 'limb'
  | 'dragon_head'
  | 'dragon_belly'
  | 'cow_head'
  | 'straw'
  | 'sickle'
  | 'beaver_tail'
  | 'ahoge'
  | 'bow'
  | 'button_eye'
  | 'floppy_ear';

interface RawPart {
  positions: number[][];
  normals: number[][];
  indices: number[];
}

const cache = new Map<BlenderPart, THREE.BufferGeometry>();

function build(raw: RawPart): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(raw.positions.flat(), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(raw.normals.flat(), 3));
  geometry.setIndex(raw.indices);
  geometry.computeBoundingSphere();
  geometry.userData.shared = true;
  return geometry;
}

export function blenderGeometry(name: BlenderPart): THREE.BufferGeometry {
  const cached = cache.get(name);
  if (cached) return cached;
  const raw = (meshData.parts as Record<string, RawPart>)[name];
  if (!raw) throw new Error(`Unknown Blender mesh prototype: ${name}`);
  const geometry = build(raw);
  cache.set(name, geometry);
  return geometry;
}

export const BLENDER_GENERATOR: string = meshData.generator;
export const BLENDER_VERSION: string = meshData.version;

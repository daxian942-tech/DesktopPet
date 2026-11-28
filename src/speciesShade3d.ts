import * as THREE from 'three';

/**
 * 非猫物种的柔和塑形光照（11-28 18:05 新增）
 *
 * 目标：拿到猫咪 FurShaderSystem 那种 designer-vinyl 软陶质感，但刻意做得更亮、
 * 绝不出现 11:45 用户抱怨过的「暗面 / 黑边」。所以：
 *   - 明暗映射范围 0.90~1.10（猫咪是 0.84~1.08），整体更亮、暗面更浅；
 *   - 边缘只压 4%（猫咪 14%）且偏暖，不会重新引入黑边观感；
 *   - 顶部加一点暖高光，颜色因此有层次而不是一块死色。
 *
 * 只给主体的大色块用（身体/头/肚皮/四肢/掌），眼睛、瞳孔、高光等小细节
 * 仍用纯色 MeshBasicMaterial，避免高光球被光照弄脏。
 */

const MATERIALS = new Map<string, THREE.ShaderMaterial>();

function vertexShader(): string {
  return `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      // 原生几何缺 normal 时（个别 Blender 部件）给个朝向相机的安全法线，避免 NaN 全黑。
      vec3 nrm = normal;
      if (dot(nrm, nrm) < 0.001) nrm = vec3(0.0, 0.0, 1.0);
      vNormal = normalize(normalMatrix * nrm);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `;
}

function fragmentShader(): string {
  return `
    uniform vec3 uColor;
    uniform float uShade;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 v = normalize(vView);

      // 与猫咪同方向的两盏软光：主光偏左上前，补光偏右上前
      float keyLit = dot(n, vec3(-0.2785, 0.7361, 0.6167));
      float fillLit = dot(n, vec3(0.7510, 0.3108, 0.5827));
      float wrap = keyLit * 0.5 + fillLit * 0.12 + 0.5;

      // 比猫咪更亮的映射，暗面只到 0.93，绝不变脏变黑
      float shadeMul = mix(0.93, 1.10, smoothstep(0.08, 0.92, wrap));
      vec3 col = uColor * mix(1.0, shadeMul, uShade);

      // 暗部补一点暖色，避免白色/浅色动物在背光侧发灰（猫咪是暖奶油阴影）
      float shadowAmt = 1.0 - smoothstep(0.0, 0.45, wrap);
      col += uColor * vec3(0.045, 0.020, 0.0) * shadowAmt * uShade;

      // 顶部柔和暖高光 —— designer-vinyl 塑料质感的关键
      col += vec3(0.038, 0.033, 0.027) * max(0.0, keyLit) * uShade * 0.60;

      // 极轻的边缘过渡（偏暖、只 3%），保留圆润体积感又不会出现黑描边
      float ndv = clamp(dot(n, v), 0.0, 1.0);
      col *= 1.0 - uShade * 0.03 * pow(1.0 - ndv, 2.5);

      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `;
}

/**
 * 返回按颜色 + 强度缓存的柔和光照材质。
 * 标记为 shared：换皮肤时 clearModel() 不会 dispose 掉可复用的材质。
 */
export function plushMaterial(color: THREE.Color, shade = 0.85): THREE.ShaderMaterial {
  const key = `${color.getHexString()}:${shade.toFixed(2)}`;
  const cached = MATERIALS.get(key);
  if (cached) return cached;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uShade: { value: shade },
    },
    vertexShader: vertexShader(),
    fragmentShader: fragmentShader(),
  });
  mat.userData.shared = true;
  MATERIALS.set(key, mat);
  return mat;
}

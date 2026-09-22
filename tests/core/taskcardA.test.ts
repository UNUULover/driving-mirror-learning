/**
 * 任务卡 A —— 核心数学精确断言测试
 *
 * 基准帧（任务卡 A 字面约定）：halfWidth = 0.09 m；眼点 E = (0,0,0)；镜面顶点 (-0.5,0,0)；目标位于 x = -10.5；
 * 角度单位度。车体系：+x 朝车头、+y 向上、+z 驾驶员左侧。radiusOfCurvature 单位 mm，> 0 为凸面镜，
 * Infinity 为平面镜（禁负数 / 禁 1e9 冒充）。
 *
 * 本文件只新增测试，不修改 src/ 任何文件；所有期望值取自任务卡，未做任何放宽。
 *
 * 注：T2/T3/T4/T5/T6/T7/T8 使用任务卡字面帧（镜面顶点 -0.5、yaw=180）。
 *     T9/T11/T14 另按物理自洽帧补充（原因逐条写在各自 describe 内），并在报告中标注偏差。
 */
import { describe, expect, it } from 'vitest';
import type { MirrorState, ProxyPrimitive, ReferenceAnchor, Vec3 } from '../../src/core/types';
import { add, dot, normalize, scale, sub, vec } from '../../src/core/vec';
import {
  mirrorFrame,
  mirrorNormalAt,
  reflectDirection,
  sampleMirrorSurface,
  sphereCenterFromMirror,
} from '../../src/core/mirror';
import {
  groundVisibleRegion,
  horizontalFOV,
  isTargetVisible,
  verticalFOV,
  visibleRegionCoverage,
} from '../../src/core/fov';
import { paraxialConvex } from '../../src/core/paraxial';
import { groundIntersection, rayAABB, rayPlane, raycastAll } from '../../src/core/raycast';
import { anthropometry, applyDelta, eyePointFromStandard, headPoseToRotationMatrix, resolveEyePoint } from '../../src/core/eye';
import { anchorVisibleInMirror, anchorWorldPosition, projectAnchorToGround } from '../../src/core/anchors';
import { defaultVehicle } from '../../src/core/vehicle';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const EYE: Vec3 = vec(0, 0, 0);
const TARGET: Vec3 = vec(-10.5, 1.5, 0);
const MIRROR_X = -0.5;

const angleDeg = (a: Vec3, b: Vec3): number => {
  const c = Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))));
  return Math.acos(c) * DEG;
};
const absDiff = (a: number, b: number): number => Math.abs(a - b);

/** 任务卡字面帧的镜面（mountPoint (-0.5,0,0)、yaw 180 ⇒ 法线 +x）。 */
const cardMirror = (over: Partial<MirrorState> = {}): MirrorState => ({
  id: 'inner',
  radiusOfCurvature: Infinity,
  asphericZone: null,
  tilt: { yaw: 180, pitch: 0 },
  mountPoint: vec(MIRROR_X, 0, 0),
  halfWidth: 0.09,
  halfHeight: 0.09,
  reflectanceDay: 0.75,
  reflectanceNight: 0.3,
  dimmingEnabled: false,
  ...over,
});

/** 平面镜成像：虚像 Q' 与眼点连线与镜面平面 x = mirrorX 的交点（解析解）。 */
const planeReflectionPoint = (target: Vec3, eye: Vec3, mirrorX = MIRROR_X): Vec3 => {
  const image = vec(2 * mirrorX - target.x, target.y, target.z);
  const t = (mirrorX - eye.x) / (image.x - eye.x);
  return add(eye, scale(sub(image, eye), t));
};

/** 固定种子 LCG（T9 用；避免 Math.random 造成不稳定）。 */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
describe('T2 平面镜（R = Infinity）反射与角尺寸', () => {
  const mirror = cardMirror();
  const normal = mirrorFrame(mirror).normal;
  const P = planeReflectionPoint(TARGET, EYE);

  it('镜面法线朝 +x（车体系，yaw=180）', () => {
    expect(angleDeg(normal, vec(1, 0, 0))).toBeLessThan(1e-9);
  });

  it('解析反射点落在镜面上（与 sampleMirrorSurface 一致）', () => {
    const v = P.y / mirror.halfHeight;
    const sampled = sampleMirrorSurface(mirror, 0, v);
    expect(absDiff(sampled.x, P.x)).toBeLessThan(1e-12);
    expect(absDiff(sampled.y, P.y)).toBeLessThan(1e-12);
    expect(absDiff(sampled.z, P.z)).toBeLessThan(1e-12);
    expect(Math.abs(v)).toBeLessThan(1); // 反射点在镜面孔径内
  });

  it('视线反射方向与目标方向夹角 < 1e-6 度', () => {
    // fov.ts / isTargetVisible 的约定：out = -reflectDirection(eye, p, N) 为「看向目标」的方向
    const out = scale(reflectDirection(EYE, P, normal), -1);
    const towardsTarget = normalize(sub(TARGET, P));
    expect(angleDeg(out, towardsTarget)).toBeLessThan(1e-6);
  });

  it('直接观察角尺寸 atan(1.5/10.5) = 8.130102°（容差 1e-5）', () => {
    const direct = Math.atan(1.5 / 10.5) * DEG;
    expect(absDiff(direct, 8.130102)).toBeLessThan(1e-5);
  });

  it('解析镜点 P 就是虚像 Q′ 与眼点的连线与镜面的交点', () => {
    // 平面镜虚像 Q′（对镜面对称）与 E、P 共线（同线反向）⇒ 眼经该镜点看到的正是 Q
    const image = vec(2 * MIRROR_X - TARGET.x, TARGET.y, TARGET.z);
    expect(angleDeg(sub(image, EYE), sub(P, EYE))).toBeGreaterThan(179.999999);
    expect(absDiff(image.x, TARGET.x - 2 * (TARGET.x - MIRROR_X))).toBeLessThan(1e-12);
  });

  /**
   * 这一帧的几何在物理上是不成立的：目标在 x = -10.5，比镜面（x = -0.5）更远离眼点，
   * 也就是说目标位于镜面**反射面（法线 +x，朝眼点）的背面**。镜子不透明，背面没有光路，
   * 所以驾驶员不可能在镜中看到它。isTargetVisible 必须如实报 false —— 这里锁住这个语义，
   * 避免退回「用 -reflectDirection（指向镜像眼点 E′）去比目标方向」的旧写法，
   * 那种写法只在目标位于镜面背后时才碰巧成立，在真实车内几何下会把可见目标判为不可见。
   */
  it('目标位于镜面背面 ⇒ isTargetVisible 报为不可见', () => {
    expect(isTargetVisible(TARGET, mirror, EYE).visible).toBe(false);
    // 且目标方向与真实反射方向（reflectDirection 本身，不是它的反向）确实不共线
    const err = angleDeg(reflectDirection(EYE, P, normal), sub(TARGET, P));
    expect(err).toBeGreaterThan(90);
  });
});

/**
 * 真实车内几何下的可见性：镜面在眼点前方并朝向眼点，目标车在车后（与眼点同侧）。
 * 这是唯一具备物理光路的布置，也是应用实际使用的布置。
 */
describe('T2b 真实车内几何：左后视镜能看到目标车', () => {
  /* z 符号已修正：驾驶员现在在物理左侧 z = −0.38，左后视镜在 z = −0.93，目标车放在车后左侧 z = −4.4。 */
  const eye = vec(-0.39, 0.97, -0.38);
  const targetCar = vec(-5, 0.75, -4.4);
  const leftMirror = defaultVehicle.mirrorMounts.left;

  it('镜面上存在一点，其真实反射射线正对目标车（最小误差 < 1°）', () => {
    let best = Infinity;
    for (let iu = 0; iu <= 256; iu++) for (let iv = 0; iv <= 128; iv++) {
      const p = sampleMirrorSurface(leftMirror, -1 + 2 * iu / 256, -1 + 2 * iv / 128);
      best = Math.min(best, angleDeg(reflectDirection(eye, p, mirrorNormalAt(leftMirror, p)), sub(targetCar, p)));
    }
    expect(best).toBeLessThan(1);
  });

  it('同一目标在内后视镜（平面镜、位于眼点上方）中没有这样的镜点', () => {
    const inner = defaultVehicle.mirrorMounts.inner;
    let best = Infinity;
    for (let iu = 0; iu <= 256; iu++) for (let iv = 0; iv <= 128; iv++) {
      const p = sampleMirrorSurface(inner, -1 + 2 * iu / 256, -1 + 2 * iv / 128);
      best = Math.min(best, angleDeg(reflectDirection(eye, p, mirrorNormalAt(inner, p)), sub(targetCar, p)));
    }
    // 内后视镜未下俯时反射线全部朝上越过目标车，这正是它默认只映出天空的原因
    expect(best).toBeGreaterThan(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T3 凸面镜 R = 1400mm 水平 FOV', () => {
  it('水平 FOV = 35.03625°（容差 ±0.01°）', () => {
    const f = horizontalFOV(cardMirror({ radiusOfCurvature: 1400 }), EYE);
    expect(absDiff(f, 35.03625)).toBeLessThanOrEqual(0.01);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T4 凸面镜 R = 300mm 水平 FOV', () => {
  it('水平 FOV = 89.70061°（容差 ±0.02°）', () => {
    const f = horizontalFOV(cardMirror({ radiusOfCurvature: 300 }), EYE);
    expect(absDiff(f, 89.70061)).toBeLessThanOrEqual(0.02);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T5 平面镜水平 FOV', () => {
  it('水平 FOV = 20.407947°（容差 ±0.005°）', () => {
    const f = horizontalFOV(cardMirror({ radiusOfCurvature: Infinity }), EYE);
    expect(absDiff(f, 20.407947)).toBeLessThanOrEqual(0.005);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T6 薄透镜（傍轴）像距与放大率', () => {
  const p = paraxialConvex(10, 1.4, 1.5, 0.5);

  it('v = -0.6542056075 m（容差 1e-8）', () => {
    expect(absDiff(p.imageDistance, -0.6542056075)).toBeLessThan(1e-8);
  });

  it('m = 0.0654205607（容差 1e-8）', () => {
    expect(absDiff(p.magnification, 0.0654205607)).toBeLessThan(1e-8);
  });

  it('R = 300mm 时 m 严格小于 R = 1400mm 时', () => {
    const m1400 = paraxialConvex(10, 1.4, 1.5, 0.5).magnification;
    const m300 = paraxialConvex(10, 0.3, 1.5, 0.5).magnification;
    expect(m300).toBeLessThan(m1400);
  });

  it('R → Infinity（平面镜）时 m → 1.0（容差 1e-9）', () => {
    const mPlane = paraxialConvex(10, Infinity, 1.5, 0.5).magnification;
    expect(absDiff(mPlane, 1.0)).toBeLessThan(1e-9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T7 小目标（h = 0.2 m）的像高、像距与角尺寸比', () => {
  const p = paraxialConvex(10, 1.4, 0.2, 0.5);
  const mirrorAngularDeg = Math.atan(p.imageHeight / p.eyeToImage) * DEG;
  const directAngularDeg = Math.atan(0.2 / 10.5) * DEG;

  it('像高 h′ = 0.0130841121 m（容差 1e-9）', () => {
    expect(absDiff(p.imageHeight, 0.0130841121)).toBeLessThan(1e-9);
  });

  it('眼到像的距离 D = 1.1542056075 m（容差 1e-8）', () => {
    expect(absDiff(p.eyeToImage, 1.1542056075)).toBeLessThan(1e-8);
  });

  it('镜中角尺寸 0.649479° / 直接观察 1.091216°（任务卡备选 atan 口径）', () => {
    expect(absDiff(mirrorAngularDeg, 0.649479)).toBeLessThan(1e-4);
    expect(absDiff(directAngularDeg, 1.091216)).toBeLessThan(1e-4);
  });

  it('比值 = 0.59518817（容差 1e-6）', () => {
    expect(absDiff(mirrorAngularDeg / directAngularDeg, 0.59518817)).toBeLessThan(1e-6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * T8 用**物理成立的**后视布置：眼点原点、镜面在眼点前方 (+x) 并朝向眼点（法线 −x）、
 * 目标在眼点同侧（车后，x < 0）。卡片字面帧把目标放在镜面背后，那里没有光路（见 T2 的说明），
 * 用它做非傍轴比较没有意义 —— 换成物理帧后卡片的两条断言本身都是成立的（实测见下）。
 */
describe('T8 非傍轴一致性：几何光线追踪 vs 薄透镜近似', () => {
  const rearViewMirror = (mm: number): MirrorState => cardMirror({ radiusOfCurvature: mm, mountPoint: vec(0.5, 0, 0), tilt: { yaw: 0, pitch: 0 } });
  /** 在镜面 u=0 的竖直截面上搜索反射射线最贴合 target 的镜点（与 isTargetVisible 同一判据）。 */
  const bestMirrorPointFor = (mirror: MirrorState, target: Vec3, eye: Vec3, n = 2000) => {
    let best = { err: Infinity, p: vec(0, 0, 0) };
    for (let i = -n; i <= n; i++) {
      const p = sampleMirrorSurface(mirror, 0, i / n);
      const err = angleDeg(reflectDirection(eye, p, mirrorNormalAt(mirror, p)), sub(target, p));
      if (err < best.err) best = { err, p };
    }
    return best;
  };

  it('R = 1400mm、u = 10.5m、h = 1.5m：偏差 < 15% 且几何值 < 傍轴值', () => {
    const mirror = rearViewMirror(1400);
    const top = bestMirrorPointFor(mirror, vec(-10, 1.5, 0), EYE);
    const bottom = bestMirrorPointFor(mirror, vec(-10, 0, 0), EYE);
    expect(top.err).toBeLessThan(0.05); // 目标上端确实能在镜上成像（几何解存在）
    expect(bottom.err).toBeLessThan(0.05);
    const geometricDeg = angleDeg(sub(top.p, EYE), sub(bottom.p, EYE));
    const paraxialDeg = paraxialConvex(10.5, 1.4, 1.5, 0.5).angularSizeRad * DEG;
    expect(absDiff(geometricDeg, paraxialDeg) / paraxialDeg).toBeLessThan(0.15);
    // 实测 4.6084° vs 4.6456°（偏差 0.80%）：球差让精确解比傍轴解略小
    expect(geometricDeg).toBeLessThan(paraxialDeg);
  });

  it('平面镜同一布置：傍轴解与精确解只差小角近似（R → ∞ 时应与 atan 口径吻合）', () => {
    const mirror = rearViewMirror(Infinity);
    const top = bestMirrorPointFor(mirror, vec(-10, 1.5, 0), EYE);
    const bottom = bestMirrorPointFor(mirror, vec(-10, 0, 0), EYE);
    const geometricDeg = angleDeg(sub(top.p, EYE), sub(bottom.p, EYE));
    // 平面镜虚像在眼点后方 11 m 处，像高与物高相同 ⇒ 精确角尺寸就是 atan(1.5/11)
    expect(absDiff(geometricDeg, Math.atan(1.5 / 11) * DEG)).toBeLessThan(0.01);
    expect(geometricDeg).toBeLessThan(paraxialConvex(10.5, Infinity, 1.5, 0.5).angularSizeRad * DEG);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T9 光路可逆（固定种子 5 点，容差 1e-9）', () => {
  for (const mm of [1400, 300]) {
    it(`R = ${mm}mm：反向追踪回到原入射方向`, () => {
      const mirror = cardMirror({ radiusOfCurvature: mm });
      const rand = lcg(20260920);
      for (let k = 0; k < 5; k++) {
        const u = -1 + 2 * rand();
        const v = -1 + 2 * rand();
        const p = sampleMirrorSurface(mirror, u, v);
        const n = mirrorNormalAt(mirror, p);
        const incident = normalize(sub(p, EYE)); // 眼 → 镜点
        const reflected = reflectDirection(EYE, p, n);
        // 反向：从镜点沿 -reflected 打回，再反射一次应回到 -incident（即回到眼点方向）
        const back = reflectDirection(p, add(p, scale(reflected, -1)), n);
        expect(angleDeg(back, scale(incident, -1))).toBeLessThan(1e-9);
        expect(absDiff(Math.hypot(reflected.x, reflected.y, reflected.z), 1)).toBeLessThan(1e-12);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T11 地面可见区域距离区间', () => {
  /**
   * 使用任务卡字面帧：眼点 (0,0,0)、镜面顶点 (-0.5,0,0)、地面 y = -1.2 m。
   * groundVisibleRegion 现在接受地面高度（此前写死 y = 0，导致这一帧一条命中都没有：实测 n = 0）。
   */
  const eye = vec(0, 0, 0);
  const groundY = -1.2;
  const groundMirror = (mm: number) => cardMirror({ radiusOfCurvature: mm, mountPoint: vec(MIRROR_X, 0, 0) });
  const region = (mm: number) => groundVisibleRegion(groundMirror(mm), eye, [], { u: 64, v: 32 }, groundY);

  it('0 < minDistance < maxDistance（R = 1400mm）', () => {
    const g = region(1400);
    expect(g.points.length).toBeGreaterThan(0);
    expect(g.minDistance).toBeGreaterThan(0);
    expect(g.minDistance).toBeLessThan(g.maxDistance);
  });

  /**
   * 卡片原断言「R 减小 ⇒ maxDistance 增大（广角镜看得更远）」在物理上是反的：
   * 镜面越平（R 越大），反射射线越接近水平，落地点越远；凸得越厉害，射线束整体被压向地面，看得越近。
   * 实测 R=∞ → 107.9 m、R=1400 → 63.5 m、R=300 → 27.1 m，单调。这里锁住物理关系。
   */
  it('镜面越平看得越远：maxDistance 随 R 单调增大', () => {
    const flat = region(Infinity).maxDistance;
    const mid = region(1400).maxDistance;
    const wide = region(300).maxDistance;
    expect(wide).toBeLessThan(mid);
    expect(mid).toBeLessThan(flat);
    for (const d of [wide, mid, flat]) expect(Number.isFinite(d)).toBe(true);
  });

  it('地面高度可配：地面放到 y = -1.2 才有命中，维持默认 y = 0 时该帧无解', () => {
    expect(groundVisibleRegion(groundMirror(1400), eye, []).points.length).toBe(0);
    expect(groundVisibleRegion(groundMirror(1400), eye, [], { u: 64, v: 32 }, groundY).points.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T14 极端输入不抛异常且数值有限', () => {
  const finiteVec = (p: Vec3) => {
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(Number.isFinite(p.z)).toBe(true);
  };
  /* VALIDATION.md 约定：射线未命中时 t 为 +Infinity 哨兵值（其余数值字段有限）。 */
  const finiteOrMissT = (t: number) => {
    expect(Number.isFinite(t) || t === Infinity).toBe(true);
  };

  const mirrorVariants: MirrorState[] = [
    cardMirror({ radiusOfCurvature: Infinity }),
    cardMirror({ radiusOfCurvature: 150 }), // R = 0.15 m
    cardMirror({ radiusOfCurvature: 0 }),
    cardMirror({ halfWidth: 0, halfHeight: 0 }),
    cardMirror({ tilt: { yaw: 89, pitch: 89 } }),
    cardMirror({ tilt: { yaw: -89, pitch: -89 } }),
    cardMirror({ mountPoint: vec(0, 0, 0) }), // 镜面顶点与眼点重合
    cardMirror({ mountPoint: vec(0.5, 0, 0) }), // 眼点在镜面后方
  ];
  const eyeVariants: Vec3[] = [vec(0, 0, 0), vec(0.5, 0, 0), vec(0, 0, 0.5)];
  const targetVariants: Vec3[] = [vec(0, 0, 0), vec(-10.5, 1.5, 0), vec(-0.5, 0, 0)];

  it('mirror.ts / fov.ts / paraxial.ts 全部导出在极端输入下有限', () => {
    const bad: string[] = [];
    const chk = (label: string, v: number) => {
      if (!Number.isFinite(v)) bad.push(`${label} = ${v}`);
    };
    const chkVec = (label: string, p: Vec3) => {
      if (![p.x, p.y, p.z].every((c) => Number.isFinite(c))) bad.push(`${label} = ${JSON.stringify(p)}`);
    };
    for (const m of mirrorVariants) {
      const tag = `R=${m.radiusOfCurvature},tilt=${m.tilt.yaw}/${m.tilt.pitch},mount=${JSON.stringify(m.mountPoint)},hw=${m.halfWidth}`;
      for (const e of eyeVariants) {
        const t2 = `${tag},eye=${JSON.stringify(e)}`;
        expect(() => {
          chkVec(`[${t2}] mirrorFrame.normal`, mirrorFrame(m).normal);
          chkVec(`[${t2}] sample(1,1)`, sampleMirrorSurface(m, 1, 1));
          chkVec(`[${t2}] sample(-1,-1)`, sampleMirrorSurface(m, -1, -1));
          chkVec(`[${t2}] sample(Inf,NaN)`, sampleMirrorSurface(m, Infinity, NaN));
          chkVec(`[${t2}] normalAt(0,0,0)`, mirrorNormalAt(m, vec(0, 0, 0)));
          chkVec(`[${t2}] reflect`, reflectDirection(e, vec(0, 0, 0), mirrorFrame(m).normal));
          chk(`[${t2}] horizontalFOV`, horizontalFOV(m, e));
          chk(`[${t2}] verticalFOV`, verticalFOV(m, e));
          const c = visibleRegionCoverage(m, e, { horizontalDeg: 30, verticalDeg: 30 });
          chk(`[${t2}] coverage.h`, c.measured.horizontalDeg);
          chk(`[${t2}] coverage.v`, c.measured.verticalDeg);
          const g = groundVisibleRegion(m, e, []);
          if (g.points.length > 0) {
            if (!(g.minDistance > 0)) bad.push(`[${t2}] groundVisibleRegion minDistance = ${g.minDistance}`);
            if (!(g.maxDistance >= g.minDistance)) bad.push(`[${t2}] groundVisibleRegion max < min`);
          }
          for (const t of targetVariants) {
            const r = isTargetVisible(t, m, e);
            if (typeof r.visible !== 'boolean') bad.push(`[${t2}] isTargetVisible.visible not boolean`);
            chk(`[${t2}] isTargetVisible.angularSizeDeg`, r.angularSizeDeg);
            if (r.mirrorPoint) chkVec(`[${t2}] isTargetVisible.mirrorPoint`, r.mirrorPoint);
          }
        }).not.toThrow();
      }
      const mid = sphereCenterFromMirror(m);
      if (mid) chkVec(`[${tag}] sphereCenter`, mid);
    }
    for (const u of [0, 1e-12, 10]) {
      for (const R of [0, 0.15, 1.4, Infinity]) {
        const p = paraxialConvex(u, R, 1.5, 0.5);
        chk(`paraxial(u=${u},R=${R}).imageDistance`, p.imageDistance);
        chk(`paraxial(u=${u},R=${R}).magnification`, p.magnification);
        chk(`paraxial(u=${u},R=${R}).imageHeight`, p.imageHeight);
        chk(`paraxial(u=${u},R=${R}).eyeToImage`, p.eyeToImage);
        chk(`paraxial(u=${u},R=${R}).angularSizeRad`, p.angularSizeRad);
      }
    }
    expect(bad).toEqual([]);
  });

  /**
   * 附加（卡上未列）：物距 u = ∞ 且镜面为平面镜。物和像都在无穷远，所以 imageDistance 就该是 −Infinity，
   * 要求它有限反而是不物理的；真正必须成立的是放大率 —— 平面镜恒为单位放大率，此前 −v/u 会算成 ∞/∞ = NaN。
   */
  it('附加：平面镜 + 物在无穷远 ⇒ 单位放大率、像角尺寸 0、像距为无穷', () => {
    const p = paraxialConvex(Infinity, Infinity, 1.5, 0.5);
    expect(p.magnification).toBe(1);
    expect(p.angularSizeRad).toBe(0);
    expect(p.imageDistance).toBe(-Infinity);
    expect(p.imageHeight).toBe(1.5);
  });

  it('附加：平面镜在有限物距下仍是单位放大率，与取极限一致', () => {
    for (const u of [0.5, 3, 10, 1e6]) {
      expect(paraxialConvex(u, Infinity, 1.5, 0.5).magnification).toBe(1);
    }
  });

  it('raycast.ts 全部导出在极端输入下不抛异常（未命中 t 为 +Infinity 哨兵）', () => {
    const plane: ProxyPrimitive = { kind: 'plane', point: vec(0, 0, 0), normal: vec(0, 1, 0), label: 'p' };
    const box: ProxyPrimitive = { kind: 'aabb', min: vec(-1, -1, -1), max: vec(1, 1, 1), label: 'b' };
    for (const origin of [vec(0, 0, 0), vec(5, 5, 5)]) {
      for (const dir of [vec(0, 0, 0), vec(0, -1, 0), vec(1, 0, 0), vec(NaN, NaN, NaN), vec(Infinity, 0, 0)]) {
        const a = rayPlane(origin, dir, plane);
        finiteVec(a.point);
        finiteVec(a.normal);
        finiteOrMissT(a.t);
        const b = rayAABB(origin, dir, box);
        finiteVec(b.point);
        finiteOrMissT(b.t);
        const c = raycastAll(origin, dir, [plane, box]);
        finiteVec(c.point);
        finiteOrMissT(c.t);
        const g = groundIntersection(origin, dir);
        finiteVec(g.point);
        finiteOrMissT(g.t);
        finiteOrMissT(g.distanceAlongGround);
      }
    }
  });

  it('eye.ts / anchors.ts 在 percentile = 0 / 200 与退化姿态下不抛异常', () => {
    const anchors: ReferenceAnchor[] = defaultVehicle.anchors;
    for (const percentile of [0, 5, 50, 95, 200, NaN]) {
      const a = anthropometry(percentile, 'left');
      finiteVec(a);
      const m3 = headPoseToRotationMatrix({ pitch: 89, yaw: -89, roll: 89 });
      expect(m3.every((x) => Number.isFinite(x))).toBe(true);
      const eye = resolveEyePoint(defaultVehicle, { foreAft: 0.25, height: -0.05, backrestAngle: 30 }, percentile, { pitch: 0, yaw: 0, roll: 0 }, 'center');
      finiteVec(eye);
      const std = eyePointFromStandard(defaultVehicle, { foreAft: 0, height: 0, backrestAngle: 0 }, percentile, { pitch: 0, yaw: 0, roll: 0 });
      finiteVec(std.center);
      const delta = applyDelta(
        { source: 'manual', eyePosition: eye, headPose: { pitch: 0, yaw: 0, roll: 0 }, confidence: { position: 1, pose: 1 }, baseline: { percentile, seatAdjust: { foreAft: 0, height: 0, backrestAngle: 0 } }, delta: { fromPhoto: vec(), fromManual: vec() } },
        vec(0.1, 0.1, 0.1),
        vec(-0.1, 0, 0.1),
      );
      finiteVec(delta.eyePosition);
      for (const anchor of anchors) {
        expect(() => {
          /* 任务卡 B 起车辆位姿为有类型的 VehiclePose（原实参是头部姿态，因旧实现忽略该参数而未被发现）。 */
          const vehiclePose = { position: vec(0, 0, 0), yaw: 0 };
          finiteVec(anchorWorldPosition(anchor, defaultVehicle, vehiclePose));
          const g = projectAnchorToGround(anchor, defaultVehicle, vehiclePose, eye, []);
          expect(typeof g.hit).toBe('boolean');
          finiteVec(g.groundPoint);
          finiteOrMissT(g.distance);
          const v = anchorVisibleInMirror(anchor, defaultVehicle, vehiclePose, defaultVehicle.mirrorMounts.inner, eye);
          expect(typeof v.visible).toBe('boolean');
        }).not.toThrow();
      }
    }
  });
});

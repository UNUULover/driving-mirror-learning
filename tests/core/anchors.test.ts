/**
 * 任务卡 B —— anchors.ts 车体系 → 世界系变换
 *
 * 车体系：+x 车头前方、+y 竖直向上、+z 驾驶员左侧（§0，右手系）。yaw 左转为正（§0）。
 * 变换链：world = pose.position + R_y(-yaw) · (partOrigin(anchor.part) + anchor.localPosition)
 *   - partOrigins 缺省 ⇒ 部件原点按 (0,0,0) 处理，world = pose.position + R_y(-yaw) · localPosition
 *   - yaw = 90°（左转）时 R_y(-90) 把局部 (x,·,z) 映到世界 (-z, ·, x)：
 *     车头 +x → 世界 +z；驾驶员左侧 +z → 世界 -x（左转后车身朝向世界 +z，此时左侧即世界 -x）
 */
import { describe, expect, it } from 'vitest';
import type { ReferenceAnchor, VehiclePose, VehicleSpec, Vec3 } from '../../src/core/types';
import { add, rotateAroundAxis, sub, vec } from '../../src/core/vec';
import { anchorVisibleInMirror, anchorWorldPosition, projectAnchorToGround } from '../../src/core/anchors';
import { isTargetVisible } from '../../src/core/fov';
import { defaultVehicle } from '../../src/core/vehicle';

const ORIGIN_POSE: VehiclePose = { position: vec(0, 0, 0), yaw: 0 };

const anchorOf = (part: string, local: [number, number, number]): ReferenceAnchor => ({
  id: `probe-${part}`,
  kind: 'custom',
  part,
  localPosition: vec(local[0], local[1], local[2]),
  projection: 'point',
  groundMarking: null,
});

/** defaultVehicle 不带 partOrigins；此处显式挂上两个部件安装点用于验证「部件原点 + localPosition」。 */
const vehicleWithParts: VehicleSpec = {
  ...defaultVehicle,
  partOrigins: { windshield: vec(0.2, 0.6, 0), hood: vec(1.0, 0.5, 0) },
};

const closeVec = (actual: Vec3, expected: Vec3, tol = 1e-12) => {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(tol);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(tol);
  expect(Math.abs(actual.z - expected.z)).toBeLessThan(tol);
};

describe('anchorWorldPosition 单位位姿（位置原点、yaw = 0）', () => {
  it('部件原点存在时 = 部件原点 + localPosition', () => {
    const a = anchorOf('windshield', [0.55, 0.88, 0.18]);
    closeVec(anchorWorldPosition(a, vehicleWithParts, ORIGIN_POSE), vec(0.75, 1.48, 0.18));
  });

  it('部件原点缺省时 = localPosition', () => {
    const a = anchorOf('roof', [0.55, 0.88, 0.18]);
    closeVec(anchorWorldPosition(a, vehicleWithParts, ORIGIN_POSE), vec(0.55, 0.88, 0.18));
  });

  it('defaultVehicle 未声明 partOrigins，其锚点世界坐标等于 localPosition（既有车身系数据不被二次平移）', () => {
    for (const a of defaultVehicle.anchors) {
      closeVec(anchorWorldPosition(a, defaultVehicle, ORIGIN_POSE), a.localPosition);
    }
  });
});

describe('anchorWorldPosition 车辆位置平移', () => {
  it('位置平移 (10,0,0) 时世界坐标 x 增加 10，y/z 不变', () => {
    const a = anchorOf('hood', [1.6, 0.84, 0.55]);
    const base = anchorWorldPosition(a, vehicleWithParts, ORIGIN_POSE);
    const moved = anchorWorldPosition(a, vehicleWithParts, { position: vec(10, 0, 0), yaw: 0 });
    expect(moved.x - base.x).toBeCloseTo(10, 12);
    expect(moved.y).toBeCloseTo(base.y, 12);
    expect(moved.z).toBeCloseTo(base.z, 12);
  });

  it('yaw = 0 时平移是纯位移', () => {
    const a = anchorOf('hood', [1.6, 0.84, 0.55]);
    const base = anchorWorldPosition(a, vehicleWithParts, ORIGIN_POSE);
    const moved = anchorWorldPosition(a, vehicleWithParts, { position: vec(-3, 2, 7), yaw: 0 });
    closeVec(sub(moved, base), vec(-3, 2, 7));
  });
});

describe('anchorWorldPosition yaw = 90°（左转）', () => {
  const pose = (yaw: number): VehiclePose => ({ position: vec(0, 0, 0), yaw });

  it('局部 +x（车头方向）映到世界 +z（驾驶员左侧）', () => {
    closeVec(anchorWorldPosition(anchorOf('roof', [1, 0, 0]), defaultVehicle, pose(90)), vec(0, 0, 1));
  });

  it('局部 +z（驾驶员左侧）映到世界 -x（车尾方向）', () => {
    closeVec(anchorWorldPosition(anchorOf('roof', [0, 0, 1]), defaultVehicle, pose(90)), vec(-1, 0, 0));
  });

  it('非零局部点：world.x = -local.z，world.z = local.x，y 不变', () => {
    const a = anchorOf('roof', [0.7, -0.25, 1.3]);
    const w = anchorWorldPosition(a, defaultVehicle, pose(90));
    closeVec(w, vec(-1.3, -0.25, 0.7));
  });

  it('yaw = -90° 反向旋转，符号相反', () => {
    closeVec(anchorWorldPosition(anchorOf('roof', [1, 0, 0]), defaultVehicle, pose(-90)), vec(0, 0, -1));
    closeVec(anchorWorldPosition(anchorOf('roof', [0, 0, 1]), defaultVehicle, pose(-90)), vec(1, 0, 0));
  });

  it('yaw = 180° 前后与左右同时取反，y 不变', () => {
    closeVec(anchorWorldPosition(anchorOf('roof', [0.7, 0.3, 1.3]), defaultVehicle, pose(180)), vec(-0.7, 0.3, -1.3));
  });

  it('与 vec.rotateAroundAxis(…, -yaw) 约定一致（多个角度）', () => {
    const a = anchorOf('roof', [0.7, -0.25, 1.3]);
    for (const yaw of [0, 30, 90, -45, 180]) {
      closeVec(anchorWorldPosition(a, defaultVehicle, pose(yaw)), rotateAroundAxis(a.localPosition, vec(0, 1, 0), -yaw));
    }
  });

  it('yaw 与平移复合：部件原点同受旋转', () => {
    const a = anchorOf('windshield', [0.55, 0.88, 0.18]);
    const body = vec(0.75, 1.48, 0.18); // 部件原点 (0.2,0.6,0) + localPosition
    const expected = add(vec(10, 0, -2), rotateAroundAxis(body, vec(0, 1, 0), -90));
    closeVec(anchorWorldPosition(a, vehicleWithParts, { position: vec(10, 0, -2), yaw: 90 }), expected);
    // 交叉校验：R_y(-90) 把 (0.75,1.48,0.18) 映到 (-0.18,1.48,0.75)
    closeVec(anchorWorldPosition(a, vehicleWithParts, { position: vec(10, 0, -2), yaw: 90 }), vec(9.82, 1.48, -1.25));
  });
});

describe('projectAnchorToGround', () => {
  const eye = vec(0, 1.2, 0);
  /** 眼点 → 世界锚点的射线在平面 y = 0 上的解析交点。 */
  const analyticGround = (world: Vec3, from: Vec3): Vec3 => {
    const dir = sub(world, from);
    const t = -from.y / dir.y;
    return vec(from.x + dir.x * t, 0, from.z + dir.z * t);
  };

  it('锚点位于眼点前方且地面在下方时 hit = true，落点与解析交线一致', () => {
    const a = anchorOf('roof', [2, 0.5, 0]); // 世界坐标即 (2,0.5,0)，低于眼点 1.2 ⇒ 射线朝下
    const pose = ORIGIN_POSE;
    const g = projectAnchorToGround(a, defaultVehicle, pose, eye, []);
    expect(g.hit).toBe(true);
    closeVec(g.groundPoint, analyticGround(anchorWorldPosition(a, defaultVehicle, pose), eye), 1e-9);
    expect(g.distance).toBeGreaterThan(0);
    expect(Number.isFinite(g.distance)).toBe(true);
  });

  it('投影使用世界坐标而非 localPosition：车辆平移后落点随之改变', () => {
    const a = anchorOf('roof', [2, 0.5, 0]);
    const gOrigin = projectAnchorToGround(a, defaultVehicle, ORIGIN_POSE, eye, []);
    const movedPose: VehiclePose = { position: vec(10, 0, 0), yaw: 0 };
    const gMoved = projectAnchorToGround(a, defaultVehicle, movedPose, eye, []);
    expect(gOrigin.hit).toBe(true);
    expect(gMoved.hit).toBe(true);
    closeVec(gMoved.groundPoint, analyticGround(anchorWorldPosition(a, defaultVehicle, movedPose), eye), 1e-9);
    expect(Math.abs(gMoved.groundPoint.x - gOrigin.groundPoint.x)).toBeGreaterThan(1);
  });

  it('车辆旋转后投影随之改变，且仍与解析交线一致', () => {
    const a = anchorOf('roof', [2, 0.5, 0.6]);
    const turned: VehiclePose = { position: vec(0, 0, 0), yaw: 90 };
    const g = projectAnchorToGround(a, defaultVehicle, turned, eye, []);
    expect(g.hit).toBe(true);
    closeVec(g.groundPoint, analyticGround(anchorWorldPosition(a, defaultVehicle, turned), eye), 1e-9);
    // 世界坐标 R_y(-90)·(2,0.5,0.6) = (-0.6,0.5,2)，与 yaw = 0 时的落点 (3.4286,0,1.0286) 明显不同
    closeVec(anchorWorldPosition(a, defaultVehicle, turned), vec(-0.6, 0.5, 2));
    const straight = projectAnchorToGround(a, defaultVehicle, ORIGIN_POSE, eye, []);
    expect(Math.abs(g.groundPoint.x - straight.groundPoint.x)).toBeGreaterThan(1);
    expect(Math.abs(g.groundPoint.z - straight.groundPoint.z)).toBeGreaterThan(1);
  });

  it('返回结构保持 {hit, groundPoint, distance}', () => {
    const g = projectAnchorToGround(anchorOf('roof', [2, 0.5, 0]), defaultVehicle, ORIGIN_POSE, eye, []);
    expect(Object.keys(g).sort()).toEqual(['distance', 'groundPoint', 'hit']);
  });
});

describe('anchorVisibleInMirror', () => {
  const mirror = defaultVehicle.mirrorMounts.inner;
  const eye = vec(0, 1.2, 0);

  it('使用世界坐标（等价于 isTargetVisible(世界坐标, mirror, eye)）', () => {
    const poses: VehiclePose[] = [
      { position: vec(0, 0, 0), yaw: 0 },
      { position: vec(0, 0, 0), yaw: 90 },
      { position: vec(3, 0, -1), yaw: -30 },
    ];
    for (const anchor of defaultVehicle.anchors) {
      for (const pose of poses) {
        const v = anchorVisibleInMirror(anchor, defaultVehicle, pose, mirror, eye);
        const ref = isTargetVisible(anchorWorldPosition(anchor, defaultVehicle, pose), mirror, eye);
        expect(v.visible).toBe(ref.visible);
        expect(v.mirrorUV).toEqual(ref.mirrorUV);
      }
    }
  });

  it('返回结构保持 {visible, mirrorUV}', () => {
    const v = anchorVisibleInMirror(anchorOf('windshield', [0.55, 0.88, 0.18]), defaultVehicle, ORIGIN_POSE, mirror, eye);
    expect(Object.keys(v).sort()).toEqual(['mirrorUV', 'visible']);
  });
});

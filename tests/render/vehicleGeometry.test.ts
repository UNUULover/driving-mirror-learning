/**
 * 车体几何必须由 VehicleSpec 现算，并且把已声明的尺寸与已声明点位同时落到实处。
 * 这里的断言就是「参数化车体没有跑偏」的看门狗：一旦有人改了 spec 或布局常数，先在这里炸。
 */
import { describe, expect, it } from 'vitest';
import { DRIVER_GAZE_PITCH_DEG, DRIVER_VIEW_FOV, driverViewDirection, vehicleLayout } from '../../src/render/vehicleGeometry';
import { defaultVehicle } from '../../src/core/vehicle';
import { anthropometry, resolveEyePoint } from '../../src/core/eye';
import { defaultSeatAdjust } from '../../src/state/config';

const L = vehicleLayout(defaultVehicle);

describe('车体布局与 VehicleSpec 一致', () => {
  it('总长、总宽、总高严格取自 spec', () => {
    expect(L.front - L.rear).toBeCloseTo(defaultVehicle.overallLength, 10);
    expect(L.halfWidth * 2).toBeCloseTo(defaultVehicle.overallWidth, 10);
    expect(L.roofY).toBeCloseTo(defaultVehicle.overallHeight, 10);
  });

  it('轴距严格取自 spec', () => {
    expect(L.frontAxle - L.rearAxle).toBeCloseTo(defaultVehicle.wheelbase, 10);
  });

  it('发动机盖前缘高度 = hoodFrontEdgeHeight（腰线由它加 10 cm 得到）', () => {
    expect(L.beltline - 0.10).toBeCloseTo(defaultVehicle.hoodFrontEdgeHeight, 10);
  });

  it('风挡倾角就是 pillarAAngleDeg（相对竖直方向）', () => {
    const rake = Math.atan2(L.cowlX - L.roofFrontX, L.roofY - L.beltline) * 180 / Math.PI;
    expect(rake).toBeCloseTo(defaultVehicle.pillarAAngleDeg, 8);
  });

  it('前悬后悬都是正的，车轮不落在车身之外', () => {
    expect(L.front - L.frontAxle).toBeGreaterThan(0.5);
    expect(L.rearAxle - L.rear).toBeGreaterThan(0.5);
    expect(L.frontAxle).toBeLessThan(L.front);
    expect(L.rearAxle).toBeGreaterThan(L.rear);
  });
});

describe('已声明的点位确实落在车体上', () => {
  const eye = resolveEyePoint(defaultVehicle, defaultSeatAdjust, 50, { pitch: 0, yaw: 0, roll: 0 }, 'center');

  it('眼点在座舱内：前风挡之后、车顶之下、车身宽度之内', () => {
    expect(eye.x).toBeLessThan(L.cowlX);
    expect(eye.x).toBeGreaterThan(L.rearGlassX);
    expect(eye.y).toBeLessThan(L.roofY);
    expect(eye.y).toBeGreaterThan(L.beltline - 0.2);
    expect(Math.abs(eye.z)).toBeLessThan(L.halfWidth);
  });

  it('眼点到车头的距离在真实轿车区间内（1.6~2.4 m）', () => {
    const distance = L.front - eye.x;
    expect(distance).toBeGreaterThan(1.6);
    expect(distance).toBeLessThan(2.4);
  });

  it('眼点大致落在轴距中点（轴距的 40%~60% 处）', () => {
    const fraction = (L.frontAxle - eye.x) / defaultVehicle.wheelbase;
    expect(fraction).toBeGreaterThan(0.4);
    expect(fraction).toBeLessThan(0.6);
  });

  it('三面镜都在车身长度范围内，且都位于前轴之后（后视镜不可能跑到前轴之前）', () => {
    for (const mirror of Object.values(defaultVehicle.mirrorMounts)) {
      expect(mirror.mountPoint.x).toBeGreaterThan(L.rear);
      expect(mirror.mountPoint.x).toBeLessThan(L.front);
      expect(mirror.mountPoint.x).toBeLessThan(L.frontAxle);
    }
  });

  it('两个参照物锚点都落在发动机盖区域内，不再悬在车头之外', () => {
    for (const anchor of defaultVehicle.anchors) {
      expect(anchor.localPosition.x).toBeLessThan(L.front);
      expect(anchor.localPosition.x).toBeGreaterThan(L.cowlX - 0.4);
    }
  });

  it('身高百分位 5~95 的眼点始终在座舱内（不穿出车顶或风挡）', () => {
    for (const percentile of [5, 50, 95]) {
      for (const foreAft of [-0.15, 0.25]) {
        const p = resolveEyePoint(defaultVehicle, { foreAft, height: 0, backrestAngle: 0 }, percentile, { pitch: 0, yaw: 0, roll: 0 }, 'center');
        expect(p.y).toBeLessThan(L.roofY);
        expect(p.y).toBeGreaterThan(0.6);
        expect(p.x).toBeLessThan(L.cowlX);
        expect(Math.abs(p.z)).toBeLessThan(L.halfWidth);
      }
    }
    // 最高的驾驶员仍需留出头顶余量：眼点加头高不能顶到车顶
    const tallestEye = anthropometry(95, 'center').y + defaultVehicle.sgRPBase.y;
    expect(tallestEye).toBeLessThan(L.roofY - 0.15);
  });
});

/**
 * 「用户看到的是主驾驶位的景象」这条要求必须可测：相机在眼点、朝车头看，
 * 内后视镜和左后视镜都得落在画面内，否则学员看不到镜中的像，教学闭环就断了。
 */
describe('主驾驶位取景', () => {
  const eye = resolveEyePoint(defaultVehicle, defaultSeatAdjust, 50, { pitch: 0, yaw: 0, roll: 0 }, 'center');
  const gaze = driverViewDirection();
  const aspect = 16 / 9;
  const toCamera = (p: { x: number; y: number; z: number }) => {
    const forward = { x: gaze.x, y: gaze.y, z: gaze.z };
    // 相机基：前方 = gaze，右方 = forward × up_world，上方 = right × forward
    const up = { x: 0, y: 1, z: 0 };
    const right = { x: forward.y * up.z - forward.z * up.y, y: forward.z * up.x - forward.x * up.z, z: forward.x * up.y - forward.y * up.x };
    const rl = Math.hypot(right.x, right.y, right.z);
    const r = { x: right.x / rl, y: right.y / rl, z: right.z / rl };
    const u = { x: r.y * forward.z - r.z * forward.y, y: r.z * forward.x - r.x * forward.z, z: r.x * forward.y - r.y * forward.x };
    const d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z };
    const z = d.x * forward.x + d.y * forward.y + d.z * forward.z;
    return { z, x: d.x * r.x + d.y * r.y + d.z * r.z, y: d.x * u.x + d.y * u.y + d.z * u.z };
  };
  const inFrame = (p: { x: number; y: number; z: number }): boolean => {
    const c = toCamera(p);
    if (c.z <= 0) return false;
    const halfV = Math.tan(DRIVER_VIEW_FOV * Math.PI / 360);
    return Math.abs(c.y) <= c.z * halfV && Math.abs(c.x) <= c.z * halfV * aspect;
  };

  it('视线朝车头前方，且带一个向下的俯角', () => {
    expect(gaze.x).toBeGreaterThan(0.98);
    expect(gaze.z).toBe(0);
    expect(DRIVER_GAZE_PITCH_DEG).toBeGreaterThan(0);
    expect(DRIVER_GAZE_PITCH_DEG).toBeLessThan(12);
  });

  /**
   * 真实驾驶位的人机关系：眼点在 z = +0.38（左舵），内后视镜与左后视镜偏轴约 19° / 28°，
   * 正视前方就在视野里；右后视镜偏轴约 52°，必须转头才看得见 —— 这是真实情况，
   * 不是取景没取全。三面镜的完整画面由下方三张 inset 卡片负责，学员不会漏看。
   */
  it('内后视镜与左后视镜落在正视前方的视野内', () => {
    expect(inFrame(defaultVehicle.mirrorMounts.inner.mountPoint)).toBe(true);
    expect(inFrame(defaultVehicle.mirrorMounts.left.mountPoint)).toBe(true);
  });

  it('右后视镜偏轴超过 45°，正视前方看不到它（需要转头，符合真实驾驶位）', () => {
    const offAxis = Math.atan2(defaultVehicle.mirrorMounts.right.mountPoint.z - eye.z, defaultVehicle.mirrorMounts.right.mountPoint.x - eye.x) * 180 / Math.PI;
    expect(Math.abs(offAxis)).toBeGreaterThan(45);
    expect(inFrame(defaultVehicle.mirrorMounts.right.mountPoint)).toBe(false);
  });

  it('水平视野约 79°，既装得下左后方，又没有广角鱼眼失真', () => {
    const horizontal = 2 * Math.atan(Math.tan(DRIVER_VIEW_FOV * Math.PI / 360) * aspect) * 180 / Math.PI;
    expect(horizontal).toBeGreaterThan(70);
    expect(horizontal).toBeLessThan(90);
  });

  /**
   * 「驾驶位在左侧、要左舵车」这条要求必须落在屏幕坐标里验，不能靠看。
   *
   * three.js 相机的屏幕右向是 X_cam = cross(up, Z_cam)，Z_cam = −视线方向。朝车头看时
   * 视线 = +x，于是 X_cam = cross((0,1,0), (−1,0,0)) = (0,0,1) = +z：**+z 落在画面右侧**。
   * 所以：驾驶员和左后视镜必须落在画面的左半边（屏幕 x < 0），副驾与右后视镜落在右半边。
   */
  it('朝前看时，驾驶员与左后视镜在画面左侧、副驾与右后视镜在右侧（左舵车）', () => {
    const screenX = (p: { x: number; y: number; z: number }): number => p.z - eye.z;   // 视线沿 +x 时的屏幕右向分量
    const driver = { x: defaultVehicle.sgRPBase.x, y: defaultVehicle.sgRPBase.y, z: defaultVehicle.sgRPBase.z };
    const passenger = { x: driver.x, y: driver.y, z: -driver.z };
    expect(screenX(driver)).toBe(0);                                   // 自己的位置在画面正中
    expect(screenX(passenger)).toBeGreaterThan(0.5);                   // 副驾在右边
    expect(screenX(defaultVehicle.mirrorMounts.left.mountPoint)).toBeLessThan(-0.3);
    expect(screenX(defaultVehicle.mirrorMounts.right.mountPoint)).toBeGreaterThan(0.3);
  });

  it('左后视镜与驾驶员在车身同一侧（左舵车的判据）', () => {
    const left = defaultVehicle.mirrorMounts.left.mountPoint.z;
    const right = defaultVehicle.mirrorMounts.right.mountPoint.z;
    expect(Math.sign(left)).toBe(Math.sign(defaultVehicle.sgRPBase.z));
    expect(Math.sign(right)).toBe(-Math.sign(defaultVehicle.sgRPBase.z));
    expect(left).toBeLessThan(right);
  });

  it('发动机盖前缘在画面里（俯视可见车头，这是「看点位」的前提）', () => {
    expect(inFrame({ x: L.front, y: defaultVehicle.hoodFrontEdgeHeight, z: 0 })).toBe(true);
  });

  it('前方的仪表台与风挡也在画面内，而它们都低于/高于眼点、不遮挡地平线', () => {
    expect(inFrame({ x: L.cowlX, y: L.beltline, z: 0 })).toBe(true);
    expect(L.beltline).toBeLessThan(eye.y);
  });
});

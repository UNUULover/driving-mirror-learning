import { describe, expect, it } from 'vitest';
import { faceOffsetConfidence, mapFacePose, normalizedFaceOffsetToVehicle } from '../../src/cv/poseMapper';
describe('pose mapping',()=>it('maps image signs to vehicle convention',()=>expect(mapFacePose({yawDeg:10,pitchDeg:-5,rollDeg:2})).toEqual({yawDeg:-10,pitchDeg:5,rollDeg:2})));

/**
 * ⚠ 未核实的前提 —— 六向方向断言的全部有效性都压在这张表上，请优先核实这一处。
 *
 * 要断言「被摄者抬头 ⇒ 输出 pitchDeg > 0」，必须先知道 MediaPipe 在抬头时给出的是什么符号。
 * 工程内没有任何依据：faceLandmarker.ts 把 pose 写死为 {pitch:0,yaw:0,roll:0}（真实调用链根本不产生姿态角），
 * EyeCalibrationPanel 从不读 pose，docs/ 也不提。下面这张表是按「MediaPipe 抬头给负 pitch、左转给负 yaw、
 * 右倾给正 roll」**假定**的，不是查证结果。
 *
 * 因为 mapFacePose 本质只是一次取反，按假定构造输入必然得到期望输出 —— 也就是说，
 * 这几条断言目前只能防回归（防止有人改动取反方向），**不能证明符号约定本身正确**。
 * 若核实后发现 MediaPipe 的实际符号与此表相反，那么需要同时翻转两处：这张表，以及
 * mapFacePose 里对应的取反方向；只翻一处会让断言与实现一起错到底。
 *
 * 另有独立推导与之冲突，记录在此备查：把 MediaPipe 的角度当作绕相机各轴的右手旋转
 * （pitch 绕 x、yaw 绕 y、roll 绕 z），相机正对驾驶员时可推出车体系基变换
 * (x_v, y_v, z_v) = (z_cam, −y_cam, x_cam)，再代入 §0 的「抬头为正 / 左转为正 / 右倾为正」，
 * 得到的是 yaw = +yaw_mp、pitch = +pitch_mp、roll = −roll_mp —— 与当前实现的三个取反方向正好互补。
 * 两者必有一错，且无法在工程内判定。
 */
const MEDIAPIPE_INPUT_SIGNS = {
  lookUp: { pitchDeg: -8, yawDeg: 0, rollDeg: 0 },
  lookDown: { pitchDeg: 8, yawDeg: 0, rollDeg: 0 },
  turnLeft: { pitchDeg: 0, yawDeg: -12, rollDeg: 0 },
  turnRight: { pitchDeg: 0, yawDeg: 12, rollDeg: 0 },
  tiltRight: { pitchDeg: 0, yawDeg: 0, rollDeg: 7 },
  tiltLeft: { pitchDeg: 0, yawDeg: 0, rollDeg: -7 },
} as const;

describe('mapFacePose 六个方向（输入侧符号按上表假定，尚未核实）', () => {
  it('被摄者抬头 → 输出 pitchDeg > 0', () => {
    expect(mapFacePose(MEDIAPIPE_INPUT_SIGNS.lookUp).pitchDeg).toBeGreaterThan(0);
  });

  it('被摄者低头 → 输出 pitchDeg < 0', () => {
    expect(mapFacePose(MEDIAPIPE_INPUT_SIGNS.lookDown).pitchDeg).toBeLessThan(0);
  });

  it('被摄者向左转头（其自身视角）→ 输出 yawDeg > 0', () => {
    expect(mapFacePose(MEDIAPIPE_INPUT_SIGNS.turnLeft).yawDeg).toBeGreaterThan(0);
  });

  it('被摄者向右转头 → 输出 yawDeg < 0', () => {
    expect(mapFacePose(MEDIAPIPE_INPUT_SIGNS.turnRight).yawDeg).toBeLessThan(0);
  });

  it('被摄者右倾头 → 输出 rollDeg > 0', () => {
    expect(mapFacePose(MEDIAPIPE_INPUT_SIGNS.tiltRight).rollDeg).toBeGreaterThan(0);
  });

  it('被摄者左倾头 → 输出 rollDeg < 0', () => {
    expect(mapFacePose(MEDIAPIPE_INPUT_SIGNS.tiltLeft).rollDeg).toBeLessThan(0);
  });

  it('六个方向的输出量级与输入一致，未被放大或缩小', () => {
    for (const input of Object.values(MEDIAPIPE_INPUT_SIGNS)) {
      const out = mapFacePose(input);
      expect(Math.abs(out.pitchDeg)).toBe(Math.abs(input.pitchDeg));
      expect(Math.abs(out.yawDeg)).toBe(Math.abs(input.yawDeg));
      expect(Math.abs(out.rollDeg)).toBe(Math.abs(input.rollDeg));
    }
  });
});

/**
 * 前置摄像头镜像。以下断言只比较 mirrored 两种取值的相互关系，因此不依赖 MediaPipe 的角度符号约定。
 */
describe('mapFacePose 前置摄像头镜像', () => {
  const inputs = [
    { yawDeg: 12, pitchDeg: 8, rollDeg: 0 },
    { yawDeg: -12, pitchDeg: -8, rollDeg: 0 },
    { yawDeg: 25, pitchDeg: 0, rollDeg: 7 },
  ];

  it('mirrored: true 与 false 的 yaw 符号相反', () => {
    for (const input of inputs) {
      expect(mapFacePose(input, true).yawDeg).toBe(-mapFacePose(input, false).yawDeg);
    }
  });

  it('mirrored: true 与 false 的 pitch 符号相同（水平镜像不影响俯仰）', () => {
    for (const input of inputs) {
      expect(mapFacePose(input, true).pitchDeg).toBe(mapFacePose(input, false).pitchDeg);
    }
  });

  it('mirrored: true 与 false 的 roll 符号相反', () => {
    for (const input of inputs) {
      expect(mapFacePose(input, true).rollDeg).toBe(-mapFacePose(input, false).rollDeg);
    }
  });

  it('mirrored 缺省等价于 false', () => {
    const input = { yawDeg: 12, pitchDeg: 8, rollDeg: 7 };
    expect(mapFacePose(input)).toEqual(mapFacePose(input, false));
  });

  it('镜像不改变角度大小，只改符号', () => {
    const input = { yawDeg: 12, pitchDeg: -8, rollDeg: 7 };
    const plain = mapFacePose(input, false);
    const mirrored = mapFacePose(input, true);
    expect(Math.abs(mirrored.yawDeg)).toBe(Math.abs(plain.yawDeg));
    expect(Math.abs(mirrored.rollDeg)).toBe(Math.abs(plain.rollDeg));
  });
});

describe('normalizedFaceOffsetToVehicle 深度分量', () => {
  it('传入 z 深度分量时 x 不再为 0', () => {
    const v = normalizedFaceOffsetToVehicle({ x: 0.1, y: 0.1, z: -0.4 }, 0.12);
    expect(v.x).not.toBe(0);
    expect(v.x).toBeCloseTo(-0.048, 12);
    expect(v.y).toBeCloseTo(-0.012, 12);
    expect(v.z).toBeCloseTo(-0.012, 12);
  });

  it('未传 z 时 x 保持 0，y/z 不受影响', () => {
    const v = normalizedFaceOffsetToVehicle({ x: 0.1, y: 0.1 }, 0.12);
    expect(v.x).toBe(0);
    expect(v.y).toBeCloseTo(-0.012, 12);
    expect(v.z).toBeCloseTo(-0.012, 12);
  });

  it('z 非有限时按缺失处理，x 为 0', () => {
    expect(normalizedFaceOffsetToVehicle({ x: 0.1, y: 0.1, z: NaN }, 0.12).x).toBe(0);
    expect(normalizedFaceOffsetToVehicle({ x: 0.1, y: 0.1, z: Infinity }, 0.12).x).toBe(0);
  });

  it('z = 0 是有效深度：x 为 0 但该轴已解', () => {
    expect(normalizedFaceOffsetToVehicle({ x: 0.1, y: 0.1, z: 0 }, 0.12).x).toBe(0);
    expect(faceOffsetConfidence({ x: 0.1, y: 0.1, z: 0 }).x).toBe(1);
  });
});

describe('faceOffsetConfidence', () => {
  it('提供有限深度时 x 轴为已解', () => {
    expect(faceOffsetConfidence({ x: 0.1, y: 0.1, z: 0.3 })).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('缺失或非有限深度时 x 轴为未解', () => {
    expect(faceOffsetConfidence({ x: 0.1, y: 0.1 })).toEqual({ x: 0, y: 1, z: 1 });
    expect(faceOffsetConfidence({ x: 0.1, y: 0.1, z: NaN }).x).toBe(0);
    expect(faceOffsetConfidence({ x: 0.1, y: 0.1, z: -Infinity }).x).toBe(0);
  });

  it('非有限深度与缺失深度给出相同的 x 轴结论', () => {
    expect(faceOffsetConfidence({ x: 0.2, y: 0.1, z: NaN })).toEqual(faceOffsetConfidence({ x: 0.2, y: 0.1 }));
  });
});

/**
 * 曝光两档：手动直接用预设值；自适应按时间常数模拟人眼明暗适应（约 2~5 秒）。
 * 自适应是时间相关的，而本环境的浏览器 rAF 被压到约 1.5 帧/秒，无法在页面上稳定观测适应曲线，
 * 因此这里用确定性步进把时间常数本身测掉。
 */
import { describe, expect, it } from 'vitest';
import { adaptiveTargetExposure, sceneLuminance, stepExposure } from '../../src/render/postfx';
import { weatherPresets } from '../../src/state/config';
import type { WeatherState } from '../../src/core/types';

const DT = 1 / 60;
const run = (weather: WeatherState, seconds: number): number => {
  let value = stepExposure(weather, 'manual', 0);
  for (let t = 0; t < seconds; t += DT) value = stepExposure(weather, 'adaptive', DT);
  return value;
};

describe('曝光：手动档', () => {
  it('原样透传预设曝光值，且不随时间变化', () => {
    for (const preset of ['noon', 'dusk_backlight', 'night_highbeam', 'rain', 'fog', 'tunnel'] as const) {
      const weather = weatherPresets[preset];
      const first = stepExposure(weather, 'manual', DT);
      const later = stepExposure(weather, 'manual', DT);
      expect(first).toBe(weather.exposure);
      expect(later).toBe(weather.exposure);
    }
  });
});

describe('曝光：自适应档', () => {
  it('暗场景的目标曝光高于亮场景（眼睛会开大）', () => {
    const bright = adaptiveTargetExposure(weatherPresets.noon);
    const dark = adaptiveTargetExposure(weatherPresets.tunnel);
    expect(dark).toBeGreaterThan(bright);
    expect(sceneLuminance(weatherPresets.noon)).toBeGreaterThan(sceneLuminance(weatherPresets.tunnel));
  });

  it('时间常数约 3 秒：3 秒走到约 63%，9 秒到约 95%', () => {
    const weather = weatherPresets.tunnel;
    const start = stepExposure(weather, 'manual', 0);
    const target = adaptiveTargetExposure(weather);
    const gap = target - start;
    expect(Math.abs(gap)).toBeGreaterThan(1);

    let value = start;
    for (let t = 0; t < 3; t += DT) value = stepExposure(weather, 'adaptive', DT);
    expect((value - start) / gap).toBeGreaterThan(0.6);
    expect((value - start) / gap).toBeLessThan(0.67);

    for (let t = 0; t < 6; t += DT) value = stepExposure(weather, 'adaptive', DT);
    expect((value - start) / gap).toBeGreaterThan(0.93);
    expect((value - start) / gap).toBeLessThan(0.96);
  });

  it('单调逼近目标且不过冲', () => {
    const weather = weatherPresets.tunnel;
    stepExposure(weather, 'manual', 0);
    const target = adaptiveTargetExposure(weather);
    const start = stepExposure(weather, 'manual', 0);
    const gap = Math.abs(target - start);
    let previous = start;
    for (let i = 0; i < 600; i++) {
      const value = stepExposure(weather, 'adaptive', DT);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(target + 1e-9);
      previous = value;
    }
    // 10 秒 ≈ 3.3 个时间常数 ⇒ 只剩约 4% 未走完
    expect(target - previous).toBeLessThan(0.05 * gap);
    expect(target - previous).toBeGreaterThan(0);
  });

  it('切换预设后不是瞬间跳到目标，而是从当前状态开始适应', () => {
    stepExposure(weatherPresets.noon, 'manual', 0);
    const firstFrame = stepExposure(weatherPresets.tunnel, 'adaptive', 0);
    expect(firstFrame).toBe(weatherPresets.noon.exposure);
    expect(Math.abs(firstFrame - adaptiveTargetExposure(weatherPresets.tunnel))).toBeGreaterThan(1);

    const afterOneSecond = (() => { let v = firstFrame; for (let t = 0; t < 1; t += DT) v = stepExposure(weatherPresets.tunnel, 'adaptive', DT); return v; })();
    expect(afterOneSecond).toBeGreaterThan(firstFrame);
    expect(afterOneSecond).toBeLessThan(adaptiveTargetExposure(weatherPresets.tunnel));
  });

  it('六个预设的自适应目标都落在着色器可用的 ±3 EV 夹取区间内', () => {
    for (const preset of ['noon', 'dusk_backlight', 'night_highbeam', 'rain', 'fog', 'tunnel'] as const) {
      const target = adaptiveTargetExposure(weatherPresets[preset]);
      expect(Number.isFinite(target)).toBe(true);
      expect(Math.abs(target)).toBeLessThanOrEqual(3);
    }
  });
});

import * as THREE from 'three';
import type { WeatherState } from '../core/types';

export type ExposureMode = 'manual' | 'adaptive';
/** Human light/dark adaptation settles over a few seconds; the tunnel preset exists to show exactly that delay. */
const ADAPT_TAU_SEC = 3;

/**
 * ACES Filmic is mandatory here. The teaching value of this project is reproducing "I can't see":
 * Reinhard / Linear / LDR output clips the highlights flat and the learner can no longer tell
 * backlight from glare. Everything upstream stays linear; tone mapping and gamma happen only in
 * this one place, once.
 */
export const applySafePostFX = (renderer: THREE.WebGLRenderer, exposure: number): void => { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Math.pow(2, Math.max(-3, Math.min(3, exposure))); };

/** Relative scene luminance reaching the driver: sky light, direct sun (zero below the horizon) and glare. */
export const sceneLuminance = (weather: WeatherState): number => {
  const above = Math.max(0, Math.sin(weather.sunElevationDeg * Math.PI / 180));
  const glare = weather.glareSources.reduce((sum, g) => sum + g.intensity, 0);
  return 0.02 + weather.sunIntensity * (0.25 + 2.5 * above) + glare * 0.35;
};
/** Exposure that maps a clear noon sky to mid-grey; darker scenes land higher, i.e. the eye opens up. */
export const adaptiveTargetExposure = (weather: WeatherState): number => -Math.log2(sceneLuminance(weather) / 2.2);

let autoExposure = 0;
/**
 * Advances adaptation by dtSec and returns the exposure to render with. Manual mode just passes the
 * preset's value through, which also seeds the ramp when the user switches to adaptive.
 */
export const stepExposure = (weather: WeatherState, mode: ExposureMode, dtSec: number): number => {
  if (mode === 'manual') { autoExposure = weather.exposure; return autoExposure; }
  /* dt is 0 on the first frame after any remount; easing with dt 0 leaves the exposure at the eye's
     current state instead of snapping to the target, which is what makes the adaptation visible. */
  const target = adaptiveTargetExposure(weather);
  autoExposure = dtSec > 0 ? autoExposure + (target - autoExposure) * (1 - Math.exp(-dtSec / ADAPT_TAU_SEC)) : autoExposure;
  return autoExposure;
};
/** The value the last stepExposure settled on, so the mirror insets can share one adapted exposure. */
export const currentExposure = (): number => autoExposure;

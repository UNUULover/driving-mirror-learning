import type { SeatAdjust, ViewpointState, WeatherState } from '../core/types';
import { defaultVehicle } from '../core/vehicle';
import { isPersistedConfig, type PersistedConfig } from './schema';
export const defaultSeatAdjust:SeatAdjust={foreAft:0,height:0,backrestAngle:0};
export const defaultViewpoint:ViewpointState={source:'standard',eyePosition:{x:0,y:0,z:0},headPose:{pitch:0,yaw:0,roll:0},confidence:{position:1,pose:1},baseline:{percentile:50,seatAdjust:defaultSeatAdjust},delta:{fromPhoto:{x:0,y:0,z:0},fromManual:{x:0,y:0,z:0}}};
export const defaultWeather:WeatherState={preset:'noon',sunElevationDeg:55,sunAzimuthDeg:0,sunIntensity:1,skyIbl:null,rainIntensity:0,fogDensity:0,roadWetness:0,exposure:0,glareSources:[]};
export const weatherPresets: Record<WeatherState['preset'], WeatherState> = {
  noon: defaultWeather,
  dusk_backlight: { ...defaultWeather, preset:'dusk_backlight', sunElevationDeg:8, sunAzimuthDeg:180, sunIntensity:.55, exposure:-.4 },
  /* 远光光源在车后（x<0）：只有后方眩光才会照进后视镜并触发防眩目，放车头方向物理上触发不了。 */
  night_highbeam: { ...defaultWeather, preset:'night_highbeam', sunElevationDeg:-20, sunIntensity:.12, exposure:-1.4, glareSources:[{position:{x:-7,y:1,z:.5},intensity:2,color:[1,.95,.8]}] },
  rain: { ...defaultWeather, preset:'rain', sunElevationDeg:35, sunIntensity:.45, rainIntensity:.7, roadWetness:.85, exposure:-.3 },
  fog: { ...defaultWeather, preset:'fog', sunElevationDeg:25, sunIntensity:.55, fogDensity:.55, exposure:-.5 },
  /* 隧道靠钠灯照明：光源放在身前（x>0），既照亮场景也不会误触发后车眩光的防眩目。 */
  tunnel: { ...defaultWeather, preset:'tunnel', sunElevationDeg:-30, sunIntensity:.08, exposure:-1.2, glareSources:[{position:{x:6,y:4.6,z:.4},intensity:1.1,color:[1,.72,.32]},{position:{x:14,y:4.6,z:.4},intensity:.9,color:[1,.72,.32]}] },
};
export { defaultVehicle };
const storageKey='driving-mirror-learning:v2';
export const loadPersistedConfig=():PersistedConfig|null=>{try{const raw=localStorage.getItem(storageKey);if(!raw)return null;const value:unknown=JSON.parse(raw,(_key,v:unknown)=>v==='__Infinity__'?Infinity:v);return isPersistedConfig(value)?value:null;}catch{return null;}};
export const savePersistedConfig=(value:PersistedConfig):void=>{try{localStorage.setItem(storageKey,JSON.stringify(value,(_key,v:unknown)=>v===Infinity?'__Infinity__':v));}catch{/* private-mode storage is optional */}};

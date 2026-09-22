import { create } from 'zustand';
import type { MirrorState, SeatAdjust, ViewpointState, WeatherState } from '../core/types';
import { eyePointFromStandard } from '../core/eye';
import { defaultSeatAdjust, defaultVehicle, defaultViewpoint, defaultWeather, loadPersistedConfig, savePersistedConfig, weatherPresets } from './config';
import type { ExposureMode } from '../render/postfx';
type AppState={seat:SeatAdjust;percentile:number;viewpoint:ViewpointState;mirrors:Record<MirrorState['id'],MirrorState>;weather:WeatherState;exposureMode:ExposureMode;blindSpot:boolean;targetPosition:{x:number;z:number};setSeat:(v:Partial<SeatAdjust>)=>void;setPercentile:(v:number)=>void;setMirrorTilt:(id:MirrorState['id'],v:Partial<MirrorState['tilt']>)=>void;setMirrorRadius:(id:MirrorState['id'],radiusOfCurvature:number)=>void;setMirrorDimming:(id:MirrorState['id'],dimmingEnabled:boolean)=>void;setWeather:(preset:WeatherState['preset'])=>void;setWeatherPatch:(v:Partial<WeatherState>)=>void;setExposureMode:(v:ExposureMode)=>void;setTargetPosition:(v:Partial<{x:number;z:number}>)=>void;setBlindSpot:(v:boolean)=>void};
const resolve=(seat:SeatAdjust,p:number):ViewpointState=>({...defaultViewpoint,eyePosition:eyePointFromStandard(defaultVehicle,seat,p,{pitch:0,yaw:0,roll:0}).center,baseline:{percentile:p,seatAdjust:seat}});
export const useAppStore = create<AppState>((set) => ({
  seat: defaultSeatAdjust, percentile: 50, viewpoint: resolve(defaultSeatAdjust, 50),
  mirrors: defaultVehicle.mirrorMounts, weather: defaultWeather, exposureMode: 'manual', blindSpot: false, targetPosition:{x:-5,z:-4.4},
  setSeat: (v) => set((s) => { const seat = { ...s.seat, ...v }; return { seat, viewpoint: resolve(seat, s.percentile) }; }),
  setPercentile: (percentile) => set((s) => ({ percentile, viewpoint: resolve(s.seat, percentile) })),
  setMirrorTilt: (id, v) => set((s) => ({ mirrors: { ...s.mirrors, [id]: { ...s.mirrors[id], tilt: { ...s.mirrors[id].tilt, ...v } } } })),
  setMirrorRadius: (id, radiusOfCurvature) => set((s) => ({ mirrors: { ...s.mirrors, [id]: { ...s.mirrors[id], radiusOfCurvature } } })),
  setMirrorDimming: (id, dimmingEnabled) => set((s) => ({ mirrors: { ...s.mirrors, [id]: { ...s.mirrors[id], dimmingEnabled } } })),
  setWeather: (preset) => set({ weather: weatherPresets[preset] }),
  setWeatherPatch: (v) => set((s) => ({ weather: { ...s.weather, ...v } })),
  setExposureMode: (exposureMode) => set({ exposureMode }),
  setTargetPosition: (v) => set((s)=>({targetPosition:{...s.targetPosition,...v}})),
  setBlindSpot: (blindSpot) => set({ blindSpot }),
}));
const restored=typeof window==='undefined'?null:loadPersistedConfig();
if(restored)useAppStore.setState({seat:restored.seat,percentile:restored.percentile,mirrors:restored.mirrors,weather:restored.weather,viewpoint:resolve(restored.seat,restored.percentile)});
useAppStore.subscribe((state)=>savePersistedConfig({version:2,seat:state.seat,percentile:state.percentile,mirrors:state.mirrors,weather:state.weather}));

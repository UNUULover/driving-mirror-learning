import { useAppStore } from '../state/store';
import { horizontalFOV, verticalFOV } from '../core/fov';
import { BlindSpotPanel } from './panels/BlindSpotPanel';
import { EyeCalibrationPanel } from './panels/EyeCalibrationPanel';
import { MirrorPanel } from './panels/MirrorPanel';
import { VehiclePanel } from './panels/VehiclePanel';
import { WeatherPanel } from './panels/WeatherPanel';
import { HeadMarkerOverlay } from './viewport/HeadMarkerOverlay';
import { MainViewport } from './viewport/MainViewport';
import { MirrorInset } from './viewport/MirrorInset';
import './app.css';
export function App(){const state=useAppStore();return <main><header><h1>驾校后视镜学习器</h1><span>安全性能档：45 FPS · 像素比 1 · 自动暂停</span></header><section className="grid"><aside><VehiclePanel/><MirrorPanel id="inner"/><MirrorPanel id="left"/><MirrorPanel id="right"/><WeatherPanel/><BlindSpotPanel/><EyeCalibrationPanel/></aside><article><h2>三维车体系预览</h2><MainViewport/><div className="eye"><HeadMarkerOverlay eye={state.viewpoint.eyePosition}/></div><div className="mirrors">{(['inner','left','right'] as const).map(id=>{const m=state.mirrors[id];return <div key={id}><MirrorInset id={id} mirrors={state.mirrors} eye={state.viewpoint.eyePosition} weather={state.weather} target={state.targetPosition} exposureMode={state.exposureMode}/><small>水平 {horizontalFOV(m,state.viewpoint.eyePosition).toFixed(1)}° / 垂直 {verticalFOV(m,state.viewpoint.eyePosition).toFixed(1)}°</small></div>})}</div><p>{state.blindSpot?'解析盲区采样已开启。':'盲区采样关闭；三维视口仍处于低负载模式。'}</p></article></section></main>}

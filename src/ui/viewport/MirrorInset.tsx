import { useEffect, useRef, useState } from 'react';
import type { MirrorState, Vec3, WeatherState } from '../../core/types';
import type { ExposureMode } from '../../render/postfx';
import { INSET_HEIGHT, INSET_WIDTH, createMirrorInsetViewport } from '../../render/viewport';

export function MirrorInset({id,mirrors,eye,weather,target,exposureMode}:{id:MirrorState['id'];mirrors:Record<MirrorState['id'],MirrorState>;eye:Vec3;weather:WeatherState;target:{x:number;z:number};exposureMode:ExposureMode}){
  const mirror=mirrors[id];
  const canvas=useRef<HTMLCanvasElement>(null);
  const view=useRef<ReturnType<typeof createMirrorInsetViewport>|null>(null);
  const [zoomed,setZoomed]=useState(false);
  useEffect(()=>{
    if(!canvas.current)return;
    view.current=createMirrorInsetViewport(canvas.current,mirrors,id,eye,weather,target,exposureMode);
    return()=>view.current?.dispose();
  },[mirrors,id,weather,target,exposureMode]);
  useEffect(()=>view.current?.update(eye),[eye]);
  return <figure className={zoomed?'mirror zoomed':'mirror'}>
    <figcaption><b>{id}</b><small>{Number.isFinite(mirror.radiusOfCurvature)?`${mirror.radiusOfCurvature} mm 凸面`:'平面镜'}</small></figcaption>
    <canvas ref={canvas} width={INSET_WIDTH} height={INSET_HEIGHT} aria-label={`${id} 镜面实时画面`}/>
    <button type="button" onClick={()=>setZoomed(z=>!z)} aria-expanded={zoomed}>{zoomed?'收起':'放大'}</button>
  </figure>;
}

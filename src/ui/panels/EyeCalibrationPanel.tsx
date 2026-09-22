import { useState } from 'react';
import { analyseFaceImage } from '../../cv/faceLandmarker';
export function EyeCalibrationPanel(){const [status,setStatus]=useState('照片只在本机处理');const upload=(file:File|undefined)=>{if(!file)return;const image=new Image();image.onload=()=>{void analyseFaceImage(image).then(r=>setStatus(`${r.reason}（置信度 ${Math.round(r.confidence*100)}%）`))};image.src=URL.createObjectURL(file)};return <fieldset><legend>眼位校准</legend><input type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0])}/><small>{status}</small></fieldset>}

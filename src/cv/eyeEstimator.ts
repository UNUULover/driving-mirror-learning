import type { Vec3 } from '../core/types';
import { normalizedFaceOffsetToVehicle } from './poseMapper';
export interface EyeEstimate { delta:{fromPhoto:Vec3}; confidence:number; reason:string; }
/** A single photo only produces a bounded adjustment, never an asserted absolute metric eye point. */
export const estimateEyeDelta=(faceCenter:{x:number;y:number}|null,faceSize:number|null):EyeEstimate=>{if(!faceCenter||!faceSize||!Number.isFinite(faceSize)||faceSize<=0)return{delta:{fromPhoto:{x:0,y:0,z:0}},confidence:0,reason:'未检测到稳定人脸'};const confidence=Math.max(0,Math.min(1,faceSize/.28));return{delta:{fromPhoto:normalizedFaceOffsetToVehicle({x:faceCenter.x-.5,y:faceCenter.y-.5},.12)},confidence,reason:'仅用于相对微调，单张照片不解算绝对米制眼位'}};

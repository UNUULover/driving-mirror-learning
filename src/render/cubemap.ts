import * as THREE from 'three';
import type { Vec3 } from '../core/types';
export const cubeCacheKey=(eye:Vec3,pose:{pitch:number;yaw:number;roll:number}):string=>`${Math.round(eye.x*100)},${Math.round(eye.y*100)},${Math.round(eye.z*100)}:${Math.round(pose.pitch*2)},${Math.round(pose.yaw*2)},${Math.round(pose.roll*2)}`;
export const createCubeTarget=(size:256|512|1024=256):THREE.WebGLCubeRenderTarget=>new THREE.WebGLCubeRenderTarget(size,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});

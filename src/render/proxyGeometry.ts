import type { ProxyPrimitive } from '../core/types';
export const MAX_PLANES = 8;
export const MAX_BOXES = 16;
export interface ProxyUniforms { planeCount:number; planes:Float32Array; planeColors:Float32Array; boxCount:number; boxes:Float32Array; boxColors:Float32Array; }
const color=(v:ProxyPrimitive):[number,number,number]=>v.color??[.5,.5,.5];
/** Packs CPU proxy primitives for the mirror shader; excess primitives are intentionally omitted. */
export const packProxyUniforms=(primitives:ProxyPrimitive[]):ProxyUniforms=>{const planes=new Float32Array(MAX_PLANES*4),planeColors=new Float32Array(MAX_PLANES*3),boxes=new Float32Array(MAX_BOXES*8),boxColors=new Float32Array(MAX_BOXES*3);let pi=0,bi=0;for(const primitive of primitives){if(primitive.kind==='plane'&&pi<MAX_PLANES){const n=primitive.normal,l=Math.hypot(n.x,n.y,n.z)||1,o=pi*4,c=pi*3;planes.set([n.x/l,n.y/l,n.z/l,-(primitive.point.x*n.x+primitive.point.y*n.y+primitive.point.z*n.z)/l],o);planeColors.set(color(primitive),c);pi++;}if(primitive.kind==='aabb'&&bi<MAX_BOXES){const o=bi*8,c=bi*3;boxes.set([primitive.min.x,primitive.min.y,primitive.min.z,0,primitive.max.x,primitive.max.y,primitive.max.z,0],o);boxColors.set(color(primitive),c);bi++;}}return{planeCount:pi,planes,planeColors,boxCount:bi,boxes,boxColors};};

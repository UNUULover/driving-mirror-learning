import type { MirrorState, Vec3 } from './types';
import { add, cross, dot, length, normalize, rotateAroundAxis, scale, sub, vec } from './vec';

const radiusM = (mm: number): number => Number.isFinite(mm) && mm > 0 ? mm / 1000 : 0;
export const mirrorFrame = (mirror: MirrorState): { origin: Vec3; axisU: Vec3; axisV: Vec3; normal: Vec3 } => {
  // At zero tilt the normal faces the driver (-x); width is vehicle z and height is y.
  const yawed = rotateAroundAxis(vec(-1, 0, 0), vec(0, 1, 0), mirror.tilt.yaw);
  const u = normalize(rotateAroundAxis(vec(0, 0, 1), vec(0, 1, 0), mirror.tilt.yaw));
  const n = normalize(rotateAroundAxis(yawed, u, mirror.tilt.pitch));
  return { origin: mirror.mountPoint, axisU: u, axisV: normalize(cross(n, u)), normal: n };
};
export const sphereCenterFromMirror = (mirror: MirrorState): Vec3 | null => { const r=radiusM(mirror.radiusOfCurvature); return r ? sub(mirrorFrame(mirror).origin, scale(mirrorFrame(mirror).normal, r)) : null; };
export const asphericRadiusAt = (mirror: MirrorState, u: number): number => mirror.asphericZone !== null && Math.abs(u) >= mirror.asphericZone.startU ? mirror.asphericZone.radiusMm : mirror.radiusOfCurvature;
/** `tangent` is the point's distance from the mirror's axis, so the offset is applied as a chord: the rim of a mirror declared halfWidth w really is w from the axis, not w measured along the tangent plane. */
const onSphere = (center: Vec3, radius: number, radial: Vec3, tangent: Vec3): Vec3 => { const axis=normalize(radial), t=Math.min(length(tangent),radius), axial=Math.sqrt(Math.max(0,radius*radius-t*t)); return add(center,add(scale(axis,axial),t>0?scale(tangent,t/length(tangent)):vec())); };
export const sampleMirrorSurface = (mirror: MirrorState, u: number, v: number): Vec3 => {
  const f=mirrorFrame(mirror), uu=Math.max(-1,Math.min(1,Number.isFinite(u)?u:0)), vv=Math.max(-1,Math.min(1,Number.isFinite(v)?v:0));
  if (!Number.isFinite(mirror.radiusOfCurvature)) return add(f.origin, add(scale(f.axisU, uu*mirror.halfWidth), scale(f.axisV, vv*mirror.halfHeight)));
  const mainR=radiusM(mirror.radiusOfCurvature); if (!mainR) return f.origin;
  const mainC=sub(f.origin,scale(f.normal,mainR)); const tangent=add(scale(f.axisU,uu*mirror.halfWidth),scale(f.axisV,vv*mirror.halfHeight));
  if (!mirror.asphericZone || Math.abs(uu) < mirror.asphericZone.startU) return onSphere(mainC,mainR,scale(f.normal,mainR),tangent);
  const edge=Math.sign(uu || 1)*Math.max(0,Math.min(1,mirror.asphericZone.startU));
  const edgePoint=onSphere(mainC,mainR,scale(f.normal,mainR),scale(f.axisU,edge*mirror.halfWidth));
  const edgeNormal=normalize(sub(edgePoint,mainC)); const aspR=radiusM(mirror.asphericZone.radiusMm);
  if (!aspR) return edgePoint;
  const aspC=sub(edgePoint,scale(edgeNormal,aspR));
  return onSphere(aspC,aspR,scale(edgeNormal,aspR),add(scale(f.axisU,(uu-edge)*mirror.halfWidth),scale(f.axisV,vv*mirror.halfHeight)));
};
export const mirrorNormalAt = (mirror: MirrorState, p: Vec3): Vec3 => { const c=sphereCenterFromMirror(mirror); return c ? normalize(sub(p,c)) : mirrorFrame(mirror).normal; };
export const reflectDirection = (eye: Vec3, point: Vec3, normal: Vec3): Vec3 => { const i=normalize(sub(point,eye)); return sub(i,scale(normalize(normal),2*dot(i,normalize(normal)))); };

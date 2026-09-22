import type { MirrorState, ProxyPrimitive, ReferenceAnchor, VehiclePose, VehicleSpec, Vec3 } from './types';
import { add, normalize, rotateAroundAxis, sub, vec } from './vec';
import { groundIntersection } from './raycast';
import { isTargetVisible } from './fov';
/** Body frame (+x forward, +y up; +z = cross(x,y) is the driver's RIGHT, so −z is their left) → world: part origin, then rotate around +y by -yaw (§0 keeps yaw left-positive, so a left turn is a negative rotation about +y), then translate. */
export const anchorWorldPosition=(anchor:ReferenceAnchor,vehicle:VehicleSpec,pose:VehiclePose):Vec3=>add(pose.position,rotateAroundAxis(add(vehicle.partOrigins?.[anchor.part]??vec(),anchor.localPosition),vec(0,1,0),-pose.yaw));
export const projectAnchorToGround=(anchor:ReferenceAnchor,vehicle:VehicleSpec,pose:VehiclePose,eye:Vec3,_prims:ProxyPrimitive[])=>{const h=groundIntersection(eye,normalize(sub(anchorWorldPosition(anchor,vehicle,pose),eye)));return{hit:h.hit,groundPoint:h.point,distance:h.distanceAlongGround};};
export const anchorVisibleInMirror=(anchor:ReferenceAnchor,vehicle:VehicleSpec,pose:VehiclePose,mirror:MirrorState,eye:Vec3)=>{const r=isTargetVisible(anchorWorldPosition(anchor,vehicle,pose),mirror,eye);return{visible:r.visible,mirrorUV:r.mirrorUV};};

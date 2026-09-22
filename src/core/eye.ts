import type { SeatAdjust, Vec3, VehicleSpec, ViewpointState } from './types';
import { add, rotateAroundAxis, transformMat3, vec } from './vec';

type Pose = ViewpointState['headPose'];
const interpolation = (p: number, a: number, b: number, c: number): number => { const q = Math.max(5, Math.min(95, p)); return q <= 50 ? a + (b - a) * (q - 5) / 45 : b + (c - b) * (q - 50) / 45; };
export const anthropometry = (percentile: number, side: 'left' | 'right' | 'center'): Vec3 => vec(interpolation(percentile, .30, .26, .21), interpolation(percentile, .58, .65, .72), side === 'left' ? .032 : side === 'right' ? -.032 : 0);
const multiply = (a: readonly number[], b: readonly number[]): number[] => [0,1,2].flatMap(r => [0,1,2].map(c => (a[r*3] ?? 0)*(b[c] ?? 0) + (a[r*3+1] ?? 0)*(b[c+3] ?? 0) + (a[r*3+2] ?? 0)*(b[c+6] ?? 0)));
const rotation = (axis: 'x'|'y'|'z', deg: number): number[] => { const c=Math.cos(deg*Math.PI/180), s=Math.sin(deg*Math.PI/180); return axis==='x'?[1,0,0,0,c,-s,0,s,c]:axis==='y'?[c,0,s,0,1,0,-s,0,c]:[c,-s,0,s,c,0,0,0,1]; };
/** Row-major R = Rroll(x'') · Rpitch(z') · Ryaw(y). */
export const headPoseToRotationMatrix = (p: Pose): number[] => multiply(rotation('x', p.roll), multiply(rotation('z', p.pitch), rotation('y', p.yaw)));
export const resolveEyePoint = (spec: VehicleSpec, seat: SeatAdjust, percentile: number, pose: Pose, side: 'left'|'right'|'center'): Vec3 => { const h=add(spec.sgRPBase, vec(-seat.foreAft, seat.height, 0)); const back=rotateAroundAxis(anthropometry(percentile, side), vec(0,0,1), seat.backrestAngle); return add(h, transformMat3(headPoseToRotationMatrix(pose), back)); };
export const eyePointFromStandard = (s: VehicleSpec, a: SeatAdjust, p: number, h: Pose) => ({ center: resolveEyePoint(s,a,p,h,'center'), left: resolveEyePoint(s,a,p,h,'left'), right: resolveEyePoint(s,a,p,h,'right') });
export const applyDelta = (base: ViewpointState, dPhoto: Vec3, dManual: Vec3): ViewpointState => ({ ...base, eyePosition: add(add(base.eyePosition,dPhoto),dManual), delta: { fromPhoto:dPhoto, fromManual:dManual } });

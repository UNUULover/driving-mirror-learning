import type { Vec3 } from '../core/types';
export interface FacePoseInput { yawDeg:number; pitchDeg:number; rollDeg:number; }
/** Landmark offsets in MediaPipe image units. `z` is the MediaPipe depth channel; a single 2D photo has none. */
export interface FaceOffset { x:number; y:number; z?:number; }
/** Per-axis 1 = the axis is solved from the photo, 0 = the axis is missing and must not be trusted. */
export interface FaceOffsetConfidence { x:number; y:number; z:number; }
/**
 * Face-pose sign mapping between the MediaPipe image frame and the vehicle body frame.
 *
 * MediaPipe image frame: +x right, +y down, +z out of the screen toward the camera.
 * Vehicle body frame (§0): +x forward, +y up, +z to the driver's left (right-handed).
 *
 * The vertical axis is inverted (+y down vs +y up), so the vertical tilt is negated below to keep
 * the vehicle sense of "looking up is positive".
 *
 * FRONT CAMERA: a front-facing camera delivers a horizontally mirrored image, so a subject turning
 * to their own left looks like a turn to their right. The mirror has to be undone BEFORE the yaw
 * sign is mapped — pass `mirrored: true`. Mirroring flips yaw and roll; pitch is unaffected,
 * because a horizontal flip leaves the vertical axis alone.
 */
export const mapFacePose=(input:FacePoseInput,mirrored=false):FacePoseInput=>({yawDeg:(mirrored?1:-1)*input.yawDeg,pitchDeg:-input.pitchDeg,rollDeg:(mirrored?-1:1)*input.rollDeg});
/** Vehicle-frame offset. The fore/aft axis (x) is only solvable when the MediaPipe depth channel is present. */
export const normalizedFaceOffsetToVehicle=(offset:FaceOffset,scaleM:number):Vec3=>{const depth=offset.z;const x=typeof depth==='number'&&Number.isFinite(depth)?depth*scaleM:0;return{x,y:-offset.y*scaleM,z:-offset.x*scaleM};};
/** Companion to normalizedFaceOffsetToVehicle: reports which axes that call could actually solve. */
export const faceOffsetConfidence=(offset:FaceOffset):FaceOffsetConfidence=>({x:typeof offset.z==='number'&&Number.isFinite(offset.z)?1:0,y:1,z:1});

import { describe, expect, it } from 'vitest';
import { anthropometry, eyePointFromStandard, resolveEyePoint } from '../../src/core/eye';
import { defaultSeatAdjust, defaultVehicle } from '../../src/state/config';
describe('eye solver',()=>{it('interpolates and clamps anthropometry',()=>{expect(anthropometry(50,'left')).toEqual({x:.26,y:.65,z:.032});expect(anthropometry(0,'center').y).toBe(.58);expect(anthropometry(100,'center').y).toBe(.72)});it('moves seat backward along -x',()=>{const a=resolveEyePoint(defaultVehicle,defaultSeatAdjust,50,{pitch:0,yaw:0,roll:0},'center');const b=resolveEyePoint(defaultVehicle,{...defaultSeatAdjust,foreAft:.1},50,{pitch:0,yaw:0,roll:0},'center');expect(b.x-a.x).toBeCloseTo(-.1)})});

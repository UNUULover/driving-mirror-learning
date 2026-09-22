import { describe, expect, it } from 'vitest';
import { rayAABB, rayPlane } from '../../src/core/raycast';
describe('raycast',()=>{it('rejects parallel plane rays',()=>expect(rayPlane({x:0,y:1,z:0},{x:1,y:0,z:0},{kind:'plane',point:{x:0,y:0,z:0},normal:{x:0,y:1,z:0},label:'g'}).hit).toBe(false));it('returns t zero inside a box',()=>expect(rayAABB({x:0,y:0,z:0},{x:1,y:0,z:0},{kind:'aabb',min:{x:-1,y:-1,z:-1},max:{x:1,y:1,z:1},label:'box'}).t).toBe(0))});

import { describe, expect, it } from 'vitest';
import { packProxyUniforms } from '../../src/render/proxyGeometry';
describe('GPU proxy packing',()=>it('packs planes and boxes in independent slots',()=>{const p=packProxyUniforms([{kind:'plane',point:{x:0,y:0,z:0},normal:{x:0,y:1,z:0},label:'ground'},{kind:'aabb',min:{x:1,y:2,z:3},max:{x:4,y:5,z:6},label:'car'}]);expect(p.planeCount).toBe(1);expect(p.boxCount).toBe(1);expect([...p.boxes.slice(0,3)]).toEqual([1,2,3])}));

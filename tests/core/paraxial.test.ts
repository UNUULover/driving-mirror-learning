import { describe, expect, it } from 'vitest';
import { paraxialConvex } from '../../src/core/paraxial';
describe('paraxial baseline',()=>{it('returns a virtual image and a positive magnification for a convex mirror',()=>{const r=paraxialConvex(10,1.2,1.5,.6);expect(r.imageDistance).toBeLessThan(0);expect(r.magnification).toBeGreaterThan(0);expect(r.angularSizeRad).toBeGreaterThan(0)})});

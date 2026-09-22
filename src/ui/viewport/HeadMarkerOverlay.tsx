import type { Vec3 } from '../../core/types';
export function HeadMarkerOverlay({eye}:{eye:Vec3}){return <output aria-label="当前眼点">E ({eye.x.toFixed(2)}, {eye.y.toFixed(2)}, {eye.z.toFixed(2)})</output>}

import type { Vec3 } from './types';

const finite = (value: number): number => Number.isFinite(value) ? value : 0;
export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x: finite(x), y: finite(y), z: finite(z) });
export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, k: number): Vec3 => vec(a.x * finite(k), a.y * finite(k), a.z * finite(k));
export const dot = (a: Vec3, b: Vec3): number => finite(a.x * b.x + a.y * b.y + a.z * b.z);
export const cross = (a: Vec3, b: Vec3): Vec3 => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.sqrt(Math.max(0, dot(a, a)));
export const normalize = (a: Vec3): Vec3 => { const l = length(a); return l > 1e-12 ? scale(a, 1 / l) : vec(); };
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), Math.min(1, Math.max(0, finite(t)))));
export const rotateAroundAxis = (v: Vec3, axis: Vec3, degrees: number): Vec3 => { const n = normalize(axis); const angle = finite(degrees) * Math.PI / 180; const c = Math.cos(angle); const s = Math.sin(angle); return add(add(scale(v, c), scale(cross(n, v), s)), scale(n, dot(n, v) * (1 - c))); };
export const transformMat3 = (m: readonly number[], v: Vec3): Vec3 => vec((m[0] ?? 0)*v.x + (m[1] ?? 0)*v.y + (m[2] ?? 0)*v.z, (m[3] ?? 0)*v.x + (m[4] ?? 0)*v.y + (m[5] ?? 0)*v.z, (m[6] ?? 0)*v.x + (m[7] ?? 0)*v.y + (m[8] ?? 0)*v.z);

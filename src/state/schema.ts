import type { MirrorState, SeatAdjust, WeatherState } from '../core/types';

/* version 2：车体系 z 轴符号已修正（驾驶员回到物理左侧）。v1 存的镜面安装点是镜像的，必须丢弃，不能迁移。 */
export interface PersistedConfig { version: 2; seat: SeatAdjust; percentile: number; mirrors: Record<MirrorState['id'], MirrorState>; weather: WeatherState; }
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const finiteOrInfinity = (v: unknown): v is number => typeof v === 'number' && (Number.isFinite(v) || v === Infinity);
const vec3 = (v: unknown): v is { x: number; y: number; z: number } => typeof v === 'object' && v !== null && number((v as Record<string,unknown>).x) && number((v as Record<string,unknown>).y) && number((v as Record<string,unknown>).z);
const mirror = (v: unknown): v is MirrorState => { if(typeof v!=='object'||v===null)return false;const r=v as Record<string,unknown>;return (r.id==='inner'||r.id==='left'||r.id==='right')&&finiteOrInfinity(r.radiusOfCurvature)&&typeof r.halfWidth==='number'&&typeof r.halfHeight==='number'&&vec3(r.mountPoint); };
export const isPersistedConfig = (v: unknown): v is PersistedConfig => { if(typeof v!=='object'||v===null)return false;const r=v as Record<string,unknown>,s=r.seat,m=r.mirrors;return r.version===2&&number(r.percentile)&&typeof s==='object'&&s!==null&&number((s as Record<string,unknown>).foreAft)&&number((s as Record<string,unknown>).height)&&number((s as Record<string,unknown>).backrestAngle)&&typeof m==='object'&&m!==null&&mirror((m as Record<string,unknown>).inner)&&mirror((m as Record<string,unknown>).left)&&mirror((m as Record<string,unknown>).right); };

import * as THREE from 'three';
import type { ProxyPrimitive, Vec3, VehicleSpec } from '../core/types';

/**
 * 教练车车体，全部由 VehicleSpec 的数字现算，不引入任何外部模型资源。
 *
 * 坐标约定（车体系）：+x 车头、+y 向上。取 +x 与 +y 后，右手系第三轴 +z = cross(x,y) 指向
 * **驾驶员右侧**（面朝东、头顶向上时 cross(东,上)=南，南在右手边）。所以 −z 才是驾驶员左侧，
 * 驾驶员在 z = −0.38、左后视镜在 z = −0.93。§0 与 ARCHITECTURE.md 里「+z 驾驶员左侧」的说法是反的。
 *
 * ⚠ 原点不是 ARCHITECTURE.md 里写的「前轴中心地面投影」，那条与实际数据冲突：
 *   - 内后视镜在 x = +0.45、左右镜在 x = +0.65。若原点在前轴，后视镜就跑到前轴之前（保险杠上方），不可能。
 *   - hood-left 锚点在 x = 1.6，而 overallLength 4.5 + wheelbase 2.6 只会给出约 0.9 m 的前悬，
 *     保险杠在 x ≈ +0.9，这个锚点会悬在车头之外。
 * 下面这组布置同时满足全部已声明尺寸与已声明点位（眼点、三面镜、两个锚点），因此以它为准：
 *   前保险杠 +1.80、后保险杠 −2.70（长 4.50）、前轴 +0.91、后轴 −1.69（轴距 2.60），
 *   即原点大约在车身中部、车头略偏前的一处。眼点 x = −0.39 落在前轴后 1.30 m（轴距的 50%），
 *   风挡下沿 x = 0.70、上沿按 pillarAAngleDeg 后倾，hood-left 锚点落在发动机盖前缘附近。
 */
export interface VehicleLayout { front: number; rear: number; frontAxle: number; rearAxle: number; halfWidth: number; roofY: number; beltline: number; cowlX: number; roofFrontX: number; roofRearX: number; rearGlassX: number; }

export const vehicleLayout = (spec: VehicleSpec): VehicleLayout => {
  const front = 1.8, rear = front - spec.overallLength;                    // 4.50 m ⇒ −2.70
  const frontAxle = 0.91, rearAxle = frontAxle - spec.wheelbase;           // 轴距 2.60 ⇒ −1.69
  const beltline = spec.hoodFrontEdgeHeight + 0.10;                        // 发动机盖前缘 0.85 ⇒ 腰线 0.95
  const cowlX = 0.70, roofY = spec.overallHeight;                          // 车顶 = 全高 1.48
  const roofFrontX = cowlX - (roofY - beltline) * Math.tan(spec.pillarAAngleDeg * Math.PI / 180);
  return { front, rear, frontAxle, rearAxle, halfWidth: spec.overallWidth / 2, roofY, beltline, cowlX, roofFrontX, roofRearX: -1.45, rearGlassX: -2.15 };
};

const panel = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z], 3));
  geometry.computeVertexNormals();
  return geometry;
};
const box = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d);

/**
 * 沿 x 轴把一串矩形截面连成车身：每段一个 4 面棱柱（左/右/底，**不封顶**）。
 * 顶面故意不在这里生成——座舱段一旦封顶，就会在腰线高度拉出一整片横贯全车的白板，
 * 从驾驶位看正好是一条横在眼前、遮住下半视野的水平面。发动机盖与后备箱盖改为单独的面。
 */
const loft = (sections: Array<{ x: number; hw: number; top: number; bottom: number }>): THREE.BufferGeometry => {
  const positions: number[] = [];
  const quad = (p: number[], q: number[], r: number[], s: number[]): void => { positions.push(...p, ...q, ...r, ...p, ...r, ...s); };
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i], b = sections[i + 1];
    if (!a || !b) continue;
    const aTopL = [a.x, a.top, a.hw], aTopR = [a.x, a.top, -a.hw], aBotL = [a.x, a.bottom, a.hw], aBotR = [a.x, a.bottom, -a.hw];
    const bTopL = [b.x, b.top, b.hw], bTopR = [b.x, b.top, -b.hw], bBotL = [b.x, b.bottom, b.hw], bBotR = [b.x, b.bottom, -b.hw];
    quad(aBotR, aBotL, bBotL, bBotR);       // 底面
    quad(aTopL, bTopL, bBotL, aBotL);       // 左侧
    quad(aTopR, aBotR, bBotR, bTopR);       // 右侧
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

export const buildVehicleBody = (spec: VehicleSpec): THREE.Group => {
  const L = vehicleLayout(spec);
  const group = new THREE.Group();
  group.name = 'ego-vehicle';
  const paint = new THREE.MeshStandardMaterial({ color: 0xf5f6f5, roughness: .38, metalness: .18 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2b3a44, roughness: .12, metalness: .1, transparent: true, opacity: .42, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: 0x22282c, roughness: .7 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: .92 });

  const add = (geometry: THREE.BufferGeometry, material: THREE.Material): void => { group.add(new THREE.Mesh(geometry, material)); };

  add(loft([
    { x: L.front, hw: L.halfWidth * .72, top: L.beltline - .16, bottom: .30 },
    { x: L.front - .10, hw: L.halfWidth, top: spec.hoodFrontEdgeHeight, bottom: .26 },
    { x: L.front - .60, hw: L.halfWidth, top: L.beltline - .04, bottom: .24 },
    { x: L.cowlX, hw: L.halfWidth, top: L.beltline, bottom: .24 },
    { x: L.rearGlassX, hw: L.halfWidth, top: L.beltline + .03, bottom: .24 },
    { x: L.rear + .55, hw: L.halfWidth, top: L.beltline + .02, bottom: .26 },
    { x: L.rear, hw: L.halfWidth * .86, top: L.beltline - .10, bottom: .32 },
  ]), paint);

  add(panel({ x: L.front, y: spec.hoodFrontEdgeHeight, z: L.halfWidth }, { x: L.front, y: spec.hoodFrontEdgeHeight, z: -L.halfWidth }, { x: L.cowlX, y: L.beltline, z: -L.halfWidth }, { x: L.cowlX, y: L.beltline, z: L.halfWidth }), paint);                                                          // 发动机盖
  add(panel({ x: L.rearGlassX, y: L.beltline + .03, z: L.halfWidth * .80 }, { x: L.rearGlassX, y: L.beltline + .03, z: -L.halfWidth * .80 }, { x: L.rear, y: L.beltline - .10, z: -L.halfWidth * .86 }, { x: L.rear, y: L.beltline - .10, z: L.halfWidth * .86 }), paint);              // 后备箱盖

  const wTopHalf = L.halfWidth * .82, rTopHalf = L.halfWidth * .80;
  add(panel({ x: L.cowlX, y: L.beltline, z: wTopHalf }, { x: L.cowlX, y: L.beltline, z: -wTopHalf }, { x: L.roofFrontX, y: L.roofY, z: -rTopHalf }, { x: L.roofFrontX, y: L.roofY, z: rTopHalf }), glass);   // 前风挡
  add(panel({ x: L.roofFrontX, y: L.roofY, z: rTopHalf }, { x: L.roofFrontX, y: L.roofY, z: -rTopHalf }, { x: L.roofRearX, y: L.roofY - .02, z: -rTopHalf }, { x: L.roofRearX, y: L.roofY - .02, z: rTopHalf }), paint);  // 车顶
  add(panel({ x: L.roofRearX, y: L.roofY - .02, z: rTopHalf }, { x: L.roofRearX, y: L.roofY - .02, z: -rTopHalf }, { x: L.rearGlassX, y: L.beltline + .03, z: -wTopHalf }, { x: L.rearGlassX, y: L.beltline + .03, z: wTopHalf }), glass); // 后风挡

  for (const side of [1, -1]) {
    const z = side * L.halfWidth;
    add(panel({ x: L.cowlX, y: L.beltline, z }, { x: L.roofFrontX, y: L.roofY, z: side * rTopHalf }, { x: L.roofRearX, y: L.roofY - .02, z: side * rTopHalf }, { x: L.rearGlassX, y: L.beltline + .03, z }), glass);   // 侧窗
    const pillar = (topX: number, botX: number, topY: number): void => { const w = .07, centre = { x: (topX + botX) / 2, y: (topY + L.beltline) / 2 }; const height = Math.hypot(topX - botX, topY - L.beltline); const mesh = new THREE.Mesh(box(w, height, L.halfWidth * .08), trim); mesh.position.set(centre.x, centre.y, side * L.halfWidth * .95); mesh.rotation.z = Math.atan2(botX - topX, topY - L.beltline); group.add(mesh); };
    pillar(L.roofFrontX, L.cowlX, L.roofY);            // A 柱（倾角即 pillarAAngleDeg）
    pillar(L.roofRearX, L.rearGlassX, L.roofY - .02);   // C 柱
    const b = new THREE.Mesh(box(.06, L.roofY - L.beltline, L.halfWidth * .08), trim); b.position.set(-0.30, (L.roofY + L.beltline) / 2, side * L.halfWidth * .95); group.add(b);   // B 柱
    for (const axle of [L.frontAxle, L.rearAxle]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, .22, 20), tyre);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(axle, .33, side * (L.halfWidth - .12));
      group.add(wheel);
    }
    const head = new THREE.Mesh(box(.06, .13, .30), new THREE.MeshBasicMaterial({ color: 0xfff4d6 })); head.position.set(L.front - .02, L.beltline - .22, side * L.halfWidth * .62); group.add(head);
    const tail = new THREE.Mesh(box(.06, .14, .34), new THREE.MeshBasicMaterial({ color: 0x8c1f16 })); tail.position.set(L.rear + .02, L.beltline - .12, side * L.halfWidth * .62); group.add(tail);
  }
  return group;
};

/**
 * 自家车体的解析代理：镜中的本车车身必须走解析求交，不能靠 cubemap。
 * cubemap 是在**眼点**采的，而镜面点在 0.5~1 m 外——远处目标无所谓，近处的自家车身恰恰是
 * 视差最大的那类目标。每个 AABB 都刻意做薄并避开眼点：把整台车包成一个大盒子会让眼点落在盒内，
 * rayAABB 会算成 t=0 的命中，镜面就整片糊成一个颜色。
 */
export const vehicleProxies = (spec: VehicleSpec): ProxyPrimitive[] => {
  const L = vehicleLayout(spec), w = L.halfWidth, mid = (L.front + L.rear) / 2, len = L.front - L.rear;
  const boxes: Array<[number, number, number, number, number, number, string]> = [
    [L.cowlX, L.front, .30, L.beltline, w - .06, w, 'ego-hood-left'],
    [L.cowlX, L.front, .30, L.beltline, -w, -(w - .06), 'ego-hood-right'],
    [L.rear + .10, L.rearGlassX, .30, L.beltline, w - .06, w, 'ego-rear-left'],
    [L.rear + .10, L.rearGlassX, .30, L.beltline, -w, -(w - .06), 'ego-rear-right'],
    [L.cowlX, L.rearGlassX, .30, L.beltline, w - .05, w, 'ego-flank-left'],
    [L.cowlX, L.rearGlassX, .30, L.beltline, -w, -(w - .05), 'ego-flank-right'],
    [L.roofFrontX, L.roofRearX, L.roofY - .04, L.roofY, -w * .82, w * .82, 'ego-roof'],
    [mid - .4, mid + .4, .22, .34, -w, w, 'ego-underbody'],
  ];
  return boxes.map(([x0, x1, y0, y1, z0, z1, label]) => ({ kind: 'aabb', min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, label, color: [.62, .64, .66] }));
};

/** 主驾驶位视角：水平朝车头（+x），下俯 5°。竖直 FOV 50°（16:9 下水平约 79°），接近人眼驾驶时的取景。 */
export const DRIVER_VIEW_FOV = 50, DRIVER_GAZE_PITCH_DEG = 5;
export const driverViewDirection = (): Vec3 => ({ x: Math.cos(DRIVER_GAZE_PITCH_DEG * Math.PI / 180), y: -Math.sin(DRIVER_GAZE_PITCH_DEG * Math.PI / 180), z: 0 });

/**
 * 座舱内饰，让主视口呈现真实的「主驾驶位景象」：仪表台、方向盘、仪表罩、前后座椅、中控台、
 * 门内饰板、顶棚内衬、遮阳板、后视镜支架。全部按真实比例建模（H 点 0.32 m、眼高 0.97 m、
 * 仪表台上沿 0.88 m 低于眼点、方向盘直径 0.36 m、坐垫厚约 0.12 m）。
 *
 * 内饰板是必需的、不只是装饰：车身蒙皮是单面朝外的，从车内看会被背面剔除，没有内饰板就会
 * 直接从车门/顶棚「看穿」到车外。
 */
export const buildCockpit = (spec: VehicleSpec): THREE.Group => {
  const L = vehicleLayout(spec);
  const group = new THREE.Group();
  group.name = 'ego-cockpit';
  const soft = new THREE.MeshStandardMaterial({ color: 0x24292e, roughness: .92 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: .78 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0x2f353b, roughness: .95 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x0d1013, roughness: .55 });
  const put = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rotation?: [number, number, number]): THREE.Mesh => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]); group.add(mesh); return mesh; };

  /* 座椅与中控的高度全部相对身高基准点（sgRPBase.y）取，基准点上调时内饰自动跟着走，不会脱节。 */
  const h = spec.sgRPBase.y;
  const seatZ: [number, number] = [spec.sgRPBase.z, -spec.sgRPBase.z];   // 左舵：驾驶员在 −z 侧
  put(box(3.30, .04, 1.72), shell, -0.95, .34, 0);                        // 地板
  put(box(.42, .46, 1.72), shell, .52, .65, 0);                           // 仪表台本体（前隔板）
  put(box(.50, .07, 1.74), rim, .42, .88, 0);                             // 仪表台上沿（低于眼点 0.09）
  put(box(.34, .16, .08), shell, -0.10, .84, spec.sgRPBase.z);            // 仪表罩
  const wheelMount = new THREE.Group(); wheelMount.position.set(-0.02, .84, spec.sgRPBase.z); wheelMount.rotation.z = 0.44; group.add(wheelMount);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(.18, .021, 8, 26), rim); wheel.rotation.y = Math.PI / 2; wheelMount.add(wheel);
  put(box(.05, .34, 1.70), shell, .10, .58, 0);                           // 转向柱护板
  put(box(.90, .38, .42), shell, -1.00, h + .24, 0);                      // 中控台
  for (const z of seatZ) {
    put(box(.52, .12, .48), fabric, -0.62, h - .02, z);                   // 坐垫（上表面即身高基准点）
    put(box(.14, .64, .46), fabric, -0.92, h + .30, z, [0, 0, -0.18]);    // 靠背
    put(box(.12, .20, .26), fabric, -1.00, h + .71, z);                   // 头枕
  }
  put(box(.52, .12, 1.40), fabric, -2.02, h - .01, 0);                    // 后排坐垫
  put(box(.14, .58, 1.40), fabric, -2.26, h + .27, 0, [0, 0, -0.14]);     // 后排靠背
  for (const side of [1, -1]) {
    put(box(2.80, .50, .06), soft, -0.95, .62, side * (L.halfWidth - .04));   // 门内饰板（挡住单面蒙皮）
    put(box(.30, .16, .04), shell, -0.42, .78, side * (L.halfWidth - .09));   // 内门把手区
  }
  put(box(2.70, .05, 1.60), soft, -0.95, L.roofY - .05, 0);               // 顶棚内衬
  put(box(.30, .04, .40), soft, 0.30, L.roofY - .09, spec.sgRPBase.z);    // 驾驶员遮阳板
  put(box(.30, .04, .40), soft, 0.30, L.roofY - .09, -spec.sgRPBase.z);   // 副驾遮阳板
  const mount = spec.mirrorMounts.inner.mountPoint;
  put(box(.05, (L.roofY - .04) - mount.y, .05), shell, mount.x, (L.roofY - .04 + mount.y) / 2, mount.z);   // 内后视镜支架
  return group;
};

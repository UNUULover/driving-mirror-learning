import * as THREE from 'three';
import type { MirrorState, WeatherState } from '../core/types';

const DEG = Math.PI / 180;
/** Far enough that its parallax across the cockpit is negligible, but inside the cube camera's 120 m far plane or it gets clipped away entirely. */
const SUN_DISTANCE = 60;
const DAY = new THREE.Color(0x9fc7df), DUSK = new THREE.Color(0xc48362), NIGHT = new THREE.Color(0x07101a), FOG = new THREE.Color(0xb8c4c8);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Sun direction in the vehicle frame: azimuth 0 = straight ahead (+x), rising toward +z (which, with +x forward and +y up, is the driver's RIGHT); elevation above the horizon. */
export const sunDirection = (weather: WeatherState): THREE.Vector3 => { const e = weather.sunElevationDeg * DEG, a = weather.sunAzimuthDeg * DEG; return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)).normalize(); };
/** Below the horizon the sun contributes no direct light at all. */
export const sunAboveHorizon = (weather: WeatherState): number => Math.max(0, Math.sin(weather.sunElevationDeg * DEG));
const TUNNEL_WALL = new THREE.Color(0x241a12);
/** Sky colour follows the sun's height; fog then washes it out as density rises. A tunnel is enclosed, so there is no sky at all and the background is sodium-lit concrete. */
export const skyColor = (weather: WeatherState): THREE.Color => { if (weather.preset === 'tunnel') return TUNNEL_WALL.clone().multiplyScalar(0.5 + 2 * clamp01(weather.sunIntensity)); const el = weather.sunElevationDeg; const base = el >= 25 ? DAY.clone() : el >= 5 ? DUSK.clone().lerp(DAY, (el - 5) / 20) : el > -6 ? NIGHT.clone().lerp(DUSK, (el + 6) / 11) : NIGHT.clone(); return base.multiplyScalar(0.3 + 0.7 * clamp01(weather.sunIntensity)).lerp(FOG, clamp01(weather.fogDensity * 1.6)); };
/** Rain and standing water both blur the reflection. */
export const mirrorRoughness = (weather: WeatherState): number => clamp01(weather.rainIntensity * 0.6 + weather.roadWetness * 0.4);
/** Only glare arriving from behind the driver can trigger an auto-dimming mirror. */
export const glareFromBehind = (weather: WeatherState): number => weather.glareSources.reduce((sum, g) => sum + (g.position.x < 0 ? g.intensity : 0), 0);
/** An auto-dimming mirror drops to its night reflectance only when it is actually being glared into. */
export const mirrorReflectance = (mirror: MirrorState, weather: WeatherState): number => mirror.dimmingEnabled && glareFromBehind(weather) > 0 ? mirror.reflectanceNight : mirror.reflectanceDay;

const tagged = (scene: THREE.Scene, role: string): THREE.Object3D | undefined => scene.children.find((child) => child.userData.role === role);
const ensureLight = <T extends THREE.Light>(scene: THREE.Scene, role: string, make: () => T): T => { const found = tagged(scene, role); if (found) return found as T; const light = make(); light.userData.role = role; scene.add(light); return light; };
const ensureMesh = (scene: THREE.Scene, role: string, make: () => THREE.Mesh): THREE.Mesh => { const found = tagged(scene, role); if (found) return found as THREE.Mesh; const mesh = make(); mesh.userData.role = role; scene.add(mesh); return mesh; };

/** Applies every WeatherState field to the scene: sky, fog, sun direction/strength, glare sources and wet-road material. */
export const applyWeather = (scene: THREE.Scene, weather: WeatherState): void => {
  const sun = sunDirection(weather), above = sunAboveHorizon(weather);
  scene.background = skyColor(weather);
  scene.fog = weather.fogDensity > 0 ? new THREE.FogExp2(FOG.getHex(), weather.fogDensity * 0.09) : null;

  const hemi = ensureLight(scene, 'hemi', () => new THREE.HemisphereLight(0xe8f4ff, 0x44515a, 1));
  hemi.color.copy(skyColor(weather)).lerp(new THREE.Color(0xffffff), 0.25);
  hemi.intensity = 0.06 + weather.sunIntensity * (0.35 + 0.65 * above);

  const sunLight = ensureLight(scene, 'sunLight', () => { const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(6, 9, -4); return light; });
  sunLight.position.copy(sun).multiplyScalar(60);
  sunLight.target.position.set(0, 0, 0);
  sunLight.color.copy(weather.sunElevationDeg < 15 ? DUSK : new THREE.Color(0xffffff));
  sunLight.intensity = weather.sunIntensity * 3.2 * above;

  /* Two nested HDR spheres: the disc itself, plus the aureole — the scattered halo that is what actually
     veils a mirror pointed at a low sun. Both stay far above 1.0 in linear space so ACES rolls them off
     into a blown highlight; clamping them to LDR is exactly what would hide the effect. */
  const disc = ensureMesh(scene, 'sunDisc', () => new THREE.Mesh(new THREE.SphereGeometry(2.5, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })));
  disc.visible = above > 0.001;
  disc.position.copy(sun).multiplyScalar(SUN_DISTANCE);
  (disc.material as THREE.MeshBasicMaterial).color.copy(sunLight.color).multiplyScalar(weather.sunIntensity * 400 * above);

  const aureole = ensureMesh(scene, 'sunAureole', () => new THREE.Mesh(new THREE.SphereGeometry(16, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })));
  aureole.visible = above > 0.001;
  aureole.position.copy(sun).multiplyScalar(SUN_DISTANCE);
  (aureole.material as THREE.MeshBasicMaterial).color.copy(sunLight.color).multiplyScalar(weather.sunIntensity * 150 * above);

  for (const child of [...scene.children]) if (child.userData.role === 'glare') { scene.remove(child); child.traverse((o) => { const material = (o as THREE.Mesh).material; if (material) (material as THREE.Material).dispose(); }); }
  weather.glareSources.forEach((glare, index) => {
    const group = new THREE.Group(); group.userData.role = 'glare'; group.userData.index = index;
    const light = new THREE.PointLight(new THREE.Color(...glare.color), glare.intensity * 22, 40, 2);
    light.position.set(glare.position.x, glare.position.y, glare.position.z);
    group.add(light);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(...glare.color).multiplyScalar(glare.intensity * 120), fog: false }));
    bulb.position.copy(light.position);
    group.add(bulb);
    scene.add(group);
  });

  const road = tagged(scene, 'road');
  if (road) { const material = (road as THREE.Mesh).material as THREE.MeshStandardMaterial; material.roughness = 0.95 - 0.8 * clamp01(weather.roadWetness); material.metalness = 0.5 * clamp01(weather.roadWetness); material.color.setHex(weather.roadWetness > 0.5 ? 0x2b3234 : 0x4e5657); }
};

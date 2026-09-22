import * as THREE from 'three';
import type { MirrorState } from '../core/types';
import type { ProxyPrimitive, Vec3, WeatherState } from '../core/types';
import { createConvexMirror } from './convexMirror';
import { buildCockpit, buildVehicleBody, vehicleProxies } from './vehicleGeometry';
import { defaultVehicle } from '../core/vehicle';

export const buildLearningScene = (mirrors: Record<MirrorState['id'], MirrorState>, eye: Vec3, target:{x:number;z:number}, envMap:THREE.CubeTexture|null=null, weather:WeatherState|null=null): THREE.Scene => {
  /* Sky, lights and fog are all owned by applyWeather so a scene can never carry two suns. */
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x4e5657, roughness: .95 })); ground.rotation.x = -Math.PI / 2; ground.userData.role = 'road'; scene.add(ground);
  scene.add(buildVehicleBody(defaultVehicle));
  scene.add(buildCockpit(defaultVehicle));
  const targetMesh=new THREE.Mesh(new THREE.BoxGeometry(4,1.5,1.8),new THREE.MeshStandardMaterial({color:0x2673bd}));targetMesh.position.set(target.x,.75,target.z);scene.add(targetMesh);
  const proxies:ProxyPrimitive[]=[{kind:'plane',point:{x:0,y:0,z:0},normal:{x:0,y:1,z:0},label:'road',color:[.28,.31,.32]},...vehicleProxies(defaultVehicle),{kind:'aabb',min:{x:target.x-2,y:0,z:target.z-.9},max:{x:target.x+2,y:1.5,z:target.z+.9},label:'target-car',color:[.15,.42,.7]}];
  Object.values(mirrors).forEach(m=>{const mesh=createConvexMirror(m,eye,proxies,envMap,weather);mesh.userData.isMirror=true;mesh.userData.mirrorId=m.id;scene.add(mesh);});
  return scene;
};

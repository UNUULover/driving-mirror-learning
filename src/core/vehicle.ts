import type { VehicleSpec } from './types';
/**
 * ⚠ z 轴符号说明：车体系取 +x 车头、+y 向上，则右手系的第三轴 cross(x,y) 指向**驾驶员右侧**
 * （拿地理系类比：面朝东、头顶向上时，cross(东,上)=南，南在你右手边）。
 * 项目原先把 +z 标成「驾驶员左侧」，于是整台车在渲染里是镜像的——朝前看时驾驶员和左后视镜
 * 都落在画面右边，看起来是右舵车。这里把所有 z 取反，让「驾驶员 + 左后视镜」回到画面左侧，
 * 也就是真正的左舵车；镜面 id 的 left/right 标签随之与物理左右一致。
 * 因此现在：+z = 驾驶员右侧，−z = 驾驶员左侧，驾驶员在 z = −0.38。
 */
export const defaultVehicle: VehicleSpec={id:'training-sedan',name:'参数化教练车',wheelbase:2.6,trackWidth:1.5,overallLength:4.5,overallWidth:1.75,overallHeight:1.48,sgRPBase:{x:-.65,y:.52,z:-.38},seatTravelRange:{foreAft:[-.15,.25],height:[-.05,.08]},hoodFrontEdgeHeight:.85,pillarAAngleDeg:27,mirrorMounts:{inner:{id:'inner',radiusOfCurvature:Infinity,asphericZone:null,tilt:{yaw:0,pitch:0},mountPoint:{x:.45,y:1.25,z:-.1},halfWidth:.14,halfHeight:.05,reflectanceDay:.75,reflectanceNight:.3,dimmingEnabled:false},left:{id:'left',radiusOfCurvature:1200,asphericZone:null,tilt:{yaw:0,pitch:0},mountPoint:{x:.65,y:1.02,z:-.93},halfWidth:.12,halfHeight:.07,reflectanceDay:.72,reflectanceNight:.42,dimmingEnabled:false},right:{id:'right',radiusOfCurvature:1200,asphericZone:null,tilt:{yaw:0,pitch:0},mountPoint:{x:.65,y:1.02,z:.93},halfWidth:.12,halfHeight:.07,reflectanceDay:.72,reflectanceNight:.42,dimmingEnabled:false}},anchors:[{id:'left-wiper',kind:'wiperNode',part:'windshield',localPosition:{x:.55,y:.88,z:-.18},projection:'point',groundMarking:'parking-boundary'},{id:'hood-left',kind:'hoodEdge',part:'hood',localPosition:{x:1.6,y:.84,z:-.55},projection:'point',groundMarking:'lane-line'}]};

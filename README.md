这个项目是笨比作者在驾校学车的时候准备开发的，因为我科目二考试在项目立项之前已经挂了两次了，
我归结于镜子反光的问题还有地面虚线的问题所以开发了这个项目。
一开始想做镜面模拟，找AI解决了光学成像和镜面畸变的公式问题，然后慢慢写代码，但是写了半个月后我科目二居然过了，
所以这个项目就是一个在沙箱里有极其粗糙建模和精细光学成像的粗糙半成品
其中很多代码是agent实现的但是我预留了建模接口
而且渲染完全在user本地浏览器内核实现
如果你想把这个项目拿去用就直接用就好了，网页最下面给我一个@就行
注意该项目当前阶段使用的内存资源粗测只有5MB（作者很懒直接去资源调度器里搞的对比，这玩意只是个估值）
后续不是很建议使用特别精细的建模
二次开发的话可以做双选，左舵车和右舵车，如果可以的话后续还能添加增加参照物功能
总之，如果你觉得有用就帮作者测试一下这个半成品的实际资源占用，😘
+++==================================================================================================+++
This project was originally planned by the clumsy author while taking driving lessons at the driving school. 
Since I had already failed the Subject 2 test twice before officially starting the project, I blamed it on mirror glare and the faint ground dashed lines, which led to the development of this project.
At first, I wanted to create a mirror simulation, and I used AI to solve the formulas for optical imaging and mirror distortion. 
Then I slowly wrote the code, but after coding for half a month, I unexpectedly passed the Subject 2 test!
So, this project is a rough unfinished product featuring extremely basic modeling but precise optical imaging in a sandbox.
Many parts of the code are implemented by agents, but I have reserved modeling interfaces.
Also, the rendering is completely handled by the user's local browser kernel.
If you want to use this project, feel free to do so directly—just give me an @ at the bottom of the webpage. 
Please note that the memory resource usage at the current stage is roughly estimated at only 5MB
++++(the author is lazy and just compared it in the resource scheduler, so this is just an estimate). ++++
It is not recommended to use highly detailed modeling in the future.
For secondary development, you could add a dual-selection feature for left-hand drive and right-hand drive vehicles.
If possible, a reference object addition feature could also be added later.
In short, if you find this useful, please help the author test the actual resource consumption of this unfinished product. 😘

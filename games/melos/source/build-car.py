import bpy, math, json, os
from mathutils import Vector

# Game units: x=right, y=up, z=forward. Preserve the current scene.
col=bpy.data.collections.new('Melos compact hatchback v2')
bpy.context.scene.collection.children.link(col)
parts=[]
def xyz(p):return (p[0],p[2],p[1])
def mesh(name,verts,faces,color):
    m=bpy.data.meshes.new(name);m.from_pydata([xyz(v) for v in verts],[],faces);m.update()
    o=bpy.data.objects.new(name,m);col.objects.link(o)
    mat=bpy.data.materials.get('Melos '+color)
    if mat is None:
        mat=bpy.data.materials.new('Melos '+color)
        mat.diffuse_color=tuple((int(color[i:i+2],16)/255)**2.2 for i in (1,3,5))+(1,)
    o.data.materials.append(mat);o['paint']=color;parts.append(o)
    return o
def quad(name,vs,color):return mesh(name,vs,[(0,1,2,3)],color)
def box(name,c,size,color,bevel=0):
    x,y,z=c;w,h,d=[a/2 for a in size]
    o=mesh(name,[(x-w,y-h,z-d),(x+w,y-h,z-d),(x+w,y+h,z-d),(x-w,y+h,z-d),(x-w,y-h,z+d),(x+w,y-h,z+d),(x+w,y+h,z+d),(x-w,y+h,z+d)],[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)],color)
    if bevel:
        mod=o.modifiers.new('Small edge highlights','BEVEL');mod.width=bevel;mod.segments=1
    return o
def wheel(name,x,y,z,r,width,color,n=12):
    verts=[]
    # Chamfer tire edges rather than making a square-ended cylinder.
    rings=[(-width/2,r*.87),(-width*.32,r),(width*.32,r),(width/2,r*.87)]
    for dx,rr in rings:
        for i in range(n):
            a=2*math.pi*i/n;verts.append((x+dx,y+math.sin(a)*rr,z+math.cos(a)*rr))
    faces=[tuple(range(n-1,-1,-1)),tuple(range(3*n,4*n))]
    for j in range(3):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    o=mesh(name,verts,faces,color)
    o['wheelPivot']=[12.25 if x>0 else -12.25,y,z]
    return o

red='#c74733';darkred='#ad382b';trim='#343538';glass='#344f58';cream='#ece2c9'
stations=[-24,-21,-20,-18,-16,-14,-12,-10,-8,0,8,10,12,14,16,18,20,21,24]
def width(z):return 12.8-max(0,abs(z)-19)*.31
def top(z):return 17.5-max(0,z-9)*.15-max(0,-z-16)*.07
def bottom(z):
    d=min(abs(z-14),abs(z+14))
    return 6+math.sqrt(max(0,6.7**2-d*d)) if d<6.7 else 5.4
for side in (-1,1):
    for a,b in zip(stations,stations[1:]):
        wa,wb=width(a),width(b);ba,bb=bottom(a),bottom(b)
        quad('Sculpted body side',[(side*wa,ba,a),(side*wb,bb,b),(side*wb,top(b)-1,b),(side*wa,top(a)-1,a)],red)
        quad('Shoulder bevel',[(side*wa,top(a)-1,a),(side*wb,top(b)-1,b),(side*(wb-.8),top(b),b),(side*(wa-.8),top(a),a)],red)
    # Thin painted lip traces each genuine wheel opening.
    for zc in (-14,14):
        for i in range(8):
            a=i*math.pi/8;b=(i+1)*math.pi/8
            quad('Wheel arch lip',[(side*12.88,6+math.sin(a)*6.72,zc+math.cos(a)*6.72),(side*12.88,6+math.sin(b)*6.72,zc+math.cos(b)*6.72),(side*12.88,6+math.sin(b)*7.18,zc+math.cos(b)*7.18),(side*12.88,6+math.sin(a)*7.18,zc+math.cos(a)*7.18)],darkred)
for a,b in zip(stations,stations[1:]):
    quad('Bonnet and tail deck',[(-width(a)+.8,top(a),a),(width(a)-.8,top(a),a),(width(b)-.8,top(b),b),(-width(b)+.8,top(b),b)],red)
for z in (-24,24):
    w=width(z);quad('End panel',[(-w,5.4,z),(w,5.4,z),(w,top(z)-1,z),(-w,top(z)-1,z)],red)
    quad('End shoulder bevel',[(-w,top(z)-1,z),(w,top(z)-1,z),(w-.8,top(z),z),(-w+.8,top(z),z)],red)
box('Undercarriage',(0,5,0),(18,2,43),trim)

# A sloping hatch and windscreen, with visible red pillars around inset glass.
base=[(-11.4,17,-14),(11.4,17,-14),(11.4,17,9),(-11.4,17,9)]
roof=[(-9.1,26.4,-7.5),(9.1,26.4,-7.5),(9.1,26.4,4),(-9.1,26.4,4)]
mesh('Cabin pillars',base+roof,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],red)
quad('Rear hatch glass',[(-9.7,18.7,-12.86),(9.7,18.7,-12.86),(7.9,25.3,-8.31),(-7.9,25.3,-8.31)],glass)
quad('Front windscreen',[(-10,18.5,8.23),(10,18.5,8.23),(8,25.3,4.64),(-8,25.3,4.64)],'#48646d')
for s in (-1,1):
    # Split side glass leaves a central B pillar.
    quad('Rear side glass',[(s*11.13,18.5,-12.4),(s*11.13,18.5,-2.3),(s*9.38,25.2,-2.3),(s*9.38,25.2,-6.9)],glass)
    quad('Front side glass',[(s*11.13,18.5,-1.35),(s*11.13,18.5,7.6),(s*9.38,25.2,3.2),(s*9.38,25.2,-1.35)],glass)
    box('Door handle',(s*12.86,15,-3.5),(.22,.65,2.6),'#dfcdb3',.08)
    box('Side mirror',(s*13.05,19,6.5),(3.2,2.1,2.5),red,.45)
    box('Mirror glass',(s*13.05,19,5.16),(2.3,1.3,.18),glass)
box('Cream roof',(0,26.7,-1.8),(18.9,1.25,12.3),cream,.5)
box('Hatch handle',(0,14.1,-24.12),(3.6,.65,.35),'#d7cbbc',.12)
box('Rear bumper',(0,6.9,-24.35),(22.6,2.6,1.5),trim,.55)
box('Bumper chrome',(0,7.35,-25.13),(20,.6,.2),'#b6bbb5')
box('Front bumper',(0,6.8,24.2),(21.5,2.4,1.3),trim,.45)
box('Front grille',(0,11,24.13),(9,3,.28),'#272e30',.12)
box('Rear plate recess',(0,10.3,-24.15),(6.7,3.2,.2),trim)
box('Ivory plate',(0,10.3,-24.3),(5.7,2.5,.18),'#f0e9d6',.12)
for s in (-1,1):
    box('Rear lamp surround',(s*8.35,12.3,-24.11),(4.6,3.4,.55),'#762b27',.3)
    box('Rear red lens',(s*8.35,12.9,-24.48),(3.7,1.65,.25),'#e15e42',.16)
    box('Rear amber lens',(s*8.35,11.5,-24.48),(3.7,.8,.25),'#dfb174',.12)
    box('Headlight',(s*8,11.8,24.17),(4.3,3.3,.6),'#eee6c9',.4)
    for z in (-14,14):
        wheel('Tire',s*12.25,6,z,5.85,3.15,'#282c2c')
        wheel('Steel rim',s*13.9,6,z,3.55,.22,'#b1b6b1',10)
        wheel('Hub cap',s*14.08,6,z,1.85,.22,'#d6d4c6',8)
        for i in range(5):
            a=i*2*math.pi/5
            vs=[(s*14.12,6+math.sin(a+da)*r,z+math.cos(a+da)*r) for r,da in [(1.9,-.13),(3.05,-.13),(3.05,.13),(1.9,.13)]]
            o=quad('Wheel ventilation slot',vs,'#555e5d');o['wheelPivot']=[s*12.25,6,z]

bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();faces=[]
light=Vector((-.45,-.55,1)).normalized()
for o in parts:
    ev=o.evaluated_get(deps);m=ev.to_mesh()
    paint=o['paint'];base=[int(paint[i:i+2],16) for i in (1,3,5)]
    for p in m.polygons:
        # Absolute normal handles authored winding consistently, with darker undersides.
        n=p.normal;bright=.74+.26*abs(n.dot(light))
        c='#'+''.join(format(round(v*bright),'02x') for v in base)
        vs=[]
        for i in p.vertices:
            v=o.matrix_world@m.vertices[i].co;vs.extend([round(v.x,3),round(v.z,3),round(v.y,3)])
        face={'v':vs,'c':c}
        if 'wheelPivot' in o:face['wheel']=list(o['wheelPivot'])
        faces.append(face)
    ev.to_mesh_clear()
path=os.path.join(bpy.path.abspath('//'), 'car-model.js')
with open(path,'w',encoding='utf8') as f:f.write('// Blender compact hatchback: wheel arches, sloping glass, chamfered tires.\nwindow.MELOS_CAR='+json.dumps(faces,separators=(',',':'))+';\n')
print('Car v2:',len(faces),'faces;',os.path.getsize(path),'bytes')

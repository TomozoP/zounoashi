import bpy, math, json, os
from mathutils import Vector

# Dedicated collection; leave the user's existing car scene untouched.
collection=bpy.data.collections.new('Melos scenery low poly')
bpy.context.scene.collection.children.link(collection)
models={}
current=[]
def keep(o,color):
    for c in list(o.users_collection): c.objects.unlink(o)
    collection.objects.link(o)
    o['melos_color']=color
    current.append(o)
    return o
def box(name,loc,size,color):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=size
    return keep(o,color)
def ico(name,loc,size,color):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=size
    return keep(o,color)
def cyl(name,loc,radius,depth,color,axis='Z',vertices=8,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=radius if r2 is None else r2,depth=depth,location=loc)
    o=bpy.context.object;o.name=name
    if axis=='X':o.rotation_euler[1]=math.pi/2
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    return keep(o,color)
def mesh(name,vertices,faces,color):
    m=bpy.data.meshes.new(name);m.from_pydata(vertices,[],faces);m.update()
    o=bpy.data.objects.new(name,m);collection.objects.link(o);o['melos_color']=color;current.append(o)
def finish(name):
    bpy.context.view_layer.update()
    faces=[]
    light=Vector((-0.45,-0.5,1)).normalized()
    for o in current:
        for p in o.data.polygons:
            n=(o.matrix_world.to_3x3().inverted().transposed()@p.normal).normalized()
            brightness=0.72+0.28*max(0,n.dot(light))
            base=o['melos_color'];rgb=[int(base[i:i+2],16) for i in (1,3,5)]
            color='#'+''.join(format(round(c*brightness),'02x') for c in rgb)
            verts=[]
            for i in p.vertices:
                v=o.matrix_world@o.data.vertices[i].co
                verts.extend([round(v.x,3),round(v.z,3),round(v.y,3)])
            faces.append({'v':verts,'c':color,'slot':'cloth' if base=='#d9d2c2' else ''})
    models[name]=faces
    # Display a lineup in Blender, after exporting local coordinates.
    for o in current:o.location.x+=len(models)*170
    current.clear()

cyl('Tree trunk',(0,0,28),7,56,'#70543b',vertices=6,r2=5)
ico('Tree crown',(0,0,69),(38,32,37),'#65854a')
ico('Tree crown light',(-13,2,90),(25,24,28),'#789754')
finish('tree')
box('Plaster house',(0,0,28),(108,86,56),'#dbcdb1')
mesh('Terracotta roof',[(-61,-49,55),(61,-49,55),(61,49,55),(-61,49,55),(0,-49,86),(0,49,86)],[(0,1,4),(3,5,2),(0,4,5,3),(4,1,2,5),(0,3,2,1)],'#b76548')
box('Door',(0,-43.5,17),(20,1,34),'#655040')
for x in (-33,33):box('Window',(x,-43.6,33),(15,1,17),'#637777')
box('Chimney',(31,16,77),(13,15,29),'#c8b79b')
finish('house')
cyl('Column base',(0,0,5),21,10,'#c4bba4',vertices=8)
cyl('Column shaft',(0,0,52),12,84,'#dfd6bd',vertices=8,r2=10)
box('Column capital',(0,0,99),(34,12,12),'#e9dfc6')
finish('column')
ico('Bush',(0,0,14),(27,23,19),'#7e8d51')
ico('Bush lobe',(-14,1,13),(17,18,14),'#8d995d')
finish('bush')
ico('Rock',(0,0,0.44),(1,0.92,0.77),'#aaa294')
finish('rock')
cyl('Fallen trunk',(0,0,13),13,2,'#77583e',axis='X',vertices=8)
for x in (-1.004,1.004):cyl('Cut wood',(x,0,13),11.3,.012,'#c8a371',axis='X',vertices=8)
finish('log')
box('Cart bed',(0,0,15),(60,43,7),'#98764e')
for y in (-23,23):box('Cart end',(0,y,28),(62,5,24),'#a7865a')
for x in (-32,32):
    box('Cart side',(x,0,28),(5,47,24),'#97734c')
    cyl('Cart wheel',(x*1.16,0,12),12,5,'#554638',axis='X',vertices=10)
    cyl('Cart hub',(x*1.25,0,12),4,2,'#b6a077',axis='X',vertices=6)
for x in (-21,21):box('Cart handle',(x,40,17),(4,42,4),'#745a3d')
ico('Sack',(0,0,29),(17,16,17),'#c9b27d')
finish('cart')
for kind in ('citizen','bandit'):
    for x in (-4.4,4.4):box('Leg',(x,0,5.5),(5.6,7,11),'#665347')
    cyl('Tunic',(0,0,16),9.8,13,'#d9d2c2',vertices=6,r2=7.2)
    ico('Head',(0,0,28),(5.7,5.2,6.4),'#d7ae87')
    ico('Hair',(0,0,31.5),(5.8,5.3,3.7),'#5b4436')
    for x in (-10,10):box('Arm',(x,0,17),(4,5,12),'#d7ae87')
    if kind=='bandit':
        box('Belt',(0,-.2,13),(18,13,2),'#584132')
        cyl('Club',(13,0,20),2,24,'#705039',vertices=5)
    finish(kind)

path=os.path.join(bpy.path.abspath('//'), 'scenery-models.js')
with open(path,'w',encoding='utf8') as f:f.write('// Authored in Blender; compact flat-shaded meshes.\nwindow.MELOS_SCENERY='+json.dumps(models,separators=(',',':'))+';\n')
print({k:len(v) for k,v in models.items()})
print('bytes',os.path.getsize(path))

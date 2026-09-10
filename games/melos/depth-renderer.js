// Small depth-buffered renderer for the game's already projected polygon data.
window.createMelosDepthRenderer = function () {
  var surface = document.createElement('canvas');
  var gl = surface.getContext('webgl', { alpha:true, antialias:true, premultipliedAlpha:true });
  if (!gl) return null;
  function shader(type, source) {
    var s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
    if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,
    'attribute vec3 p; attribute vec3 color; uniform vec4 projection; varying vec3 c; void main(){ c=color; gl_Position=vec4(p.x*projection.x,p.y*projection.y,p.z*projection.z+projection.w,p.z); }'));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,
    'precision mediump float; varying vec3 c; void main(){gl_FragColor=vec4(c,1.0);}'));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  var buffer=gl.createBuffer(), pos=gl.getAttribLocation(program,'p'), color=gl.getAttribLocation(program,'color');
  var projection=gl.getUniformLocation(program,'projection'), colors=Object.create(null), data=new Float32Array(65536);
  surface.addEventListener('webglcontextlost',function(e){e.preventDefault();});
  return function(ctx,polys,count,width,height,focal,ratio){
    if(gl.isContextLost()) return false;
    var needed=0,i,j,k;
    for(i=0;i<count;i++) needed+=(polys[i].v.length/3-2)*18;
    if(data.length<needed) data=new Float32Array(Math.max(needed,data.length*2));
    var offset=0;
    for(i=0;i<count;i++) {
      var face=polys[i],v=face.v,c=colors[face.c];
      if(!c) { c=face.c.match(/[\d.]+/g).slice(0,3).map(function(n){return Number(n)/255;}); colors[face.c]=c; }
      for(j=1;j<v.length/3-1;j++) {
        var indices=[0,j*3,(j+1)*3];
        for(k=0;k<3;k++){var n=indices[k]; data[offset++]=v[n];data[offset++]=v[n+1];data[offset++]=v[n+2];data[offset++]=c[0];data[offset++]=c[1];data[offset++]=c[2];}
      }
    }
    var w=Math.round(width*ratio),h=Math.round(height*ratio);
    if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}
    gl.viewport(0,0,w,h);gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform4f(projection,focal/(width/2),focal/(height/2),(6000+6)/(6000-6),-2*6000*6/(6000-6));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data.subarray(0,offset),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,24,12);
    gl.drawArrays(gl.TRIANGLES,0,offset/6);
    ctx.drawImage(surface,0,0,width,height);
    return true;
  };
};

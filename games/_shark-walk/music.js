/* 笙の持続音、笛の揺れ、間を空けた太鼓を重ねる、雅楽風の自作曲。 */
function SharkMusic(ac) {
  var source=null,buffer=null;
  function compose(){
    var rate=22050,seconds=48,n=rate*seconds,data=new Float32Array(n);
    function hz(note){return 440*Math.pow(2,(note-69)/12);}
    function voice(start,duration,note,volume,kind){
      var count=Math.floor(duration*rate),offset=Math.floor(start*rate),frequency=hz(note),phase=0;
      for(var i=0;i<count;i++){
        var t=i/rate,u=t/duration,attack=kind==='drum'?.025:kind==='gong'?.015:kind==='sho'?1.6:.22;
        var envelope=Math.min(1,t/attack)*Math.pow(Math.sin(Math.PI*u),kind==='sho'?.7:.45);
        var vibrato=kind==='flute'?Math.sin(t*29)*.0025*Math.min(1,t):.0006*Math.sin(t*3.3);
        var glide=kind==='flute'?1-.022*Math.exp(-t*5):1;
        phase+=2*Math.PI*frequency*glide*(1+vibrato)/rate;
        var sample;
        if(kind==='sho')sample=Math.sin(phase)+.24*Math.sin(phase*2)+.13*Math.sin(phase*3);
        else if(kind==='flute')sample=Math.sin(phase)+.4*Math.sin(phase*2)+.17*Math.sin(phase*3)+.08*Math.sin(phase*5);
        else if(kind==='drum'){sample=Math.sin(phase+2*(1-Math.exp(-t*18)))+.3*Math.sin(phase*1.51);envelope*=Math.exp(-t*3.8);}
        else{sample=Math.sin(phase)+.5*Math.sin(phase*1.48)+.25*Math.sin(phase*2.09);envelope*=Math.exp(-t*1.2);}
        data[(offset+i)%n]+=sample*envelope*volume;
      }
    }
    var chords=[[62,69,71,76,78],[64,69,73,78,81],[62,67,71,76,81],[62,69,74,78,83],[64,69,73,76,81],[62,69,71,76,78]];
    chords.forEach(function(chord,j){chord.forEach(function(note,k){voice(j*8+k*.11,10.5,note,.018,'sho');});});
    [[2,76,2.8],[5.5,78,2],[9,81,3.5],[13.5,78,2.7],[17,76,4],[22,74,2.8],[26,76,2],[29,78,3.4],[33.5,83,2.7],[37,81,3],[41,78,2],[44,76,3.8]].forEach(function(v){voice(v[0],v[2],v[1],.052,'flute');});
    [0,12,24,36].forEach(function(t){voice(t,2.5,38,.17,'drum');voice(t+6,4,85,.028,'gong');});
    buffer=ac.createBuffer(2,n,rate);
    var left=buffer.getChannelData(0),right=buffer.getChannelData(1),peak=0;
    for(var i=0;i<n;i++){
      left[i]=data[i]+.24*data[(i+n-3021)%n]+.12*data[(i+n-9128)%n];
      right[i]=data[i]+.24*data[(i+n-5137)%n]+.12*data[(i+n-11378)%n];
      peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
    }
    var gain=.28/Math.max(.28,peak);
    for(var i=0;i<n;i++){left[i]*=gain;right[i]*=gain;}
  }
  return {
    start:function(){if(source||ac.state==='closed')return;if(!buffer)compose();source=ac.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(ac.destination);source.start();},
    stop:function(){if(!source)return;source.stop();source.disconnect();source=null;}
  };
}

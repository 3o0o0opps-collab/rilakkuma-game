export class SweetAudio {
  constructor(){this.context=null;this.muted=false;this.nextBeat=0;this.beat=0;try{this.muted=localStorage.getItem('rilakkumaSweetRun.muted')==='true';}catch{}}
  start(){try{this.context??=new (window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended')this.context.resume();}catch{}}
  note(frequency,duration=.12,volume=.035,type='sine',at){
    if(!this.context||this.muted)return;
    const t=at??this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();
    o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(this.context.destination);o.start(t);o.stop(t+duration+.03);
  }
  effect(kind){this.start();if(kind==='coin'){this.note(1046,.13,.026);this.note(1568,.19,.015,'sine',this.context?.currentTime+.07);}else if(kind==='jump')this.note(523,.19,.025,'triangle');else if(kind==='roll')this.note(294,.15,.025,'triangle');else if(kind==='crash'){this.note(220,.35,.035,'triangle');this.note(165,.45,.02);}else if(kind==='start'){this.note(523,.22,.027);this.note(659,.25,.022,'sine',this.context?.currentTime+.12);this.note(784,.35,.02,'sine',this.context?.currentTime+.24);}}
  toggle(){this.start();this.muted=!this.muted;try{localStorage.setItem('rilakkumaSweetRun.muted',String(this.muted));}catch{}return this.muted;}
  update(playing){
    if(!this.context||!playing){this.nextBeat=0;return;}
    const t=this.context.currentTime;if(!this.nextBeat)this.nextBeat=t+.3;
    if(this.nextBeat>t+.15)return;if(this.nextBeat<t)this.nextBeat=t+.03;
    const melody=[659,784,880,784,659,523,587,659,784,880,1046,880,784,659,587,523];
    if(this.beat%2===0)this.note(melody[(this.beat/2)%melody.length],.62,.011,'sine',this.nextBeat);
    this.note([261.63,329.63,392,329.63,293.66,349.23,440,349.23][this.beat%8],.36,.007,'triangle',this.nextBeat);
    this.beat++;this.nextBeat+=.36;
  }
}

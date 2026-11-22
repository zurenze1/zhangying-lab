'use strict';

(() => {
  const Audio=window.AudioContext || window.webkitAudioContext;
  const trigger=document.getElementById('site-sound');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const preferenceKey='zy-v8-sound';
  const heardKey='zy-v8-proposal-titles';
  let heard=new Set();
  try { heard=new Set(JSON.parse(sessionStorage.getItem(heardKey)||'[]')); } catch {}
  let choice;
  let audio;
  let master;
  let noise;
  let playbackUnavailable=false;
  const lastEffects=new Map();
  try { choice=localStorage.getItem(preferenceKey); } catch {}
  const enabled=()=>choice==null ? !reduced.matches : choice==='on';
  const videoPlaying=()=>[...document.querySelectorAll('video')].some(video=>!video.paused&&!video.ended);

  function sync() {
    const available=Boolean(Audio)&&!playbackUnavailable;
    trigger.disabled=!available;
    trigger.setAttribute('aria-pressed',String(available&&enabled()));
    trigger.title=!available ? '当前浏览器无法播放网页音效' : enabled() ? '关闭网页音效' : '打开网页音效';
    if (!audio) return;
    const now=audio.currentTime;
    const level=enabled()&&!videoPlaying()&&!document.hidden ? .46 : 0;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(level,now,.012);
  }
  function wake() {
    if (!Audio || playbackUnavailable || !enabled() || document.hidden || videoPlaying()) return false;
    if (!audio) {
      try {
        audio=new Audio();
        master=audio.createGain();
        master.gain.value=.46;
        master.connect(audio.destination);
      } catch {
        audio=master=undefined;
        playbackUnavailable=true;
        sync();
        return false;
      }
    }
    if (audio.state === 'suspended' || audio.state === 'interrupted') {
      try { audio.resume()?.catch(()=>{}); } catch { return false; }
    }
    return true;
  }
  function track() {
    const gain=audio.createGain();
    gain.connect(master);
    return {gain,sources:[]};
  }
  function envelope(param,start,duration,peak,attack) {
    const raised=Math.min(duration*.65,attack);
    param.setValueAtTime(.0001,start);
    param.exponentialRampToValueAtTime(peak,start+raised);
    param.exponentialRampToValueAtTime(.0001,start+duration);
  }
  function route(bus,source,shaping,start,duration,level,attack,offset=0) {
    const volume=audio.createGain();
    envelope(volume.gain,start,duration,level,attack);
    source.connect(shaping || volume);
    if (shaping) shaping.connect(volume);
    volume.connect(bus.gain);
    bus.sources.push(source);
    source.onended=()=>{
      source.disconnect();
      shaping?.disconnect();
      volume.disconnect();
      bus.sources.splice(bus.sources.indexOf(source),1);
      if (!bus.sources.length) bus.gain.disconnect();
    };
    source.start(start,offset);
    source.stop(start+duration+.014);
  }
  function tone(bus,start,duration,{from,to=from,level,attack=.018,type='sine'}) {
    const source=audio.createOscillator();
    source.type=type;
    source.frequency.setValueAtTime(from,start);
    source.frequency.exponentialRampToValueAtTime(to,start+duration);
    route(bus,source,null,start,duration,level,attack);
  }
  function breath(bus,start,duration,{from,to,level,q=.7,attack=.06,offset=.12}) {
    if (!noise) {
      noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*3),audio.sampleRate);
      const samples=noise.getChannelData(0);
      let seed=51323;
      for (let i=0;i<samples.length;i++) {
        seed^=seed<<13;
        seed^=seed>>>17;
        seed^=seed<<5;
        samples[i]=(seed>>>0)/2147483648-1;
      }
    }
    const source=audio.createBufferSource();
    source.buffer=noise;
    const filter=audio.createBiquadFilter();
    filter.type='bandpass';
    filter.Q.value=q;
    filter.frequency.setValueAtTime(from,start);
    filter.frequency.exponentialRampToValueAtTime(to,start+duration);
    route(bus,source,filter,start,duration,level,attack,offset);
  }
  function cue(kind,gesture=false) {
    if (videoPlaying() || !enabled() || document.hidden ||
        document.getElementById('opening')?.hidden===false) return;
    if (gesture ? !wake() : audio?.state!=='running') return;
    const now=audio.currentTime;
    if (now-(lastEffects.get(kind)??-Infinity)<.065) return;
    lastEffects.set(kind,now);
    const bus=track();
    const t=now+.008;
    if (kind==='card') {
      breath(bus,t,.13,{from:1100,to:440,q:1.5,level:.075,attack:.009});
      tone(bus,t,.16,{from:291,to:176,level:.04,attack:.008});
    } else if (kind==='section') {
      breath(bus,t,.23,{from:515,to:222,level:.057,attack:.055});
    } else {
      breath(bus,t,.072,{from:1100,to:605,level:.082,attack:.005});
      tone(bus,t,.09,{from:392,to:283,level:.035,attack:.005});
    }
    performance.mark('proposal-audio-'+kind);
    return true;
  }

  trigger.addEventListener('click',()=>{
    choice=enabled() ? 'off' : 'on';
    try { localStorage.setItem(preferenceKey,choice); } catch {}
    sync();
    if (enabled()) cue('tap',true);
  });
  document.addEventListener('proposal-sound',event=>{
    choice=event.detail;
    sync();
  });
  reduced.addEventListener('change',sync);
  window.addEventListener('storage',event=>{
    if(event.key!==preferenceKey) return;
    choice=event.newValue;
    sync();
  });
  document.addEventListener('play',event=>{
    if (event.target instanceof HTMLVideoElement) {
      sync();
    }
  },true);
  for (const event of ['pause','ended','emptied','visibilitychange']) document.addEventListener(event,sync,true);
  document.addEventListener('click',event=>{
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const control=event.target.closest('button, summary, .nav-links a, .hero-scroll');
    if (!control || control.disabled ||
        ['site-sound','entry-gate','entry-sound','skip-opening','replay-opening'].includes(control.id)) return;
    if (control.matches('summary, [aria-haspopup="dialog"], #open-screenplay, .close-script')) cue('card',true);
    else cue('tap',true);
  },true);
  const titles=new IntersectionObserver(entries=>{
    for (const entry of entries) {
      if (!entry.isIntersecting || document.getElementById('opening')?.hidden===false) continue;
      titles.unobserve(entry.target);
      const id=entry.target.id;
      if (heard.has(id) || !cue('section')) continue;
      heard.add(id);
      try { sessionStorage.setItem(heardKey,JSON.stringify([...heard])); } catch {}
    }
  },{threshold:.36});
  for (const title of document.querySelectorAll('main > section:not(.hero) h2')) titles.observe(title);
  sync();
})();

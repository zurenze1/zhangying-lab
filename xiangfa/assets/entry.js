'use strict';

(() => {
  const root = document.documentElement;
  const opening = document.getElementById('opening');
  const video = document.getElementById('opening-film');
  const gate = document.getElementById('entry-gate');
  const mute = document.getElementById('entry-sound');
  const skip = document.getElementById('skip-opening');
  const replay = document.getElementById('replay-opening');
  const headline = document.getElementById('intro-title');
  const content = [document.querySelector('.site-header'), document.querySelector('main')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const portrait = matchMedia('(max-width: 760px) and (orientation: portrait)');
  const seenKey = 'zy-v15-opening';
  const soundKey = 'zy-v8-sound';
  let hasSeen = false;
  let muted = false;
  let fallbackTimer;
  let finishTimer;
  let playToken = 0;
  let formats;
  let focusTarget = headline;

  try {
    hasSeen = sessionStorage.getItem(seenKey) === 'seen';
    muted = localStorage.getItem(soundKey) === 'off';
  } catch {}

  function syncSound() {
    video.muted = muted;
    mute.setAttribute('aria-pressed', String(!muted));
    mute.textContent = muted ? '声音关' : '声音开';
    mute.setAttribute('aria-label', muted ? '打开片头声音' : '关闭片头声音');
  }

  function show(target) {
    clearTimeout(finishTimer);
    focusTarget = target;
    opening.dataset.state = 'gate';
    root.classList.add('entry-locked');
    content.forEach(node => { node.inert = true; });
    opening.hidden = false;
    gate.focus({preventScroll:true});
  }

  function finish({fade = false} = {}) {
    if (opening.hidden || opening.dataset.state === 'closing') return;
    playToken++;
    clearTimeout(fallbackTimer);
    opening.dataset.state = 'closing';
    video.pause();
    root.classList.remove('entry-locked');
    content.forEach(node => { node.inert = false; });
    try { sessionStorage.setItem(seenKey,'seen'); } catch {}
    hasSeen = true;
    const reveal = () => {
      opening.hidden = true;
      video.removeAttribute('src');
      video.load();
      focusTarget.focus({preventScroll:true});
    };
    if (fade && !reduced.matches) finishTimer = setTimeout(reveal,520);
    else reveal();
  }

  function attempt() {
    if (opening.hidden || opening.dataset.state !== 'playing') return;
    const format = formats.shift();
    if (!format) {
      finish();
      return;
    }
    const token = ++playToken;
    const variant = portrait.matches ? 'tall' : 'wide';
    video.src = 'assets/intro-cold-' + variant + '.' + format;
    syncSound();
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (token === playToken && video.currentTime < .15) attempt();
    },4000);
    video.play().catch(error => {
      if (token !== playToken || opening.dataset.state !== 'playing') return;
      if (error.name === 'NotAllowedError') finish();
      else attempt();
    });
  }

  function play() {
    if (opening.dataset.state !== 'gate') return;
    window.scrollTo({top:0,behavior:'instant'});
    formats = ['mp4','webm'];
    opening.dataset.state = 'playing';
    skip.focus({preventScroll:true});
    attempt();
  }

  headline.tabIndex = -1;
  replay.hidden = false;
  syncSound();
  gate.addEventListener('click',play);
  skip.addEventListener('click',() => finish());
  replay.addEventListener('click',() => {
    if (!opening.hidden) return;
    try { muted = localStorage.getItem(soundKey) === 'off'; } catch {}
    show(replay);
    play();
  });
  mute.addEventListener('click',() => {
    muted = !muted;
    const choice = muted ? 'off' : 'on';
    try { localStorage.setItem(soundKey,choice); } catch {}
    syncSound();
    document.dispatchEvent(new CustomEvent('proposal-sound',{detail:choice}));
  });
  video.addEventListener('playing',() => {
    if (opening.dataset.state !== 'playing') return;
    clearTimeout(fallbackTimer);
  });
  video.addEventListener('waiting',() => {
    if (opening.dataset.state !== 'playing') return;
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(attempt,4500);
  });
  video.addEventListener('error',() => {
    const token = playToken;
    queueMicrotask(() => { if (token === playToken) attempt(); });
  });
  video.addEventListener('ended',() => finish({fade:true}));
  document.addEventListener('keydown',event => {
    if (opening.hidden || opening.dataset.state === 'closing') return;
    if (event.key === 'Escape') finish();
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const buttons = opening.dataset.state === 'gate' ? [gate,mute,skip] : [mute,skip];
    const index = buttons.indexOf(document.activeElement);
    buttons[(index+buttons.length+(event.shiftKey?-1:1))%buttons.length].focus({preventScroll:true});
  });
  reduced.addEventListener('change',event => { if (event.matches) finish(); });
  if (!location.hash && !reduced.matches && !hasSeen) show(headline);
})();

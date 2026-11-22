'use strict';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const entrance = document.getElementById('entrance');
const film = entrance.querySelector('video');
const enter = document.getElementById('enter');
const skipIntro = document.getElementById('skip-intro');
const replay = document.getElementById('replay');
const soundControls = [document.getElementById('sound'), document.getElementById('intro-sound')];
const tallScreen = matchMedia('(max-width: 767px) and (orientation: portrait)');
const sessionKey = 'zhang-site-v11-entered';
const soundKey = 'zy-v8-sound';
let choice = null;
let playing = false;
let sourceFormat;
let deadline;
let frame;
try { choice = localStorage.getItem(soundKey); } catch {}
const soundOn = () => choice === 'on' || (choice !== 'off' && !reduced.matches);

function reflectSound() {
  const on = soundOn();
  film.muted = !on;
  for (const button of soundControls) {
    button.setAttribute('aria-pressed', String(on));
    button.title = on ? '关闭片头声音' : '开启片头声音';
  }
}
function markEntered() {
  try { sessionStorage.setItem(sessionKey, '1'); } catch {}
}
function endIntro() {
  clearTimeout(deadline);
  cancelAnimationFrame(frame);
  playing = false;
  film.pause();
  if (entrance.open) entrance.close();
  if (film.readyState) film.currentTime = 0;
  film.hidden = true;
  entrance.classList.remove('is-playing', 'has-film');
  entrance.style.removeProperty('--reveal');
  enter.hidden = false;
  markEntered();
}
function setSources() {
  const format = tallScreen.matches ? 'tall' : 'wide';
  if (format === sourceFormat) return;
  sourceFormat = format;
  const sources = [
    ['mp4', 'video/mp4'],
    ['webm', 'video/webm']
  ].map(([extension, type]) => {
    const source = document.createElement('source');
    source.src = './assets/intro-' + format + '.' + extension;
    source.type = type;
    return source;
  });
  film.replaceChildren(...sources);
  film.load();
}
function revealOnFrame() {
  if (!playing || film.ended) return;
  if (Number.isFinite(film.duration)) {
    const fadeWindow = .59;
    const fade = Math.max(0, Math.min(1, 1 - (film.duration - film.currentTime) / fadeWindow));
    if (fade > 0) entrance.style.setProperty('--reveal', fade.toFixed(3));
  }
  frame = requestAnimationFrame(revealOnFrame);
}
function openIntro() {
  if (!entrance.open) entrance.showModal();
}
function startIntro() {
  if (playing) return;
  playing = true;
  markEntered();
  setSources();
  reflectSound();
  film.hidden = false;
  enter.hidden = true;
  entrance.classList.add('is-playing');
  skipIntro.focus({preventScroll:true});
  deadline = setTimeout(endIntro, 12000);
  film.play().catch(endIntro);
}

reflectSound();
for (const button of soundControls) {
  button.addEventListener('click', () => {
    choice = soundOn() ? 'off' : 'on';
    try { localStorage.setItem(soundKey, choice); } catch {}
    reflectSound();
  });
}
reduced.addEventListener('change', reflectSound);
addEventListener('storage', event => {
  if (event.key === soundKey) {
    choice = event.newValue;
    reflectSound();
  }
});
replay.addEventListener('click', () => {
  for (const clip of document.querySelectorAll('main video')) clip.pause();
  window.scrollTo({top:0, behavior:'instant'});
  openIntro();
  startIntro();
});
enter.addEventListener('click', startIntro);
skipIntro.addEventListener('click', endIntro);
entrance.addEventListener('cancel', event => { event.preventDefault(); endIntro(); });
film.addEventListener('playing', () => {
  entrance.classList.add('has-film');
  cancelAnimationFrame(frame);
  revealOnFrame();
});
film.addEventListener('ended', endIntro);
film.addEventListener('error', endIntro);
for (const button of document.querySelectorAll('[data-dialog], #sound, #replay')) button.hidden = false;
for (const button of document.querySelectorAll('[data-dialog]')) {
  button.addEventListener('click', () => document.getElementById(button.dataset.dialog).showModal());
}
for (const link of document.querySelectorAll('.menu-nav a')) {
  link.addEventListener('click',() => document.getElementById('menu').close());
}
let entered = false;
try { entered = sessionStorage.getItem(sessionKey) === '1'; } catch {}
if (!entered && !reduced.matches && (!location.hash || location.hash === '#home')) openIntro();

const featureClip = document.querySelector('.feature-clip video');
const clipSound = document.querySelector('.clip-sound');
function reflectClipSound() {
  clipSound.setAttribute('aria-pressed', String(!featureClip.muted));
  clipSound.textContent = featureClip.muted ? '开启声音' : '关闭声音';
}
clipSound.hidden = false;
clipSound.addEventListener('click', () => {
  featureClip.muted = !featureClip.muted;
  reflectClipSound();
  if (!featureClip.muted) featureClip.play().catch(() => {});
});
featureClip.addEventListener('volumechange', reflectClipSound);
if (!reduced.matches && 'IntersectionObserver' in window) {
  let inView = false;
  function startVisibleClip() {
    if (inView && !entrance.open) featureClip.play().catch(() => {});
  }
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting && entry.intersectionRatio >= .5;
    startVisibleClip();
  }, {threshold: .5});
  featureClip.addEventListener('play', () => {
    observer.disconnect();
    entrance.removeEventListener('close', startVisibleClip);
  }, {once: true});
  entrance.addEventListener('close', startVisibleClip);
  observer.observe(featureClip);
}

const timeline = document.querySelectorAll('.timeline li');
if (reduced.matches || !('IntersectionObserver' in window)) {
  timeline.forEach(item => item.dataset.lit = '');
} else {
  const step = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.lit = '';
      step.unobserve(entry.target);
    }
  }, {rootMargin:'0px 0px -22% 0px',threshold:.35});
  timeline.forEach(item => step.observe(item));
}

const {works,followers,topics} = JSON.parse(document.getElementById('works-data').textContent);
const metrics = document.querySelectorAll('[data-metric]');
const ranking = document.getElementById('work-ranking');
const formatter = new Intl.NumberFormat('zh-CN');
document.getElementById('followers').firstChild.textContent = formatter.format(followers/10000);
document.getElementById('work-count').textContent = formatter.format(works.length);
document.getElementById('topic-count').textContent = formatter.format(topics.length);
function showRanking(key) {
  const ordered = works.filter(work => Number.isFinite(work[key]))
    .sort((a,b) => b[key]-a[key]).slice(0,5);
  const top = Math.max(1,ordered[0]?.[key] || 0);
  const rows = ordered.map(work => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = work.url;
    link.target = '_blank';
    link.rel = 'noopener';
    const name = document.createElement('span');
    name.className = 'work-label';
    name.textContent = work.title;
    const value = document.createElement('strong');
    value.className = 'work-value';
    value.textContent = formatter.format(work[key]);
    const date = document.createElement('span');
    date.className = 'work-date';
    date.textContent = work.published;
    const meter = document.createElement('span');
    meter.className = 'work-meter';
    meter.style.setProperty('--share', (work[key]/top*100) + '%');
    meter.setAttribute('aria-hidden','true');
    link.append(name,value,date,meter);
    item.append(link);
    return item;
  });
  ranking.replaceChildren(...rows);
}
for (const button of metrics) {
  button.addEventListener('click', () => {
    for (const other of metrics) other.setAttribute('aria-pressed',String(other === button));
    showRanking(button.dataset.metric);
  });
}
showRanking('likes');

'use strict';

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

const titles = new IntersectionObserver(entries => {
  for (const entry of entries) entry.target.classList.toggle('title-in-view', entry.isIntersecting);
}, {threshold: .25});
for (const heading of document.querySelectorAll('.chapter h2')) titles.observe(heading);

function sourceScript(url) {
  return new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = url;
    tag.onload = resolve;
    tag.onerror = reject;
    document.head.append(tag);
  });
}

const libraries = {
  gsap: ['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js', 'assets/vendor/gsap.min.js'],
  ScrollTrigger: ['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js', 'assets/vendor/ScrollTrigger.min.js'],
  Lenis: ['https://cdn.jsdelivr.net/npm/lenis@1.3.11/dist/lenis.min.js', 'assets/vendor/lenis.min.js'],
};
function loadLibrary(name) {
  const [remote, fallback] = libraries[name];
  if (location.protocol === 'file:') return sourceScript(fallback);
  return sourceScript(remote).catch(() => sourceScript(fallback));
}

function initEffects() {
  const {gsap, ScrollTrigger, Lenis} = window;
  if (!gsap || !ScrollTrigger || !Lenis) return;
  gsap.registerPlugin(ScrollTrigger);
  const html = document.documentElement;
  const setup = gsap.matchMedia();
  setup.add('(prefers-reduced-motion: no-preference)', () => {
    const lenis = new Lenis({autoRaf: false, smoothWheel: true, anchors: false});
    const tickLenis = time => lenis.raf(time * 1000);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(tickLenis);
    gsap.ticker.lagSmoothing(0);
    const scrollLink = event => {
      const anchor = event.target.closest('a[href^="#"]');
      if (!anchor || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || anchor.classList.contains('skip-link')) return;
      const target = document.getElementById(anchor.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      ScrollTrigger.refresh();
      history.pushState(null, '', anchor.hash);
      lenis.scrollTo(target, {offset: -74, duration: 0.86});
    };
    document.addEventListener('click', scrollLink);

    const portrait = document.querySelector('.hero-image');
    gsap.to(portrait, {scale: 0.83, yPercent: 7, ease: 'none',
      scrollTrigger: {trigger: '.hero-grid', start: 'top top', end: 'bottom 28%', scrub: true,
        onUpdate: trigger => portrait.classList.toggle('is-card',trigger.progress > 0.19)}});

    for (const title of document.querySelectorAll('.chapter h2')) {
      gsap.from(title.querySelectorAll('.title-mask > span'), {yPercent: 105, opacity: 0, duration: 0.7,
        ease: 'power3.out', stagger: 0.09, scrollTrigger: {trigger: title, start: 'top 92%', once: true}});
    }

    for (const node of document.querySelectorAll('[data-count]')) {
      const value = Number(node.dataset.count);
      const precision = Number(node.dataset.decimals || 0);
      const tracker = {value: 0};
      ScrollTrigger.create({trigger: node, start: 'top 96%', once: true, onEnter: () => {
        gsap.to(tracker, {value, ease: 'power2.out', duration: 0.8, onUpdate: () => {
          node.textContent = tracker.value.toFixed(precision);
        }});
      }});
    }
    const bars = document.querySelector('#topic-bars');
    function bounceBars() {
      gsap.fromTo(bars.querySelectorAll('.bar-fill'), {scaleX: 0}, {scaleX: 1, duration: 0.64, stagger: 0.035, ease: 'power2.out', overwrite: true});
    }
    ScrollTrigger.create({trigger: bars, start: 'top 87%', once: true, onEnter: bounceBars});
    document.querySelector('.chart-controls').addEventListener('click', bounceBars);

    const pointer = gsap.matchMedia();
    pointer.add('(min-width: 761px) and (hover: hover) and (pointer: fine)', () => {
      const tilt = [...document.querySelectorAll('.column-card,.peer')];
      const magnets = [...document.querySelectorAll('.magnetic')];
      const removals = [];
      const setInteraction = (el, apply, reset) => {
        function move(e) {
          const box = el.getBoundingClientRect();
          apply((e.clientX - box.left) / box.width - 0.5, (e.clientY - box.top) / box.height - 0.5);
        }
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', reset);
        removals.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', reset); reset(); });
      };
      for (const card of tilt) {
        card.setAttribute('data-tilt', '');
        setInteraction(card, (x, y) => {
          card.style.setProperty('--shine-x', `${(x + .5) * 100}%`);
          card.style.setProperty('--shine-y', `${(y + .5) * 100}%`);
          card.style.setProperty('--shine', '1');
          gsap.to(card, {rotateY: x * 7, rotateX: -y * 7, transformPerspective: 800, duration: 0.22, overwrite: true});
        }, () => {
          card.style.setProperty('--shine', '0');
          gsap.to(card, {rotateX: 0, rotateY: 0, duration: 0.25, overwrite: true});
        });
      }
      for (const button of magnets) setInteraction(button, (x, y) => {
        gsap.to(button, {x: x * 12, y: y * 8, duration: 0.22, overwrite: true});
      }, () => gsap.to(button, {x: 0, y: 0, duration: 0.25, overwrite: true}));
      return () => removals.forEach(remove => remove());
    });

    const refreshGallery = () => ScrollTrigger.refresh();
    document.querySelector('main').addEventListener('toggle', refreshGallery, true);
    html.dataset.motion = 'ready';
    return () => {
      gsap.ticker.remove(tickLenis);
      lenis.destroy();
      delete html.dataset.motion;
      pointer.revert();
      document.removeEventListener('click', scrollLink);
      document.querySelector('main').removeEventListener('toggle', refreshGallery, true);
      document.querySelectorAll('[data-count]').forEach(el => {
        el.textContent = Number(el.dataset.count).toFixed(Number(el.dataset.decimals || 0));
      });
    };
  });
}

if (!motionPreference.matches) {
  Promise.all([window.proposalReady, loadLibrary('gsap').then(() => loadLibrary('ScrollTrigger')), loadLibrary('Lenis')]).then(initEffects).catch(() => {});
}

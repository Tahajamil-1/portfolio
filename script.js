const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const toast = $('#toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}
function openWindow(name) {
  const target = $(`#window-${name}`);
  if (!target) return;
  $$('.app-window').forEach(win => { win.hidden = win !== target; });
  target.hidden = false;
  target.style.zIndex = String(Date.now() % 10000);
}
function closeWindow(name) {
  const target = $(`#window-${name}`);
  if (target) target.hidden = true;
}
$$('[data-open]').forEach(button => button.addEventListener('click', () => openWindow(button.dataset.open)));
$$('[data-close]').forEach(button => button.addEventListener('click', () => closeWindow(button.dataset.close)));
// Wallpaper switching is handled by the wallpaper manager at the bottom of this file.

// Make windows draggable on desktop using their title bar.
$$('.app-window').forEach(win => {
  const bar = $('.window-bar', win);
  let dragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  bar.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || window.innerWidth < 700) return;
    dragging = true;
    const rect = win.getBoundingClientRect();
    win.style.transform = 'none';
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    startX = event.clientX; startY = event.clientY;
    initialLeft = rect.left; initialTop = rect.top;
    bar.setPointerCapture(event.pointerId);
    win.style.zIndex = String(Date.now() % 10000);
  });
  bar.addEventListener('pointermove', event => {
    if (!dragging) return;
    const maxLeft = window.innerWidth - win.offsetWidth;
    const maxTop = window.innerHeight - 100;
    win.style.left = `${Math.max(8, Math.min(maxLeft - 8, initialLeft + event.clientX - startX))}px`;
    win.style.top = `${Math.max(58, Math.min(maxTop, initialTop + event.clientY - startY))}px`;
  });
  const stopDrag = () => { dragging = false; };
  bar.addEventListener('pointerup', stopDrag);
  bar.addEventListener('pointercancel', stopDrag);
});
$('#copyEmail').addEventListener('click', async () => {
  const email = $('#emailText').textContent.trim();
  try {
    await navigator.clipboard.writeText(email);
    showToast('Email copied to clipboard');
  } catch {
    showToast(`Replace this email in script.js: ${email}`);
  }
});
function updateClock() {
  $('#clock').textContent = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date());
}
updateClock();
setInterval(updateClock, 30000);

// Personalize these values before publishing.
const PORTFOLIO_CONFIG = {
  email: 'your.email@example.com',
  // Add your real social URLs here when ready.
  github: '',
  linkedin: '',
  instagram: ''
};
$('#emailText').textContent = PORTFOLIO_CONFIG.email;

// GitHub / LinkedIn icons (dock + Contact window). Add your URLs in PORTFOLIO_CONFIG above.
$$('[data-social]').forEach(link => {
  const url = PORTFOLIO_CONFIG[link.dataset.social];
  if (url) { link.href = url; return; }
  link.addEventListener('click', e => {
    e.preventDefault();
    showToast(`Add your ${link.dataset.social} link in script.js (PORTFOLIO_CONFIG)`);
  });
});


/* =====================================================================
   WALLPAPER MANAGER  (presets + your own uploaded photo)
   ===================================================================== */
const WALL_KEY = 'portfolio.wallpaper';
const CUSTOM_KEY = 'portfolio.wallpaper.custom';
const WALL_NAMES = { onyx: 'Onyx', graphite: 'Graphite', slate: 'Slate', snow: 'Snow', silver: 'Silver', custom: 'Your photo' };
const LIGHT_WALLPAPERS = ['snow', 'silver'];   // everything else uses the matte-black theme
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;
const MAX_FILE_MB = 30;       // refuse absurdly large files
const MAX_SIDE_PX = 2000;     // photo is resized to this before saving

const wallInput = $('#wallpaperInput');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
let customWallpaper = null;

function setCustomImage(dataUrl) {
  customWallpaper = dataUrl;
  document.documentElement.style.setProperty('--custom-wall', `url("${dataUrl}")`);
  $$('[data-wall="custom"]').forEach(el => { el.hidden = false; });
  $('#wallRemove').hidden = false;
}
function clearCustomImage() {
  customWallpaper = null;
  document.documentElement.style.removeProperty('--custom-wall');
  $$('[data-wall="custom"]').forEach(el => { el.hidden = true; });
  $('#wallRemove').hidden = true;
  store.remove(CUSTOM_KEY);
}
function applyWallpaper(name, { silent = false } = {}) {
  if (!WALL_NAMES[name] || (name === 'custom' && !customWallpaper)) name = 'onyx';
  document.body.dataset.wallpaper = name;
  document.body.dataset.theme = LIGHT_WALLPAPERS.includes(name) ? 'light' : 'dark';
  $$('[data-wall]').forEach(el => {
    const on = el.dataset.wall === name;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  store.set(WALL_KEY, name);
  if (!silent) showToast(`${WALL_NAMES[name]} wallpaper applied`);
}
$$('[data-wall]').forEach(el => el.addEventListener('click', () => applyWallpaper(el.dataset.wall)));

// Read a chosen image, shrink it, and return a JPEG data URL (keeps storage small).
async function fileToWallpaper(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b1722';              // background for transparent PNG/WEBP areas
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.84);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function handleWallpaperFile(file) {
  if (!file) return;
  const typeOk = ALLOWED_TYPES.includes(file.type) || (!file.type && ALLOWED_EXT.test(file.name));
  if (!typeOk || !ALLOWED_EXT.test(file.name)) { showToast('Please choose a JPG, PNG or WEBP image'); return; }
  if (file.size > MAX_FILE_MB * 1024 * 1024) { showToast(`That image is too large (max ${MAX_FILE_MB} MB)`); return; }
  try {
    const dataUrl = await fileToWallpaper(file);
    setCustomImage(dataUrl);
    const saved = store.set(CUSTOM_KEY, dataUrl);
    applyWallpaper('custom', { silent: true });
    showToast(saved ? 'Your wallpaper is set' : 'Wallpaper set for this visit (too large to remember)');
  } catch {
    showToast("Couldn't read that image. Try a different file");
  }
}
// Every "upload" button opens the computer's native file picker.
const openFilePicker = () => wallInput.click();
['#uploadWallpaperBtn', '#lockUploadBtn', '#wallUploadTile'].forEach(sel => $(sel).addEventListener('click', openFilePicker));
wallInput.addEventListener('change', async () => {
  await handleWallpaperFile(wallInput.files && wallInput.files[0]);
  wallInput.value = '';   // lets the same file be picked again
});
$('#wallRemove').addEventListener('click', () => {
  const wasCustom = document.body.dataset.wallpaper === 'custom';
  clearCustomImage();
  if (wasCustom) applyWallpaper('onyx', { silent: true });
  showToast('Your photo was removed');
});

// Restore the saved choice.
(() => {
  const savedImg = store.get(CUSTOM_KEY);
  if (savedImg && savedImg.startsWith('data:image/')) setCustomImage(savedImg);
  applyWallpaper(store.get(WALL_KEY) || 'onyx', { silent: true });
})();

/* ---- wallpaper browser sheet ---- */
const wallBackdrop = $('#wallBackdrop');
let wallReturnFocus = null;
function openWallSheet() {
  wallReturnFocus = document.activeElement;
  wallBackdrop.hidden = false;
  $('#wallClose').focus();
}
function closeWallSheet() {
  if (wallBackdrop.hidden) return;
  wallBackdrop.hidden = true;
  if (wallReturnFocus && document.contains(wallReturnFocus)) wallReturnFocus.focus();
}
$('#browseWallpaperBtn').addEventListener('click', openWallSheet);
$('#lockBrowseBtn').addEventListener('click', openWallSheet);
$('#wallClose').addEventListener('click', closeWallSheet);
wallBackdrop.addEventListener('pointerdown', e => { if (e.target === wallBackdrop) closeWallSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWallSheet(); });
// keep keyboard focus inside the open sheet
wallBackdrop.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const items = $$('button:not([hidden])', wallBackdrop);
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* =====================================================================
   LOCK SCREEN  (live clock, date, swipe / click / key to unlock)
   ===================================================================== */
const lockScreen = $('#lockScreen');
const lockHM = $('#lockHM'), lockPeriod = $('#lockPeriod'), lockSec = $('#lockSec'), lockDate = $('#lockDate');
const desktopParts = $$('.topbar, .desktop, .window-layer, .dock');
const hmFormat = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat([], { weekday: 'long', day: 'numeric', month: 'long' });
let clockTimer = null, locked = true, lockSwitchTimer = null;

function setText(el, text) { if (el.textContent !== text) el.textContent = text; }
function updateLockClock() {
  const now = new Date();
  let hm = '', period = '';
  hmFormat.formatToParts(now).forEach(p => {
    if (p.type === 'dayPeriod') period = p.value.toUpperCase();
    else if (['hour', 'minute', 'literal'].includes(p.type)) hm += p.value;
  });
  setText(lockHM, hm.trim());
  setText(lockPeriod, period);
  setText(lockSec, String(now.getSeconds()).padStart(2, '0'));
  setText(lockDate, dateFormat.format(now));
}
function startLockClock() {
  stopLockClock();
  const tick = () => { updateLockClock(); clockTimer = setTimeout(tick, 1000 - (Date.now() % 1000) + 8); };
  tick();
}
function stopLockClock() { clearTimeout(clockTimer); clockTimer = null; }
document.addEventListener('visibilitychange', () => { if (locked && !document.hidden) startLockClock(); });

function setDesktopInert(state) { desktopParts.forEach(el => { el.inert = state; }); }

function unlock() {
  if (!locked) return;
  locked = false;
  clearTimeout(lockSwitchTimer);
  lockScreen.style.transition = '';
  lockScreen.style.transform = '';
  lockScreen.style.opacity = '';
  lockScreen.classList.add('is-unlocking');
  document.body.classList.remove('is-locked');   // desktop panels animate in
  setDesktopInert(false);
  lockSwitchTimer = setTimeout(() => { lockScreen.hidden = true; stopLockClock(); }, 900);
}
function lockNow() {
  if (locked) return;
  locked = true;
  closeWallSheet();
  $$('.app-window').forEach(win => { win.hidden = true; });
  setDesktopInert(true);
  startLockClock();
  lockScreen.hidden = false;
  lockScreen.classList.add('is-unlocking');
  void lockScreen.offsetWidth;                    // restart transition from the "up" position
  lockScreen.classList.remove('is-unlocking');
  clearTimeout(lockSwitchTimer);
  lockSwitchTimer = setTimeout(() => { window.scrollTo(0, 0); document.body.classList.add('is-locked'); }, 900);
  lockScreen.focus({ preventScroll: true });
}

// Swipe up (touch or mouse drag) or tap/click to unlock.
(() => {
  let startY = null, dy = 0, dragging = false;
  const SWIPE_DISTANCE = 110;
  const snapBack = () => {
    lockScreen.style.transition = 'transform .35s cubic-bezier(.2,.9,.3,1), opacity .35s';
    lockScreen.style.transform = '';
    lockScreen.style.opacity = '';
  };
  lockScreen.addEventListener('pointerdown', e => {
    if (!locked || e.button > 0 || e.target.closest('.lock-tool')) return;
    startY = e.clientY; dy = 0; dragging = false;
    lockScreen.style.transition = 'none';
  });
  window.addEventListener('pointermove', e => {
    if (startY === null) return;
    dy = startY - e.clientY;
    if (dy > 8) dragging = true;
    if (dragging) {
      const up = Math.max(0, dy);
      lockScreen.style.transform = `translateY(${-up}px)`;
      lockScreen.style.opacity = String(Math.max(0.2, 1 - up / (window.innerHeight * 0.9)));
    }
  });
  const finish = e => {
    if (startY === null) return;
    const tap = !dragging && Math.abs(dy) < 8;
    const swipe = dy > SWIPE_DISTANCE;
    startY = null;
    if (e.type === 'pointercancel') { snapBack(); return; }
    if (swipe || tap) unlock(); else snapBack();
  };
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
})();
$('#lockHint').addEventListener('click', unlock);
document.addEventListener('keydown', e => {
  if (!locked || !wallBackdrop.hidden) return;
  if (!['Enter', ' ', 'ArrowUp'].includes(e.key)) return;
  if (e.target.closest('.lock-tool')) return;      // let the corner buttons keep their own behaviour
  e.preventDefault();
  unlock();
});
lockScreen.addEventListener('wheel', e => { if (e.deltaY > 30) unlock(); }, { passive: true });
$('#lockNow').addEventListener('click', lockNow);

// Initial state: portfolio is locked on first open.
setDesktopInert(true);
startLockClock();
lockScreen.focus({ preventScroll: true });


// Esc closes the open window (the wallpaper sheet, if open, closes first).
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || locked || !wallBackdrop.hidden) return;
  $$('.app-window').forEach(win => { win.hidden = true; });
});


/* Single-track music player. Add a licensed MP3 at assets/portfolio-track.mp3. */
(() => {
  const audio = $('#portfolioAudio'), panel = $('#musicPanel'), toggle = $('#musicTogglePanel');
  const play = $('#musicPlayPause'), progress = $('#musicProgress');
  if (!audio || !panel || !toggle || !play || !progress) return;
  const playLabel = $('#musicPlayLabel'), playIcon = $('#musicPlayIcon');
  const elapsed = $('#musicElapsed'), duration = $('#musicDuration'), hint = $('#musicHint');
  let missingTrack = false;
  const formatTime = value => {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const n = Math.floor(value);
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  };
  const updatePlayUI = playing => {
    play.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    play.title = playing ? 'Pause' : 'Play'; playLabel.textContent = playing ? 'Pause' : 'Play';
    playIcon.innerHTML = playing ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z" />' : '<path d="M8 5v14l11-7z" />';
    $('#musicWidget').classList.toggle('is-playing', playing);
  };
  const closePanel = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  $('#musicClose').addEventListener('click', closePanel);
  play.addEventListener('click', async () => {
    if (missingTrack || audio.error) {
      hint.innerHTML = 'Music file not found. Add your MP3 as <code>assets/portfolio-track.mp3</code>, then refresh.';
      showToast('Add your music file to assets/portfolio-track.mp3'); return;
    }
    if (audio.paused) {
      try { await audio.play(); hint.textContent = 'Enjoy the music.'; }
      catch { hint.innerHTML = 'Could not play the track. Check that <code>assets/portfolio-track.mp3</code> exists and is valid.'; showToast('Music could not start. Check the MP3 file.'); }
    } else audio.pause();
  });
  audio.addEventListener('play', () => updatePlayUI(true));
  audio.addEventListener('pause', () => updatePlayUI(false));
  audio.addEventListener('ended', () => { updatePlayUI(false); audio.currentTime = 0; });
  audio.addEventListener('loadedmetadata', () => { duration.textContent = formatTime(audio.duration); progress.max = String(audio.duration || 100); hint.textContent = 'Enjoy the music.'; });
  audio.addEventListener('timeupdate', () => {
    if (!progress.matches(':active')) progress.value = String(audio.currentTime || 0);
    elapsed.textContent = formatTime(audio.currentTime); duration.textContent = formatTime(audio.duration);
  });
  progress.addEventListener('input', () => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number(progress.value); elapsed.textContent = formatTime(audio.currentTime); } });
  audio.addEventListener('error', () => { missingTrack = true; updatePlayUI(false); hint.innerHTML = 'No track found yet. Place one MP3 file at <code>assets/portfolio-track.mp3</code>.'; });
  updatePlayUI(false);
})();


/* =====================================================================
   PROJECTS  -  edit ONLY this list. Each object = one project card.
   live  : your deployed link (leave '' to show "Coming soon")
   code  : GitHub repo link (optional, leave '')
   image : screenshot in assets/projects/ e.g. 'assets/projects/luxe.jpg' (optional)
   ===================================================================== */
const PROJECTS = [
  { title: 'Luxe Store',       type: 'E-commerce',  desc: 'Online store with customer login, categories, wishlist and order flow.', tags: ['Laravel', 'PHP', 'MySQL'], live: '', code: '', image: '' },
  { title: 'calculator',      type: 'Web App',     desc: 'Short one-line description of what this project does.',                  tags: ['HTML', 'CSS', 'JS'],        live: '', code: '', image: '' },
  { title: 'Project Three',    type: 'Landing Page',desc: 'Short one-line description of what this project does.',                  tags: ['HTML', 'CSS', 'JS'],       live: '', code: '', image: '' },
  { title: 'Project Four',     type: 'Web App',     desc: 'Short one-line description of what this project does.',                  tags: ['PHP', 'MySQL'],            live: '', code: '', image: '' },
  { title: 'Project Five',     type: 'Landing Page',desc: 'Short one-line description of what this project does.',                  tags: ['WordPress', 'Elementor'],  live: '', code: '', image: '' },
  { title: 'Project Six',      type: 'Practice',    desc: 'Short one-line description of what this project does.',                  tags: ['JavaScript'],              live: '', code: '', image: '' },
  { title: 'Project Seven',    type: 'Practice',    desc: 'Short one-line description of what this project does.',                  tags: ['HTML', 'CSS'],             live: '', code: '', image: '' }
];

(() => {
  const grid = $('#projGrid'), filters = $('#projFilters'), count = $('#projCount');
  if (!grid) return;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
  const hues = [215, 265, 25, 160, 340, 190, 45];
  let active = 'All';

  function card(p, i) {
    const art = el('div', 'proj-art');
    art.style.setProperty('--h', hues[i % hues.length]);
    if (p.image) { const img = el('img'); img.src = p.image; img.alt = `${p.title} screenshot`; img.loading = 'lazy'; img.onerror = () => img.remove(); art.append(img); }
    art.append(el('span', 'proj-num', String(i + 1).padStart(2, '0')), el('span', 'proj-initial', p.title.trim().charAt(0).toUpperCase()));
    const body = el('div', 'proj-body');
    body.append(el('span', 'project-type', p.type.toUpperCase()), el('h3', '', p.title), el('p', '', p.desc));
    const tags = el('div', 'tags'); p.tags.forEach(t => tags.append(el('span', '', t)));
    const actions = el('div', 'proj-actions');
    const live = safeUrl(p.live);
    if (live) { const a = el('a', 'proj-live', 'Live demo ↗'); a.href = live; a.target = '_blank'; a.rel = 'noopener noreferrer'; actions.append(a); }
    else actions.append(el('span', 'proj-live is-soon', 'Coming soon'));
    const code = safeUrl(p.code);
    if (code) { const a = el('a', 'proj-code', 'Code'); a.href = code; a.target = '_blank'; a.rel = 'noopener noreferrer'; actions.append(a); }
    body.append(tags, actions);
    const art2 = el('article', 'proj-card'); art2.append(art, body);
    return art2;
  }
  function render() {
    grid.replaceChildren();
    const list = PROJECTS.map((p, i) => ({ p, i })).filter(({ p }) => active === 'All' || p.type === active);
    list.forEach(({ p, i }) => grid.append(card(p, i)));
    count.textContent = `${list.length} project${list.length === 1 ? '' : 's'}`;
    $$('.proj-chip', filters).forEach(b => b.classList.toggle('active', b.dataset.f === active));
  }
  ['All', ...new Set(PROJECTS.map(p => p.type))].forEach(f => {
    const b = el('button', 'proj-chip', f); b.type = 'button'; b.dataset.f = f;
    b.addEventListener('click', () => { active = f; render(); });
    filters.append(b);
  });
  render();
})();
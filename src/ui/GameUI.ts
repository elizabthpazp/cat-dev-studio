import { COFFEE_COOLDOWN, COFFEE_COST, DEADLINE, MAX_BUGS, ROLES, Role, START_TIME, SMASH_COST, State, Task, activeTask, clock, completedCount } from '../game/store';
import { CHALLENGES, shuffledOptions } from '../game/challenges';
import { sfx } from './sfx';
import { catPortrait, icon } from './icons';

export interface UIHandlers {
  newGame(): void; continueGame(): void; beginShift(): void;
  select(role: Role): void; assign(): void; answer(taskId: string, ok: boolean): void;
  coffee(): void; overview(): void; pause(): void; resume(): void; restart(): void; quit(): void;
}
export interface TagInfo { role: Role; x: number; y: number; visible: boolean; }

const PAW = `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="42" rx="14" ry="12"/><ellipse cx="14" cy="27" rx="6" ry="8"/><ellipse cx="25" cy="16" rx="6" ry="8"/><ellipse cx="39" cy="16" rx="6" ry="8"/><ellipse cx="50" cy="27" rx="6" ry="8"/></svg>`;
/** Colores y nombres fijos de cada miembro (los mismos que en el estado inicial). */
const COLOR: Record<Role, string> = { junior: '#e8a35b', senior: '#9a6b54', pm: '#6f8da8', qa: '#76a77b' };
const ROLE_NAME: Record<Role, string> = { pm: 'PROJECT MANAGER', junior: 'DEV JUNIOR', senior: 'DEV SENIOR', qa: 'QA ENGINEER' };
const TIPS = [
  'Los gatos cansados programan más lento: un café a tiempo vale oro.',
  'Una mala decisión deja escapar un bug. Con cinco bugs, producción arde.',
  'El reloj no perdona: termina el despliegue antes de las 18:00.',
  'Haz clic en el gato con «!» para recibir su encargo.',
  'Pulsa H durante la partida para ver todos los controles.',
  '¿Un bug suelto por la oficina? Haz clic en él y cae el martillo.'
];
const TOAST_ICON: Record<string, string> = { '✓': 'check', '🐞': 'bug', '☕': 'coffee', '🔨': 'hammer', '🔇': 'sound', '🔊': 'sound', '⚠': 'bug' };
const STATUS_LABEL = (t: Task, s: State) => t.status === 'completed' ? 'Hecho' : t.status === 'working' ? `${Math.round(t.progress)}%` : activeTask(s) === t ? 'Listo' : '';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const keycap = (k: string) => `<kbd class="key">${k}</kbd>`;
const portrait = (r: Role) => `<span class="portrait-wrap" style="--c:${COLOR[r]}">${catPortrait(r, COLOR[r])}</span>`;

export class GameUI {
  modalOpen = false;
  private splash = el('div', 'screen splash');
  private loading = el('div', 'screen loading');
  private title = el('div', 'screen title');
  private hud = el('div', 'hud');
  private tagLayer = el('div', 'tags');
  private modalLayer = el('div', 'modal-layer');
  private toasts = el('div', 'toasts');
  private refs: Record<string, HTMLElement> = {};
  private tagEls = new Map<Role, HTMLElement>();
  private ready = false; private splashDone = false; private hasSave = false;
  private titleStage: 'press' | 'menu' = 'press';
  private closeCurrent?: () => void;
  /** Atajos de teclado del pergamino abierto (A/B/C para responder). */
  private modalKeys?: (e: KeyboardEvent) => void;
  private tipTimer?: number;

  constructor(private root: HTMLDivElement, private h: UIHandlers) {
    root.append(this.splash, this.loading, this.title, this.tagLayer, this.hud, this.modalLayer, this.toasts);
    this.buildSplash(); this.buildLoading(); this.buildTitle(); this.buildHud(); this.buildTags();
    root.addEventListener('mouseover', e => { if ((e.target as HTMLElement).closest('button:not(:disabled)')) sfx.hover(); });
    window.addEventListener('keydown', e => { if (this.modalOpen && this.modalKeys) { this.modalKeys(e); if (e.defaultPrevented) e.stopImmediatePropagation(); } });
  }

  // ───────────────────────── Presentación ─────────────────────────
  private buildSplash() {
    this.splash.innerHTML = `<div class="studio"><div class="studio-paw">${PAW}</div><div class="studio-name">MICHIS DEVS</div><div class="studio-sub">presenta</div></div>`;
  }
  private buildLoading() {
    this.loading.innerHTML = `<div class="loading-box">
      <div class="mini-logo"><span>CAT DEV</span><b>STUDIO</b></div>
      <div class="load-cats">${ROLES.map(r => portrait(r)).join('')}</div>
      <div class="load-bar"><i></i></div>
      <div class="load-row"><span class="load-label">Preparando la oficina…</span><span class="load-pct">0%</span></div>
      <div class="tip"><b>${icon('help')} CONSEJO</b><span></span></div></div>`;
  }
  private buildTitle() {
    this.title.innerHTML = `<div class="title-vignette"></div><div class="title-glow"></div>
      <div class="logo-wrap"><div class="logo-big"><span class="l1">CAT DEV</span><span class="l2">STUDIO</span></div><div class="ribbon"><span>THE BUG HUNTERS</span></div></div>
      <div class="press"><span>PULSA CUALQUIER TECLA</span></div>
      <nav class="menu"></nav>
      <div class="title-foot"><span>v0.4 · Michis Devs</span><span class="menu-hint">${keycap('↑')}${keycap('↓')} elegir · ${keycap('Enter')} aceptar</span><span>${keycap('M')} sonido</span></div>`;
    const advance = () => { if (this.title.classList.contains('is-on') && this.titleStage === 'press' && !this.modalOpen) { sfx.click(); this.showMenu(); } };
    window.addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M' || this.titleStage !== 'press') return; if (this.title.classList.contains('is-on') && !this.modalOpen) e.preventDefault(); advance(); });
    this.title.addEventListener('pointerdown', e => { if (!(e.target as HTMLElement).closest('nav')) advance(); });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.title.classList.contains('is-on')) { this.closeModal(); return; }
      if (!this.title.classList.contains('is-on') || this.titleStage !== 'menu' || this.modalOpen) return;
      const items = [...this.title.querySelectorAll<HTMLButtonElement>('.menu button')]; const i = items.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); items[(i + 1) % items.length].focus(); sfx.hover(); }
      if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); sfx.hover(); }
    });
  }

  showLoading() {
    this.show(this.splash);
    let i = 0; const tip = this.loading.querySelector('.tip span')!; tip.textContent = TIPS[0];
    this.tipTimer = window.setInterval(() => { tip.textContent = TIPS[++i % TIPS.length]; }, 3200);
    window.setTimeout(() => { this.splashDone = true; if (this.ready) this.showTitle(this.hasSave); else this.show(this.loading); }, 2600);
  }
  setLoadProgress(p: number) {
    const pct = Math.round(p * 100); (this.loading.querySelector('.load-bar i') as HTMLElement).style.width = pct + '%';
    this.loading.querySelector('.load-pct')!.textContent = pct + '%';
    this.loading.querySelector('.load-label')!.textContent = pct < 40 ? 'Despertando a los gatos…' : pct < 80 ? 'Colocando teclados y tazas…' : 'Calentando el café…';
    this.loading.querySelectorAll('.load-cats .portrait-wrap').forEach((c, i) => c.classList.toggle('awake', p >= (i + 1) / 4 - .01));
  }
  loadingDone(hasSave: boolean) { this.ready = true; this.hasSave = hasSave; this.setLoadProgress(1); if (this.splashDone) window.setTimeout(() => this.showTitle(hasSave), 350); }

  showTitle(hasSave: boolean) {
    window.clearInterval(this.tipTimer); this.hasSave = hasSave; this.closeModal(true); this.hud.classList.remove('is-on'); this.tagLayer.classList.remove('is-on');
    this.titleStage = 'press'; this.title.classList.remove('menu-on'); this.show(this.title);
  }
  private showMenu() {
    this.titleStage = 'menu'; this.title.classList.add('menu-on');
    const menu = this.title.querySelector('.menu')!; menu.innerHTML = '';
    const item = (label: string, ico: string, fn: () => void, primary = false) => {
      const b = el('button', 'btn ' + (primary ? 'primary' : 'ghost'), `${icon(ico)}<span>${label}</span>`);
      b.addEventListener('click', () => { sfx.click(); fn(); }); menu.append(b); return b;
    };
    const first = this.hasSave ? item('Continuar', 'play', () => { this.hideScreens(); this.h.continueGame(); }, true) : undefined;
    const ng = item('Nueva partida', this.hasSave ? 'restart' : 'play', () => this.h.newGame(), !this.hasSave);
    item('Cómo jugar', 'help', () => this.openHelp());
    (first ?? ng).focus();
  }

  /** Pergamino de historia antes de la primera jornada. */
  showIntro() {
    this.openScroll(`<div class="kicker">LUNES · 08:40</div><h2>El Encargo</h2><div class="ornament">❦</div>
      <p class="dropcap">El cliente más impaciente del mundo quiere <b>Meowboard</b>, un tablero de tareas, en producción <b>antes de las 18:00</b>.</p>
      <p>Guía a tu equipo de gatos por cinco hitos. En cada uno tendrás que tomar una decisión: acierta y el trabajo avanza; falla y se colará un bug.</p>
      <div class="intro-team">${ROLES.map(r => `<div>${portrait(r)}<small>${ROLE_NAME[r]}</small></div>`).join('')}</div>
      <ul class="rules"><li><b>5 bugs</b> y producción arde. Cada bug aparece caminando por la oficina: <b>aplástalo con el martillo</b> haciendo clic.</li><li>Sin <b>moral</b>, el equipo se rinde.</li><li>Los gatos cansados trabajan lento: dales <b>café</b>.</li></ul>
      <div class="scroll-actions"><button class="btn primary" data-act="accept">${icon('check')}<span>Aceptar el encargo</span></button></div>`,
    { onAction: act => { if (act === 'accept') { sfx.click(); this.closeModal(true); this.hideScreens(); this.h.beginShift(); } }, closable: false });
    window.setTimeout(() => this.modalLayer.querySelector<HTMLButtonElement>('[data-act="accept"]')?.focus(), 400);
  }

  // ───────────────────────── HUD ─────────────────────────
  private buildHud() {
    this.hud.innerHTML = `
      <div class="hud-top">
        <div class="clock panel"><div class="clock-ico">${icon('clock')}</div><div class="clock-main"><div class="clock-day">LUNES · SPRINT 1</div><div class="clock-time">08:40</div></div>
          <div class="clock-foot"><div class="clock-bar"><i></i></div><span class="clock-end">Entrega 18:00</span></div></div>
        <div class="resources panel">
          <div class="res morale" title="Moral del equipo: si llega a 0, el equipo se rinde"><span class="res-ico">${icon('heart')}</span><div class="res-body"><small>MORAL</small><b data-r="morale">72%</b><div class="res-bar"><i data-r="morale-bar"></i></div></div></div>
          <div class="res budget" title="Presupuesto: café y martillo"><span class="res-ico">${icon('coin')}</span><div class="res-body"><small>PRESUPUESTO</small><b data-r="budget">100</b></div></div>
          <div class="res bugs" title="Bugs sueltos: con ${MAX_BUGS}, producción cae"><span class="res-ico">${icon('bug')}</span><div class="res-body"><small>BUGS</small><b class="bugs-n" data-r="bugs">0/${MAX_BUGS}</b><div class="pips" data-r="pips">${'<i></i>'.repeat(MAX_BUGS)}</div></div></div>
        </div>
        <div class="top-actions"><button class="icon-btn" data-act="help" title="Ayuda (H)">${icon('help')}</button><button class="icon-btn" data-act="pause" title="Pausa (Esc)">${icon('pause')}</button></div>
      </div>
      <aside class="quest panel"><div class="panel-head">${icon('scroll')}<span>MISIÓN</span><em>Meowboard</em><b class="quest-count" data-r="quest-count">0/5</b></div><ol class="quest-list"></ol>
        <div class="objective"><small>OBJETIVO ACTUAL</small><b data-r="objective"></b><div class="obj-bar"><i></i></div><button class="btn primary small" data-act="assign">${icon('scroll')}<span>Ver encargo</span>${keycap('Espacio')}</button></div></aside>
      <aside class="party"><div class="party-head">${icon('team')} EQUIPO</div></aside>
      <div class="radio panel"><div class="radio-head"><span class="live"></span>RADIO OFICINA</div><div class="radio-lines"></div></div>
      <div class="actionbar panel">
        <div class="ab-cat"><span class="ab-face"></span><div><b data-r="sel-name"></b><small data-r="sel-state"></small></div></div>
        <button class="action" data-act="assign">${icon('scroll')}<span>Encargo</span>${keycap('Esp')}</button>
        <button class="action" data-act="coffee">${icon('coffee')}<span>Café <em>−${COFFEE_COST}</em></span>${keycap('C')}<i class="cool"></i><b class="cool-t"></b></button>
        <button class="action" data-act="overview">${icon('eye')}<span>Vista</span>${keycap('V')}</button>
      </div>`;
    const list = this.hud.querySelector('.quest-list')!;
    ['spec', 'feature', 'review', 'qa', 'deploy'].forEach((id, i) => {
      const li = el('li', 'q', `<span class="q-ico"><span class="q-n">${i + 1}</span></span><div class="q-main"><span class="q-name"></span><small class="q-who"></small></div><span class="q-state"></span>`);
      li.dataset.task = id; list.append(li); this.refs['q-' + id] = li;
    });
    const party = this.hud.querySelector('.party')!;
    ROLES.forEach((r, i) => {
      const card = el('button', 'member panel', `<span class="m-key">${i + 1}</span>${portrait(r)}<div class="m-info"><b class="m-name"></b><small class="m-state"></small>
        <div class="stat energy" title="Energía: más alta, trabaja más rápido">${icon('bolt')}<div class="bar"><i></i></div><span class="v"></span></div>
        <div class="stat stress" title="Estrés: por encima de 80 baja la moral">${icon('flame')}<div class="bar"><i></i></div><span class="v"></span></div></div><span class="m-alert">!</span>`);
      card.style.setProperty('--c', COLOR[r]);
      card.addEventListener('click', () => { this.h.select(r); card.blur(); }); party.append(card); this.refs['m-' + r] = card;
    });
    this.hud.querySelectorAll<HTMLElement>('[data-r]').forEach(b => { this.refs[b.dataset.r!] = b; });
    this.hud.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); const act = btn?.dataset.act; if (!act) return;
      btn!.blur(); // que Espacio/Enter no vuelvan a pulsar este botón
      if (act === 'assign') this.h.assign(); else if (act === 'coffee') this.h.coffee(); else if (act === 'overview') { sfx.click(); this.h.overview(); }
      else if (act === 'help') this.toggleHelp(); else if (act === 'pause') this.h.pause();
    });
  }

  showHud(s: State) { this.hideScreens(); this.hud.classList.add('is-on'); this.tagLayer.classList.add('is-on'); this.update(s); }

  update(s: State) {
    const r = this.refs; const task = activeTask(s);
    r['clock-time'] ??= this.hud.querySelector('.clock-time')!; r['clock-time'].textContent = clock(s.time);
    (this.hud.querySelector('.clock-bar i') as HTMLElement).style.width = `${Math.min(100, (s.time - START_TIME) / (DEADLINE - START_TIME) * 100)}%`;
    this.hud.querySelector('.clock')!.classList.toggle('late', DEADLINE - s.time < 90);
    r['morale'].textContent = `${Math.round(s.morale)}%`; r['morale-bar'].style.width = `${s.morale}%`;
    r['budget'].textContent = String(Math.round(s.budget));
    r['bugs'].textContent = `${s.bugs}/${MAX_BUGS}`;
    r['pips'].querySelectorAll('i').forEach((p, i) => p.classList.toggle('on', i < s.bugs));
    r['morale'].closest('.res')!.classList.toggle('warn', s.morale < 30); r['pips'].closest('.res')!.classList.toggle('warn', s.bugs >= MAX_BUGS - 2);
    r['budget'].closest('.res')!.classList.toggle('warn', s.budget < SMASH_COST);
    r['quest-count'].textContent = `${completedCount(s)}/${s.tasks.length}`;
    for (const t of s.tasks) {
      const li = r['q-' + t.id]; li.className = 'q ' + (t.status === 'completed' ? 'done' : task === t ? (t.status === 'working' ? 'current working' : 'current') : 'locked');
      li.style.setProperty('--c', COLOR[t.role]);
      li.querySelector('.q-name')!.textContent = t.name; li.querySelector('.q-who')!.textContent = s.cats[t.role].name; li.querySelector('.q-state')!.textContent = STATUS_LABEL(t, s);
      li.querySelector('.q-ico')!.innerHTML = t.status === 'completed' ? icon('check') : task === t ? `<span class="q-n">${s.tasks.indexOf(t) + 1}</span>` : icon('lock');
    }
    const obj = task ? (task.status === 'working' ? `${s.cats[task.role].name} trabaja: ${task.name}` : `Habla con ${s.cats[task.role].name}: ${task.name}`) : '¡Todo entregado!';
    r['objective'].textContent = obj; (this.hud.querySelector('.obj-bar i') as HTMLElement).style.width = `${task?.status === 'working' ? task.progress : 0}%`;
    this.hud.querySelector('.objective')!.classList.toggle('ready', task?.status === 'pending');
    this.hud.querySelectorAll<HTMLButtonElement>('[data-act="assign"]').forEach(b => { b.disabled = !task || task.status === 'working'; });
    for (const id of ROLES) {
      const c = s.cats[id]; const card = r['m-' + id];
      card.classList.toggle('selected', s.selected === id); card.classList.toggle('has-task', task?.role === id && task.status === 'pending');
      card.querySelector('.m-name')!.textContent = c.name; card.querySelector('.m-state')!.textContent = c.state;
      (card.querySelector('.energy i') as HTMLElement).style.width = `${c.energy}%`; (card.querySelector('.stress i') as HTMLElement).style.width = `${c.stress}%`;
      card.querySelector('.energy .v')!.textContent = String(Math.round(c.energy)); card.querySelector('.stress .v')!.textContent = String(Math.round(c.stress));
      card.classList.toggle('tired', c.energy < 30); card.classList.toggle('stressed', c.stress > 70);
      const tag = this.tagEls.get(id)!; tag.classList.toggle('alert', task?.role === id && task.status === 'pending'); tag.classList.toggle('selected', s.selected === id);
      const working = task?.role === id && task.status === 'working'; tag.classList.toggle('working', working);
      (tag.querySelector('.tag-bar i') as HTMLElement).style.width = `${working ? task!.progress : 0}%`;
      tag.querySelector('.tag-pct')!.textContent = working ? `${Math.round(task!.progress)}%` : '';
    }
    const sel = s.cats[s.selected]; r['sel-name'].textContent = sel.name; r['sel-state'].textContent = `${sel.title} · ${sel.state}`;
    const face = this.hud.querySelector('.ab-face') as HTMLElement; if (face.dataset.role !== s.selected) { face.dataset.role = s.selected; face.innerHTML = portrait(s.selected); }
    const coffee = this.hud.querySelector<HTMLButtonElement>('[data-act="coffee"]')!; coffee.disabled = sel.coffeeCooldown > 0 || s.budget < COFFEE_COST;
    (coffee.querySelector('.cool') as HTMLElement).style.height = `${Math.min(100, sel.coffeeCooldown / COFFEE_COOLDOWN * 100)}%`;
    coffee.querySelector('.cool-t')!.textContent = sel.coffeeCooldown > 0 ? `${Math.ceil(sel.coffeeCooldown)}s` : '';
    const lines = s.log.slice(-3).reverse().map((l, i) => { const [time, ...rest] = l.split(' · '); return `<p class="${i ? 'old' : 'new'}"><time>${time}</time><span>${rest.join(' · ')}</span></p>`; }).join('');
    const radio = this.hud.querySelector<HTMLElement>('.radio-lines')!; if (radio.dataset.v !== lines) { radio.dataset.v = lines; radio.innerHTML = lines; }
  }

  // ───────────────────────── Etiquetas sobre los gatos ─────────────────────────
  private buildTags() {
    ROLES.forEach(r => {
      const t = el('div', 'tag', `<div class="tag-in"><div class="tag-alert">!</div><div class="tag-bar"><i></i><span class="tag-pct"></span></div><div class="tag-pill"><span class="dot"></span>${['Michi Jr.', 'Gatardo', 'Michi PM', 'Doña QA'][ROLES.indexOf(r)]}</div><div class="tag-pin"></div></div>`);
      t.style.setProperty('--c', COLOR[r]); this.tagLayer.append(t); this.tagEls.set(r, t);
    });
  }
  positionTags(tags: TagInfo[]) {
    for (const t of tags) { const e = this.tagEls.get(t.role)!; e.style.transform = `translate3d(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px, 0)`; e.style.visibility = t.visible ? 'visible' : 'hidden'; }
  }

  // ───────────────────────── Pergaminos ─────────────────────────
  private openScroll(inner: string, o: { onAction?: (act: string, e: HTMLElement) => void; closable?: boolean; wide?: boolean } = {}) {
    this.closeModal(true);
    const shade = el('div', 'shade scroll-shade');
    const scroll = el('div', 'scroll' + (o.wide ? ' wide' : ''), `<div class="rod"></div><div class="scroll-body"><div class="paper"><div class="paper-inner">${inner}</div></div></div><div class="rod"></div><div class="seal">${PAW}</div>`);
    if (o.closable !== false) { const x = el('button', 'scroll-close', icon('close')); x.title = 'Cerrar (Esc)'; x.addEventListener('click', () => { sfx.click(); this.closeModal(); }); scroll.append(x); }
    (scroll.querySelector('.paper') as HTMLElement).style.clipPath = this.tornEdges();
    shade.append(scroll); this.modalLayer.append(shade); this.modalOpen = true; sfx.open();
    // Clic fuera del pergamino = cerrar (si se puede cerrar).
    shade.addEventListener('pointerdown', e => { if (e.target === shade && this.closeCurrent) { sfx.click(); this.closeModal(); } });
    requestAnimationFrame(() => requestAnimationFrame(() => scroll.classList.add('open')));
    scroll.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (b && o.onAction) o.onAction(b.dataset.act!, b); });
    this.closeCurrent = o.closable === false ? undefined : () => this.closeModal();
    return scroll;
  }
  /** Bordes laterales irregulares, como papel viejo. */
  private tornEdges() {
    const pts: string[] = []; const n = 22;
    for (let i = 0; i <= n; i++) pts.push(`${(Math.random() * 7).toFixed(1)}px ${(i / n * 100).toFixed(1)}%`);
    for (let i = n; i >= 0; i--) pts.push(`calc(100% - ${(Math.random() * 7).toFixed(1)}px) ${(i / n * 100).toFixed(1)}%`);
    return `polygon(${pts.join(',')})`;
  }
  closeModal(force = false) {
    if (!this.modalOpen && !force) return;
    const shade = this.modalLayer.querySelector('.scroll-shade:not(.leaving)'); if (!shade) { this.modalOpen = false; this.modalKeys = undefined; return; }
    if (!force && !this.closeCurrent) return;
    const scroll = shade.querySelector('.scroll'); scroll?.classList.remove('open'); shade.classList.add('leaving');
    if (force) shade.remove(); else window.setTimeout(() => shade.remove(), 320);
    this.modalOpen = false; this.closeCurrent = undefined; this.modalKeys = undefined;
  }

  openChallenge(task: Task) {
    const c = CHALLENGES[task.id]; const options = shuffledOptions(c);
    const html = `<div class="kicker">ENCARGO DEL ESTUDIO · ${ROLE_NAME[task.role]}</div><h2>${task.name}</h2><div class="ornament">❦</div>
      <div class="brief">${portrait(task.role)}<p>${c.question}</p></div><pre class="ink">${c.code.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
      <div class="options">${options.map((op, i) => `<button class="option" data-act="opt" data-i="${i}"><span class="letter">${'ABC'[i]}</span><span class="op-text">${op.text}</span></button>`).join('')}</div>
      <div class="verdict"></div>
      <div class="cost">Pulsa ${keycap('A')} ${keycap('B')} ${keycap('C')} o haz clic · Si fallas: <b>+1 bug</b> · <b>−8 presupuesto</b> · <b>−8 moral</b></div>`;
    let answered = false;
    const pick = (btn: HTMLElement) => {
      if (answered) return; answered = true; const op = options[Number(btn.dataset.i)];
      scroll.querySelectorAll<HTMLButtonElement>('.option').forEach((b, i) => { b.disabled = true; if (options[i].ok) b.classList.add('right'); });
      btn.classList.add(op.ok ? 'right' : 'wrong', 'chosen');
      const v = scroll.querySelector('.verdict')!; scroll.querySelector('.cost')?.remove();
      v.innerHTML = `<div class="stamp ${op.ok ? 'ok' : 'ko'}">${op.ok ? '¡CORRECTO!' : '¡BUG!'}</div><p>${op.ok ? c.why : 'No era eso. ' + c.why}</p>
        <div class="scroll-actions">${op.ok ? `<button class="btn primary" data-act="close">${icon('play')}<span>¡A trabajar!</span></button>` : `<button class="btn ghost dark" data-act="close"><span>Cerrar</span></button><button class="btn primary" data-act="retry">${icon('restart')}<span>Intentar de nuevo</span></button>`}</div>`;
      this.closeCurrent = () => this.closeModal();
      this.modalKeys = e => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); (v.querySelector('[data-act="retry"]') ?? v.querySelector('[data-act="close"]'))?.dispatchEvent(new MouseEvent('click', { bubbles: true })); } };
      v.querySelector<HTMLButtonElement>('.btn.primary')?.focus();
      this.h.answer(task.id, op.ok);
    };
    const scroll = this.openScroll(html, {
      onAction: (act, btn) => {
        if (act === 'opt') pick(btn);
        else if (act === 'close') { sfx.click(); this.closeModal(); }
        else if (act === 'retry') { sfx.click(); this.closeModal(true); window.setTimeout(() => this.openChallenge(task), 60); }
      }
    });
    this.modalKeys = e => {
      if (e.repeat || answered) return; const i = 'abc'.indexOf(e.key.toLowerCase());
      if (i >= 0 && i < options.length) { e.preventDefault(); sfx.click(); pick(scroll.querySelectorAll<HTMLElement>('.option')[i]); }
    };
  }

  openHelp() {
    this.openScroll(`<div class="kicker">MANUAL DEL ESTUDIO</div><h2>Cómo jugar</h2><div class="ornament">❦</div>
      <ol class="steps"><li>Busca al gato con <span class="mark">!</span> encima: tiene el siguiente encargo.</li><li>Haz clic en él (o pulsa ${keycap('Espacio')}) y elige la mejor decisión del pergamino.</li><li>Mientras trabaja, cuida su <b>energía</b> con café. Entrega los 5 hitos antes de las <b>18:00</b>.</li></ol>
      <div class="legend-grid">
        <div>${keycap('Clic')}<span>Elegir gato / abrir encargo</span></div><div>${keycap('Arrastrar')}<span>Girar la cámara</span></div>
        <div>${keycap('Rueda')}<span>Acercar / alejar</span></div><div>${keycap('1')}${keycap('2')}${keycap('3')}${keycap('4')}<span>Seleccionar gato</span></div>
        <div>${keycap('Espacio')}<span>Ver encargo actual</span></div><div>${keycap('C')}<span>Café al gato elegido</span></div>
        <div>${keycap('V')}<span>Vista general</span></div><div>${keycap('A')}${keycap('B')}${keycap('C')}<span>Responder pergamino</span></div>
        <div>${keycap('Esc')}<span>Pausa / cerrar</span></div><div>${keycap('H')}<span>Esta ayuda</span></div>
        <div>${keycap('M')}<span>Silenciar sonido</span></div><div>${keycap('Clic')}<span>Sobre un bug: aplastarlo (−${SMASH_COST})</span></div>
      </div>
      <div class="icon-legend"><div><span class="sw energy">${icon('bolt')}</span>Energía: más alta, trabaja más rápido</div><div><span class="sw stress">${icon('flame')}</span>Estrés: sobre 80 hunde la moral</div><div><span class="sw heart">${icon('heart')}</span>Moral: si llega a 0, pierdes</div><div><span class="sw bug">${icon('bug')}</span>Bugs: con ${MAX_BUGS}, pierdes</div></div>
      <div class="scroll-actions"><button class="btn primary" data-act="close">${icon('check')}<span>Entendido</span></button></div>`,
    { onAction: act => { if (act === 'close') { sfx.click(); this.closeModal(); } }, wide: true });
  }
  toggleHelp() { if (this.modalOpen) this.closeModal(); else this.openHelp(); }

  // ───────────────────────── Pausa y final ─────────────────────────
  showPause(paused: boolean) {
    this.modalLayer.querySelector('.pause')?.remove(); if (!paused) return;
    const p = el('div', 'shade pause', `<div class="menu-card panel"><div class="pause-paw">${PAW}</div><div class="panel-title big">PAUSA</div><p class="pause-sub">El reloj está detenido. Los gatos se estiran.</p>
      <button class="btn primary" data-p="resume">${icon('play')}<span>Reanudar</span></button><button class="btn ghost" data-p="help">${icon('help')}<span>Cómo jugar</span></button>
      <button class="btn ghost" data-p="restart">${icon('restart')}<span>Reiniciar sprint</span></button><button class="btn ghost" data-p="quit">${icon('home')}<span>Salir al menú</span></button></div>`);
    p.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-p]')?.dataset.p; if (!a) return; sfx.click();
      if (a === 'resume') this.h.resume(); else if (a === 'help') this.openHelp(); else if (a === 'restart') { this.showPause(false); this.h.restart(); } else if (a === 'quit') { this.showPause(false); this.h.quit(); } });
    this.modalLayer.append(p); (p.querySelector('button') as HTMLButtonElement).focus();
  }

  hideHud() { this.hud.classList.remove('is-on'); this.tagLayer.classList.remove('is-on'); }

  /** Aviso rojo a pantalla completa (alarma de producción). */
  alert(text: string) {
    this.root.querySelector('.alarm')?.remove();
    const a = el('div', 'alarm', `<div class="alarm-text">${text}</div><div class="alarm-tape"><span>${'⚠ INCIDENCIA CRÍTICA · '.repeat(12)}</span></div>`); this.root.append(a);
    window.setTimeout(() => a.classList.add('fade'), 1900); window.setTimeout(() => a.remove(), 2600);
  }

  /** Presentación del jefe final, como en los videojuegos: nombre gigante y barra de vida. */
  bossIntro(name: string, title: string) {
    this.hideBoss();
    const b = el('div', 'boss-intro', `<div class="boss-card"><small>¡HA APARECIDO EL JEFE FINAL!</small><h1>${name}</h1><p>${title}</p></div>
      <div class="boss-bar"><div class="boss-bar-name">${icon('bug')} ${name} <span>Nv. 99</span></div><div class="boss-hp"><i></i></div></div>`);
    this.root.append(b);
  }
  hideBoss() { this.root.querySelectorAll('.boss-intro, .alarm').forEach(e => e.remove()); }

  showEnd(s: State) {
    const o = s.outcome!; this.closeModal(true); this.hud.classList.remove('is-on'); this.tagLayer.classList.remove('is-on');
    this.modalLayer.querySelector('.shade.end')?.remove();
    const stars = [0, 1, 2].map(i => `<span class="star ${i < o.stars ? 'on' : ''}" style="animation-delay:${.4 + i * .25}s">${icon('star')}</span>`).join('');
    this.root.querySelector('.boss-card')?.classList.add('gone');
    const confetti = o.won ? `<div class="confetti">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 1.8).toFixed(2)}s;--t:${(2.6 + Math.random() * 2).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg;--k:${['#ffcf5a', '#5fe3a1', '#ff6b5b', '#8fd3ff', '#fff4dc'][i % 5]}"></i>`).join('')}</div>` : '';
    const stat = (ico: string, label: string, value: string) => `<div>${icon(ico)}<small>${label}</small><b>${value}</b></div>`;
    const end = el('div', 'shade end' + (o.won ? '' : ' defeat'), `${confetti}<div class="end-card ${o.won ? 'won' : 'lost'}"><div class="banner">${o.won ? '¡SPRINT COMPLETADO!' : 'DERROTA'}</div>
      ${o.won ? `<div class="stars">${stars}</div><div class="team-row">${ROLES.map(r => portrait(r)).join('')}</div>` : `<div class="defeated-by">Te ha derrotado <b>BUGZILLA</b>, el jefe final</div>`}<p class="reason">${o.reason}</p>
      <div class="stats">${stat('clock', 'HORA', clock(s.time))}${stat('check', 'HITOS', `${completedCount(s)}/${s.tasks.length}`)}${stat('bug', 'BUGS', String(s.bugs))}${stat('heart', 'MORAL', `${Math.round(s.morale)}%`)}</div>
      <div class="end-actions"><button class="btn primary" data-e="again">${icon('restart')}<span>Jugar otra vez</span></button><button class="btn ghost" data-e="menu">${icon('home')}<span>Menú principal</span></button></div></div>`);
    end.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-e]')?.dataset.e; if (!a) return; sfx.click(); end.remove(); this.hideBoss(); a === 'again' ? this.h.restart() : this.h.quit(); });
    this.modalLayer.append(end); window.setTimeout(() => end.querySelector<HTMLButtonElement>('.btn.primary')?.focus(), 500);
  }

  // ───────────────────────── Utilidades ─────────────────────────
  toast(message: string, kind: 'good' | 'bad' | 'info' = 'info') {
    // Un emoji al principio del mensaje se convierte en el icono del aviso (para no mostrar los dos).
    const lead = Object.keys(TOAST_ICON).find(k => message.startsWith(k));
    const ico = lead ? TOAST_ICON[lead] : kind === 'good' ? 'check' : kind === 'bad' ? 'bug' : 'help';
    if (lead) message = message.slice(lead.length).trimStart();
    const t = el('div', `toast ${kind}`, `<span class="toast-ico">${icon(ico)}</span><span class="toast-msg"></span>`);
    t.querySelector('.toast-msg')!.textContent = message; this.toasts.prepend(t);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild!.remove();
    window.setTimeout(() => { t.classList.add('out'); window.setTimeout(() => t.remove(), 300); }, 3400);
  }
  setMuted(muted: boolean) { this.toast(muted ? '🔇 Sonido desactivado' : '🔊 Sonido activado'); }
  private show(screen: HTMLElement) { [this.splash, this.loading, this.title].forEach(s => s.classList.toggle('is-on', s === screen)); }
  private hideScreens() { [this.splash, this.loading, this.title].forEach(s => s.classList.remove('is-on')); }
}

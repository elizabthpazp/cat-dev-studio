import { COFFEE_COST, DEADLINE, MAX_BUGS, ROLES, Role, START_TIME, State, Task, activeTask, clock, completedCount } from '../game/store';
import { CHALLENGES, shuffledOptions } from '../game/challenges';
import { sfx } from './sfx';

export interface UIHandlers {
  newGame(): void; continueGame(): void; beginShift(): void;
  select(role: Role): void; assign(): void; answer(taskId: string, ok: boolean): void;
  coffee(): void; overview(): void; pause(): void; resume(): void; restart(): void; quit(): void;
}
export interface TagInfo { role: Role; x: number; y: number; visible: boolean; }

const PAW = `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="42" rx="14" ry="12"/><ellipse cx="14" cy="27" rx="6" ry="8"/><ellipse cx="25" cy="16" rx="6" ry="8"/><ellipse cx="39" cy="16" rx="6" ry="8"/><ellipse cx="50" cy="27" rx="6" ry="8"/></svg>`;
const FACE: Record<Role, string> = { junior: '😺', senior: '😼', pm: '😸', qa: '🙀' };
const TIPS = [
  'Los gatos cansados programan más lento: un café a tiempo vale oro.',
  'Una mala decisión deja escapar un bug. Con cinco bugs, producción arde.',
  'El reloj no perdona: termina el despliegue antes de las 18:00.',
  'Haz clic en el gato con «!» para recibir su encargo.',
  'Pulsa H durante la partida para ver todos los controles.'
];
const STATUS_LABEL = (t: Task, s: State) => t.status === 'completed' ? 'Hecho' : t.status === 'working' ? `${Math.round(t.progress)}%` : activeTask(s) === t ? 'Listo' : 'Bloqueado';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const keycap = (k: string) => `<kbd class="key">${k}</kbd>`;

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
  private tipTimer?: number;

  constructor(private root: HTMLDivElement, private h: UIHandlers) {
    root.append(this.splash, this.loading, this.title, this.hud, this.tagLayer, this.modalLayer, this.toasts);
    this.buildSplash(); this.buildLoading(); this.buildTitle(); this.buildHud(); this.buildTags();
    root.addEventListener('mouseover', e => { if ((e.target as HTMLElement).closest('button:not(:disabled)')) sfx.hover(); });
  }

  // ───────────────────────── Presentación ─────────────────────────
  private buildSplash() {
    this.splash.innerHTML = `<div class="studio"><div class="studio-paw">${PAW}</div><div class="studio-name">MICHIS DEVS</div><div class="studio-sub">presenta</div></div>`;
  }
  private buildLoading() {
    this.loading.innerHTML = `<div class="loading-box"><div class="mini-logo"><span>CAT DEV</span><b>STUDIO</b></div>
      <div class="load-bar"><i></i></div><div class="load-row"><span class="load-label">Preparando la oficina…</span><span class="load-pct">0%</span></div>
      <div class="tip"><b>CONSEJO</b><span></span></div><div class="spinner">${PAW}</div></div>`;
  }
  private buildTitle() {
    this.title.innerHTML = `<div class="title-vignette"></div>
      <div class="logo-wrap"><div class="logo-big"><span class="l1">CAT DEV</span><span class="l2">STUDIO</span></div><div class="ribbon"><span>THE BUG HUNTERS</span></div></div>
      <div class="press">PULSA CUALQUIER TECLA</div>
      <nav class="menu"></nav>
      <div class="title-foot"><span>v0.3 · Michis Devs</span><span>${keycap('M')} sonido</span></div>`;
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
  }
  loadingDone(hasSave: boolean) { this.ready = true; this.hasSave = hasSave; this.setLoadProgress(1); if (this.splashDone) window.setTimeout(() => this.showTitle(hasSave), 350); }

  showTitle(hasSave: boolean) {
    window.clearInterval(this.tipTimer); this.hasSave = hasSave; this.closeModal(true); this.hud.classList.remove('is-on'); this.tagLayer.classList.remove('is-on');
    this.titleStage = 'press'; this.title.classList.remove('menu-on'); this.show(this.title);
  }
  private showMenu() {
    this.titleStage = 'menu'; this.title.classList.add('menu-on');
    const menu = this.title.querySelector('.menu')!; menu.innerHTML = '';
    const item = (label: string, fn: () => void, primary = false) => { const b = el('button', 'btn ' + (primary ? 'primary' : 'ghost'), label); b.addEventListener('click', () => { sfx.click(); fn(); }); menu.append(b); return b; };
    const first = this.hasSave ? item('Continuar', () => { this.hideScreens(); this.h.continueGame(); }, true) : undefined;
    const ng = item('Nueva partida', () => this.h.newGame(), !this.hasSave);
    item('Cómo jugar', () => this.openHelp());
    (first ?? ng).focus();
  }

  /** Pergamino de historia antes de la primera jornada. */
  showIntro() {
    this.openScroll(`<div class="kicker">LUNES · 08:40</div><h2>El Encargo</h2><div class="ornament">❦</div>
      <p class="dropcap">El cliente más impaciente del mundo quiere <b>Meowboard</b>, un tablero de tareas, en producción <b>antes de las 18:00</b>.</p>
      <p>Guía a tu equipo de gatos por cinco hitos. En cada uno tendrás que tomar una decisión: acierta y el trabajo avanza; falla y se colará un bug.</p>
      <ul class="rules"><li><b>5 bugs</b> y producción arde.</li><li>Sin <b>moral</b>, el equipo se rinde.</li><li>Los gatos cansados trabajan lento: dales <b>café</b>.</li></ul>
      <div class="scroll-actions"><button class="btn primary" data-act="accept">Aceptar el encargo</button></div>`,
    { onAction: act => { if (act === 'accept') { sfx.click(); this.closeModal(true); this.hideScreens(); this.h.beginShift(); } }, closable: false });
  }

  // ───────────────────────── HUD ─────────────────────────
  private buildHud() {
    this.hud.innerHTML = `
      <div class="hud-top">
        <div class="clock panel"><div class="clock-day">LUNES</div><div class="clock-time">08:40</div><div class="clock-bar"><i></i></div><div class="clock-end">Entrega 18:00</div></div>
        <div class="resources">
          <div class="res panel" title="Moral del equipo"><span class="res-ico">❤</span><div><small>MORAL</small><b data-r="morale">72%</b></div></div>
          <div class="res panel" title="Presupuesto"><span class="res-ico coin">●</span><div><small>PRESUPUESTO</small><b data-r="budget">100</b></div></div>
          <div class="res panel bugs" title="Bugs en producción"><span class="res-ico">🐞</span><div><small>BUGS</small><b data-r="bugs">0/5</b></div></div>
        </div>
        <button class="icon-btn" data-act="pause" title="Pausa (Esc)">❚❚</button>
      </div>
      <aside class="quest panel"><div class="panel-title">MISIÓN <span>Meowboard</span></div><ol class="quest-list"></ol>
        <div class="objective"><small>OBJETIVO ACTUAL</small><b data-r="objective"></b><div class="obj-bar"><i></i></div><button class="btn primary small" data-act="assign">Ver encargo ${keycap('ESPACIO')}</button></div></aside>
      <aside class="party"></aside>
      <div class="radio panel"><div class="radio-head"><span class="live"></span>RADIO OFICINA</div><div class="radio-lines"></div></div>
      <div class="actionbar panel">
        <div class="ab-cat"><span class="ab-face"></span><div><b data-r="sel-name"></b><small data-r="sel-state"></small></div></div>
        <button class="action" data-act="assign">${keycap('ESPACIO')}<span>Encargo</span></button>
        <button class="action" data-act="coffee">${keycap('C')}<span>Café <em>−${COFFEE_COST}</em></span><i class="cool"></i></button>
        <button class="action" data-act="overview">${keycap('V')}<span>Vista</span></button>
        <button class="action" data-act="help">${keycap('H')}<span>Ayuda</span></button>
      </div>
      <div class="legend panel"><div class="legend-row">${keycap('Clic')} Elegir gato</div><div class="legend-row">${keycap('Arrastrar')} Girar</div><div class="legend-row">${keycap('Rueda')} Zoom</div><div class="legend-row">${keycap('1')}–${keycap('4')} Equipo</div><div class="legend-row">${keycap('Esc')} Pausa</div></div>`;
    const list = this.hud.querySelector('.quest-list')!;
    ['spec', 'feature', 'review', 'qa', 'deploy'].forEach(id => { const li = el('li', 'q', `<span class="q-ico"></span><span class="q-name"></span><span class="q-state"></span>`); li.dataset.task = id; list.append(li); this.refs['q-' + id] = li; });
    const party = this.hud.querySelector('.party')!;
    ROLES.forEach((r, i) => {
      const card = el('button', 'member panel', `<span class="m-key">${i + 1}</span><span class="m-face">${FACE[r]}</span><div class="m-info"><b class="m-name"></b><small class="m-state"></small>
        <div class="bar energy" title="Energía"><i></i></div><div class="bar stress" title="Estrés"><i></i></div></div><span class="m-alert">!</span>`);
      card.addEventListener('click', () => this.h.select(r)); party.append(card); this.refs['m-' + r] = card;
    });
    this.hud.querySelectorAll<HTMLElement>('.res b').forEach(b => { this.refs['r-' + b.dataset.r] = b; });
    this.hud.querySelectorAll<HTMLElement>('[data-r]').forEach(b => { this.refs[b.dataset.r!] = b; });
    this.hud.addEventListener('click', e => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act; if (!act) return;
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
    r['morale'].textContent = `${Math.round(s.morale)}%`; r['budget'].textContent = String(Math.round(s.budget)); r['bugs'].textContent = `${s.bugs}/${MAX_BUGS}`;
    r['morale'].closest('.res')!.classList.toggle('warn', s.morale < 30); r['bugs'].closest('.res')!.classList.toggle('warn', s.bugs >= MAX_BUGS - 2);
    for (const t of s.tasks) {
      const li = r['q-' + t.id]; li.className = 'q ' + (t.status === 'completed' ? 'done' : task === t ? 'current' : 'locked');
      li.querySelector('.q-name')!.textContent = t.name; li.querySelector('.q-state')!.textContent = STATUS_LABEL(t, s);
      li.querySelector('.q-ico')!.textContent = t.status === 'completed' ? '✓' : task === t ? '▶' : '🔒';
    }
    const obj = task ? (task.status === 'working' ? `${s.cats[task.role].name}: ${task.name}` : `Habla con ${s.cats[task.role].name}: ${task.name}`) : '¡Todo entregado!';
    r['objective'].textContent = obj; (this.hud.querySelector('.obj-bar i') as HTMLElement).style.width = `${task?.status === 'working' ? task.progress : 0}%`;
    this.hud.querySelectorAll<HTMLButtonElement>('[data-act="assign"]').forEach(b => { b.disabled = !task || task.status === 'working'; });
    for (const id of ROLES) {
      const c = s.cats[id]; const card = r['m-' + id];
      card.classList.toggle('selected', s.selected === id); card.classList.toggle('has-task', task?.role === id && task.status === 'pending');
      card.querySelector('.m-name')!.textContent = c.name; card.querySelector('.m-state')!.textContent = c.state;
      (card.querySelector('.energy i') as HTMLElement).style.width = `${c.energy}%`; (card.querySelector('.stress i') as HTMLElement).style.width = `${c.stress}%`;
      card.classList.toggle('tired', c.energy < 30); card.classList.toggle('stressed', c.stress > 70);
      const tag = this.tagEls.get(id)!; tag.classList.toggle('alert', task?.role === id && task.status === 'pending'); tag.classList.toggle('selected', s.selected === id);
      const working = task?.role === id && task.status === 'working'; tag.classList.toggle('working', working);
      (tag.querySelector('.tag-bar i') as HTMLElement).style.width = `${working ? task!.progress : 0}%`;
    }
    const sel = s.cats[s.selected]; r['sel-name'].textContent = sel.name; r['sel-state'].textContent = `${sel.title} · ${sel.state}`;
    (this.hud.querySelector('.ab-face') as HTMLElement).textContent = FACE[s.selected];
    const coffee = this.hud.querySelector<HTMLButtonElement>('[data-act="coffee"]')!; coffee.disabled = sel.coffeeCooldown > 0 || s.budget < COFFEE_COST;
    (coffee.querySelector('.cool') as HTMLElement).style.height = `${sel.coffeeCooldown / 25 * 100}%`;
    const lines = s.log.slice(-3).reverse().map((l, i) => `<p class="${i ? 'old' : ''}">${l}</p>`).join('');
    const radio = this.hud.querySelector('.radio-lines')!; if (radio.innerHTML !== lines) radio.innerHTML = lines;
  }

  // ───────────────────────── Etiquetas sobre los gatos ─────────────────────────
  private buildTags() {
    ROLES.forEach(r => { const t = el('div', 'tag', `<div class="tag-alert">!</div><div class="tag-name">${FACE[r]}</div><div class="tag-bar"><i></i></div>`); this.tagLayer.append(t); this.tagEls.set(r, t); });
  }
  positionTags(tags: TagInfo[]) {
    for (const t of tags) { const e = this.tagEls.get(t.role)!; e.style.transform = `translate3d(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px, 0)`; e.style.visibility = t.visible ? 'visible' : 'hidden'; }
  }

  // ───────────────────────── Pergaminos ─────────────────────────
  private openScroll(inner: string, o: { onAction?: (act: string, e: HTMLElement) => void; closable?: boolean; wide?: boolean } = {}) {
    this.closeModal(true);
    const shade = el('div', 'shade scroll-shade');
    const scroll = el('div', 'scroll' + (o.wide ? ' wide' : ''), `<div class="rod"></div><div class="scroll-body"><div class="paper"><div class="paper-inner">${inner}</div></div></div><div class="rod"></div><div class="seal">${PAW}</div>`);
    if (o.closable !== false) { const x = el('button', 'scroll-close', '✕'); x.title = 'Cerrar (Esc)'; x.addEventListener('click', () => { sfx.click(); this.closeModal(); }); scroll.append(x); }
    (scroll.querySelector('.paper') as HTMLElement).style.clipPath = this.tornEdges();
    shade.append(scroll); this.modalLayer.append(shade); this.modalOpen = true; sfx.open();
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
    const shade = this.modalLayer.querySelector('.scroll-shade'); if (!shade) { this.modalOpen = false; return; }
    if (!force && !this.closeCurrent) return;
    const scroll = shade.querySelector('.scroll'); scroll?.classList.remove('open'); shade.classList.add('leaving');
    window.setTimeout(() => shade.remove(), force ? 0 : 320);
    this.modalOpen = false; this.closeCurrent = undefined;
  }

  openChallenge(task: Task) {
    const c = CHALLENGES[task.id]; const options = shuffledOptions(c); const role = { pm: 'PROJECT MANAGER', junior: 'DEV JUNIOR', senior: 'DEV SENIOR', qa: 'QA' }[task.role];
    const html = `<div class="kicker">ENCARGO DEL ESTUDIO · ${role}</div><h2>${task.name}</h2><div class="ornament">❦</div>
      <p>${c.question}</p><pre class="ink">${c.code.replace(/</g, '&lt;')}</pre>
      <div class="options">${options.map((op, i) => `<button class="option" data-act="opt" data-i="${i}"><span class="letter">${'ABC'[i]}</span><span>${op.text}</span></button>`).join('')}</div>
      <div class="verdict"></div>
      <div class="cost">Si fallas: <b>+1 bug</b> · <b>−8 presupuesto</b> · <b>−8 moral</b></div>`;
    let answered = false;
    const scroll = this.openScroll(html, {
      onAction: (act, btn) => {
        if (act === 'opt' && !answered) {
          answered = true; const op = options[Number(btn.dataset.i)];
          scroll.querySelectorAll<HTMLButtonElement>('.option').forEach((b, i) => { b.disabled = true; if (options[i].ok) b.classList.add('right'); });
          btn.classList.add(op.ok ? 'right' : 'wrong', 'chosen');
          const v = scroll.querySelector('.verdict')!; scroll.querySelector('.cost')?.remove();
          v.innerHTML = `<div class="stamp ${op.ok ? 'ok' : 'ko'}">${op.ok ? '¡CORRECTO!' : '¡BUG!'}</div><p>${op.ok ? c.why : 'No era eso. ' + c.why}</p>
            <div class="scroll-actions">${op.ok ? `<button class="btn primary" data-act="close">¡A trabajar!</button>` : `<button class="btn ghost dark" data-act="close">Cerrar</button><button class="btn primary" data-act="retry">Intentar de nuevo</button>`}</div>`;
          this.closeCurrent = () => this.closeModal();
          this.h.answer(task.id, op.ok);
        } else if (act === 'close') { sfx.click(); this.closeModal(); }
        else if (act === 'retry') { sfx.click(); this.closeModal(true); window.setTimeout(() => this.openChallenge(task), 60); }
      }
    });
  }

  openHelp() {
    this.openScroll(`<div class="kicker">MANUAL DEL ESTUDIO</div><h2>Cómo jugar</h2><div class="ornament">❦</div>
      <ol class="steps"><li>Busca al gato con <span class="mark">!</span> encima: tiene el siguiente encargo.</li><li>Haz clic en él (o pulsa ${keycap('ESPACIO')}) y elige la mejor decisión del pergamino.</li><li>Mientras trabaja, cuida su <b>energía</b> con café. Entrega los 5 hitos antes de las <b>18:00</b>.</li></ol>
      <div class="legend-grid">
        <div>${keycap('Clic')}<span>Elegir gato / abrir encargo</span></div><div>${keycap('Arrastrar')}<span>Girar la cámara</span></div>
        <div>${keycap('Rueda')}<span>Acercar / alejar</span></div><div>${keycap('1')}${keycap('2')}${keycap('3')}${keycap('4')}<span>Seleccionar gato</span></div>
        <div>${keycap('ESPACIO')}<span>Ver encargo actual</span></div><div>${keycap('C')}<span>Café al gato elegido</span></div>
        <div>${keycap('V')}<span>Vista general</span></div><div>${keycap('Esc')}<span>Pausa</span></div><div>${keycap('H')}<span>Esta ayuda</span></div><div>${keycap('M')}<span>Silenciar sonido</span></div>
      </div>
      <div class="icon-legend"><div><span class="sw energy"></span>Energía: más alta, trabaja más rápido</div><div><span class="sw stress"></span>Estrés: sube al fallar, baja descansando</div><div><span>❤</span>Moral: si llega a 0, pierdes</div><div><span>🐞</span>Bugs: con 5, pierdes</div></div>
      <div class="scroll-actions"><button class="btn primary" data-act="close">Entendido</button></div>`,
    { onAction: act => { if (act === 'close') { sfx.click(); this.closeModal(); } }, wide: true });
  }
  toggleHelp() { if (this.modalOpen) this.closeModal(); else this.openHelp(); }

  // ───────────────────────── Pausa y final ─────────────────────────
  showPause(paused: boolean) {
    this.modalLayer.querySelector('.pause')?.remove(); if (!paused) return;
    const p = el('div', 'shade pause', `<div class="menu-card panel"><div class="panel-title big">PAUSA</div>
      <button class="btn primary" data-p="resume">Reanudar</button><button class="btn ghost" data-p="help">Cómo jugar</button>
      <button class="btn ghost" data-p="restart">Reiniciar sprint</button><button class="btn ghost" data-p="quit">Salir al menú</button></div>`);
    p.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-p]')?.dataset.p; if (!a) return; sfx.click();
      if (a === 'resume') this.h.resume(); else if (a === 'help') this.openHelp(); else if (a === 'restart') { this.showPause(false); this.h.restart(); } else if (a === 'quit') { this.showPause(false); this.h.quit(); } });
    this.modalLayer.append(p); (p.querySelector('button') as HTMLButtonElement).focus();
  }

  showEnd(s: State) {
    const o = s.outcome!; this.closeModal(true); this.hud.classList.remove('is-on'); this.tagLayer.classList.remove('is-on');
    const stars = [0, 1, 2].map(i => `<span class="star ${i < o.stars ? 'on' : ''}" style="animation-delay:${.4 + i * .25}s">★</span>`).join('');
    const end = el('div', 'shade end', `<div class="end-card ${o.won ? 'won' : 'lost'}"><div class="banner">${o.won ? '¡SPRINT COMPLETADO!' : 'SPRINT FALLIDO'}</div>
      <div class="stars">${stars}</div><p class="reason">${o.reason}</p>
      <div class="stats"><div><small>HORA</small><b>${clock(s.time)}</b></div><div><small>HITOS</small><b>${completedCount(s)}/5</b></div><div><small>BUGS</small><b>${s.bugs}</b></div><div><small>MORAL</small><b>${Math.round(s.morale)}%</b></div></div>
      <div class="end-actions"><button class="btn primary" data-e="again">Jugar otra vez</button><button class="btn ghost" data-e="menu">Menú principal</button></div></div>`);
    end.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-e]')?.dataset.e; if (!a) return; sfx.click(); end.remove(); a === 'again' ? this.h.restart() : this.h.quit(); });
    this.modalLayer.append(end);
  }

  // ───────────────────────── Utilidades ─────────────────────────
  toast(message: string, kind: 'good' | 'bad' | 'info' = 'info') {
    const t = el('div', `toast ${kind}`); t.textContent = message; this.toasts.prepend(t);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild!.remove();
    window.setTimeout(() => { t.classList.add('out'); window.setTimeout(() => t.remove(), 300); }, 3400);
  }
  setMuted(muted: boolean) { this.toast(muted ? '🔇 Sonido desactivado' : '🔊 Sonido activado'); }
  private show(screen: HTMLElement) { [this.splash, this.loading, this.title].forEach(s => s.classList.toggle('is-on', s === screen)); }
  private hideScreens() { [this.splash, this.loading, this.title].forEach(s => s.classList.remove('is-on')); }
}

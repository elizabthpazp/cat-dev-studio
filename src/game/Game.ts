import { Engine, Matrix, PointerEventTypes, Vector3 } from '@babylonjs/core';
import { OfficeScene } from '../engine/OfficeScene';
import { CatActor } from '../characters/CatActor';
import { GameUI, TagInfo } from '../ui/GameUI';
import { sfx } from '../ui/sfx';
import { ASSETS, assetUrl } from '../assets/AssetRegistry';
import { loadStats, preloadModel } from '../assets/ModelLoader';
import { BugSwarm } from '../engine/Bugs';
import { BOSS, BossBug } from '../engine/Boss';
import { CAT_HEIGHT, SEATED_Y, SPOTS, STATIONS, seatOf, stationPoint } from './layout';
import { COFFEE_COOLDOWN, COFFEE_COST, DEADLINE, MAX_BUGS, ROLES, Role, SECONDS_PER_MINUTE, SMASH_COST, Task, activeTask, game, log } from './store';

type Phase = 'loading' | 'title' | 'intro' | 'playing' | 'paused' | 'ended';
interface CamPose { alpha: number; beta: number; radius: number; target: Vector3; }
const OVERVIEW: CamPose = { alpha: -Math.PI / 2 - 0.12, beta: 0.88, radius: 26, target: new Vector3(-1.6, 0, 1.2) };
const TITLE_POSE: CamPose = { alpha: -Math.PI / 2 - 0.9, beta: 1.12, radius: 17, target: new Vector3(0, 1, 1) };
const WORK_LABEL: Record<string, string> = { spec: 'Definiendo el encargo', feature: 'Programando', review: 'Revisando código', qa: 'Probando', deploy: 'Desplegando' };

export class Game {
  /** Multiplicador de velocidad (solo para pruebas). */
  timeScale = 1;
  engine: Engine; office: OfficeScene; ui: GameUI; actors = new Map<Role, CatActor>(); bugs: BugSwarm; boss: BossBug;
  private phase: Phase = 'loading'; private last = performance.now(); private hudClock = 0; private minuteClock = 0; private saveClock = 0;
  private camGoal?: CamPose; private projection = Matrix.Identity();

  constructor(canvas: HTMLCanvasElement, root: HTMLDivElement) {
    this.engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }, false);
    this.office = new OfficeScene(this.engine);
    this.bugs = new BugSwarm(this.office.scene, this.office.shadows);
    this.boss = new BossBug(this.office.scene, this.office.shadows);
    this.ui = new GameUI(root, {
      newGame: () => this.newGame(), continueGame: () => this.continueGame(), beginShift: () => this.beginShift(),
      select: role => this.select(role, true), assign: () => this.openActiveTask(), answer: (id, ok) => this.answer(id, ok),
      coffee: () => this.coffee(game.get().selected), overview: () => this.goOverview(),
      pause: () => this.setPaused(true), resume: () => this.setPaused(false), restart: () => this.newGame(), quit: () => this.toTitle()
    });
    this.wireInput();
  }

  start() {
    const s = game.get();
    const loads = ROLES.map(id => {
      const st = STATIONS[id]; const actor = new CatActor(s.cats[id], this.office.scene, seatOf(st), this.office.shadows);
      actor.sitAt(seatOf(st), st.yaw); this.actors.set(id, actor);
      return actor.loadModel(assetUrl(ASSETS.characters[id]));
    });
    this.setCamera(TITLE_POSE); this.office.camera.detachControl();
    this.office.drawBoard(s.tasks);
    this.ui.showLoading();
    const extras = [ASSETS.shared.bug, ASSETS.shared.hammer, ASSETS.shared.boss].map(f => preloadModel(this.office.scene, assetUrl(f)).catch(() => undefined));
    void Promise.all([this.office.ready, ...loads, ...extras]).then(() => { this.phase = 'title'; this.ui.loadingDone(game.hasSave()); });
    this.engine.runRenderLoop(() => this.loop());
    window.addEventListener('resize', () => this.engine.resize());
  }

  // ───────────────────────── Bucle principal ─────────────────────────
  private loop() {
    const now = performance.now(), real = Math.min(.1, (now - this.last) / 1000), dt = real * this.timeScale; this.last = now;
    const cam = this.office.camera;
    if (this.phase === 'loading' || this.phase === 'title' || this.phase === 'intro') cam.alpha += real * .04; // plano cinematográfico
    if (this.phase !== 'paused') { for (const a of this.actors.values()) a.update(dt); this.bugs.update(dt); this.boss.update(dt); }
    this.shakeScreen();
    if (this.phase === 'playing' && !this.ui.modalOpen) this.tick(dt);
    this.moveCamera(real);
    this.office.scene.render();
    if (this.phase === 'loading') this.ui.setLoadProgress(loadStats.requested ? loadStats.finished / loadStats.requested : 0);
    if (this.phase === 'playing' || this.phase === 'paused') {
      this.ui.positionTags(this.tags());
      this.hudClock += real; if (this.hudClock > .2) { this.hudClock = 0; this.ui.update(game.get()); }
    }
  }

  /** Reglas del juego: reloj, progreso del hito, energía, estrés, victoria y derrota. */
  private tick(dt: number) {
    const s = game.get();
    this.minuteClock += dt; while (this.minuteClock >= SECONDS_PER_MINUTE) { this.minuteClock -= SECONDS_PER_MINUTE; s.time++; }
    const task = activeTask(s);
    for (const c of Object.values(s.cats)) {
      c.coffeeCooldown = Math.max(0, c.coffeeCooldown - dt);
      const busy = task?.status === 'working' && task.role === c.id;
      if (busy) { c.energy = Math.max(5, c.energy - dt * 1.1); c.stress = Math.min(100, c.stress + dt * .15); }
      else { c.energy = Math.min(100, c.energy + dt * .3); c.stress = Math.max(0, c.stress - dt * .25); }
    }
    if (task?.status === 'working') {
      const cat = s.cats[task.role]; const actor = this.actors.get(task.role)!;
      if (actor.isWalking) cat.state = 'De camino';
      else {
        const speed = (.45 + cat.energy / 100 * .75) * (cat.stress > 70 ? .8 : 1);
        task.progress = Math.min(100, task.progress + dt * (100 / task.duration) * speed);
        cat.state = WORK_LABEL[task.id] ?? 'Trabajando';
        if (task.progress >= 100) this.completeTask(task);
      }
    }
    if (Object.values(s.cats).some(c => c.stress > 80)) s.morale = Math.max(0, s.morale - dt * .4);
    if (s.outcome) return;
    if (s.time >= DEADLINE) this.end(false, 'Se acabó la jornada sin entrega. Los bugs olvidados despertaron a BUGZILLA y tomó producción.');
    else if (s.morale <= 0) this.end(false, 'El equipo se rindió y nadie vigiló producción. BUGZILLA aprovechó para salir.');
    else if (s.bugs >= MAX_BUGS) this.end(false, 'Cinco bugs sueltos se fusionaron en BUGZILLA. Producción ha caído.');
    this.saveClock += dt; if (this.saveClock > 5) { this.saveClock = 0; game.save(); }
  }

  private completeTask(t: Task) {
    const s = game.get(); const cat = s.cats[t.role]; const actor = this.actors.get(t.role)!;
    t.progress = 100; t.status = 'completed'; cat.xp += 10; cat.state = '¡Hito cerrado!';
    s.budget += 12; s.morale = Math.min(100, s.morale + 5);
    log(s, `✓ ${t.name} terminado por ${cat.name}.`);
    actor.celebrate(); sfx.success(); this.office.drawBoard(s.tasks);
    window.setTimeout(() => actor.goHome(() => { if (cat.state === '¡Hito cerrado!') cat.state = 'En su puesto'; }), 1300);
    const next = activeTask(s);
    if (!next) { this.end(true, '¡Meowboard está en producción y nada explotó!'); return; }
    this.ui.toast(`✓ ${t.name} · Siguiente: ${next.name}`, 'good');
    window.setTimeout(() => { if (this.phase === 'playing') this.focusOn(next.role); }, 1800);
    game.save();
  }

  private end(won: boolean, reason: string) {
    const s = game.get();
    const stars = !won ? 0 : s.bugs === 0 && s.morale >= 60 ? 3 : s.bugs <= 2 ? 2 : 1;
    s.outcome = { won, reason, stars }; this.phase = 'ended'; game.save();
    if (won) { sfx.victory(); this.goOverview(); window.setTimeout(() => this.ui.showEnd(s), 900); return; }
    this.summonBoss(s);
  }

  /** Derrota: suena la alarma y emerge el jefe final, BUGZILLA. */
  private summonBoss(s: ReturnType<typeof game.get>) {
    this.ui.closeModal(true); this.ui.hideHud(); this.ui.alert('¡PRODUCCIÓN CAÍDA!'); sfx.alarm();
    // Los gatos dejan lo que estén haciendo y se quedan mirando.
    for (const a of this.actors.values()) { if (!a.isSeated) a.goHome(() => a.face(BOSS.spot)); }
    window.setTimeout(() => {
      if (this.phase !== 'ended') return;
      // Sale de cara a la cámara (que mira desde -Z).
      this.boss.summon(Math.PI); this.bugs.absorb(BOSS.spot); sfx.roar();
      for (const a of this.actors.values()) { a.face(BOSS.spot); a.cat.state = '¡¿Qué es ESO?!'; }
      this.camGoal = { alpha: -Math.PI / 2 - .12, beta: 1.32, radius: 13, target: new Vector3(BOSS.spot.x, .4, BOSS.spot.z - 3) };
      window.setTimeout(() => { if (this.phase === 'ended') this.ui.bossIntro(BOSS.name, BOSS.title); }, 1300);
      window.setTimeout(() => { if (this.phase === 'ended') { sfx.defeat(); this.ui.showEnd(s); } }, 4700);
    }, 1100);
  }

  /** Temblor de pantalla mientras el jefe emerge del suelo. */
  private shakeScreen() {
    const canvas = this.engine.getRenderingCanvas()!; const k = this.boss.rising;
    if (k > 0) canvas.style.transform = `translate(${((Math.random() - .5) * 14 * k).toFixed(1)}px, ${((Math.random() - .5) * 14 * k).toFixed(1)}px)`;
    else if (canvas.style.transform) canvas.style.transform = '';
  }

  // ───────────────────────── Acciones del jugador ─────────────────────────
  private openActiveTask() {
    if (this.phase !== 'playing') return;
    const s = game.get(); const task = activeTask(s);
    if (!task) return;
    if (task.status === 'working') { this.ui.toast(`${s.cats[task.role].name} ya está en ello (${Math.round(task.progress)}%).`); return; }
    this.select(task.role, true);
    sfx.open(); this.ui.openChallenge(task);
  }

  private answer(id: string, ok: boolean) {
    const s = game.get(); const task = s.tasks.find(t => t.id === id)!; const cat = s.cats[task.role]; const actor = this.actors.get(task.role)!;
    if (ok) {
      task.status = 'working'; task.progress = 0; log(s, `${cat.name} empieza: ${task.name}.`); sfx.success();
      if (task.id === 'review') actor.walkTo(SPOTS.review.pos, SPOTS.review.yaw);
      else if (task.id === 'deploy') actor.walkTo(SPOTS.servers.pos, SPOTS.servers.yaw);
      else actor.goHome();
      this.office.drawBoard(s.tasks);
    } else {
      cat.stress = Math.min(100, cat.stress + 15); s.budget = Math.max(0, s.budget - 8); s.morale = Math.max(0, s.morale - 8); s.bugs++;
      log(s, `⚠ Mala decisión en «${task.name}». Se coló un bug.`); sfx.error();
      this.bugs.spawn(stationPoint(STATIONS[task.role], 0, -1.4));
      window.setTimeout(() => this.ui.toast(`🐞 ¡Se escapó un bug! Haz clic en él para aplastarlo (−${SMASH_COST} presupuesto).`, 'bad'), 400);
    }
    game.save(); this.ui.update(s);
  }

  /** Aplasta un bug con el martillo a cambio de presupuesto. */
  private smashBug(id: number) {
    if (this.phase !== 'playing') return;
    const s = game.get();
    if (s.budget < SMASH_COST) { this.ui.toast(`Aplastar un bug cuesta ${SMASH_COST} de presupuesto.`, 'bad'); return; }
    if (!this.bugs.smash(id)) return;
    s.budget -= SMASH_COST; s.bugs = Math.max(0, s.bugs - 1); s.morale = Math.min(100, s.morale + 3);
    log(s, '🔨 Bug aplastado. Producción respira.'); sfx.smash();
    this.ui.toast(`🔨 ¡Bug aplastado! −${SMASH_COST} presupuesto`, 'good'); this.ui.update(s); game.save();
  }

  private coffee(role: Role) {
    if (this.phase !== 'playing') return;
    const s = game.get(); const cat = s.cats[role]; const actor = this.actors.get(role)!; const task = activeTask(s);
    if (task?.status === 'working' && task.role === role) { this.ui.toast(`${cat.name} está concentrado. Café después del hito.`, 'bad'); return; }
    if (cat.coffeeCooldown > 0) { this.ui.toast(`${cat.name} podrá tomar otro café en ${Math.ceil(cat.coffeeCooldown)} s.`, 'bad'); return; }
    if (s.budget < COFFEE_COST) { this.ui.toast('No queda presupuesto para café.', 'bad'); return; }
    s.budget -= COFFEE_COST; cat.coffeeCooldown = COFFEE_COOLDOWN; cat.state = 'Yendo por café'; sfx.click();
    const offset = ROLES.indexOf(role) * .55 - .8;
    actor.walkTo(SPOTS.coffee.pos.add(new Vector3(offset, 0, 0)), SPOTS.coffee.yaw, () => {
      cat.energy = Math.min(100, cat.energy + 30); cat.stress = Math.max(0, cat.stress - 15); s.morale = Math.min(100, s.morale + 2);
      cat.state = 'Tomando café'; sfx.coin(); this.ui.toast(`☕ ${cat.name}: «Ahora sí compila.» +30 energía`, 'good');
      window.setTimeout(() => actor.goHome(() => { cat.state = 'En su puesto'; }), 1600);
    });
    this.ui.update(s);
  }

  private select(role: Role, focus: boolean) {
    const s = game.get(); s.selected = role; this.ui.update(s); sfx.click();
    if (focus && this.phase === 'playing') { const p = this.actors.get(role)!.root.position; this.camGoal = { alpha: this.office.camera.alpha, beta: .92, radius: 8, target: new Vector3(p.x, 1, p.z) }; }
  }

  /** Acerca la cámara a un gato sin cambiar la selección. */
  private focusOn(role: Role) { const p = this.actors.get(role)!.root.position; this.camGoal = { alpha: this.office.camera.alpha, beta: .9, radius: 10, target: new Vector3(p.x, 1, p.z) }; }

  private goOverview() { this.camGoal = { ...OVERVIEW, target: OVERVIEW.target.clone() }; }

  // ───────────────────────── Flujo de pantallas ─────────────────────────
  private resetActors() {
    const s = game.get();
    for (const id of ROLES) { const a = this.actors.get(id)!; a.cat = s.cats[id]; a.sitAt(seatOf(STATIONS[id]), STATIONS[id].yaw); }
    this.boss.dispose(); this.ui.hideBoss();
    this.bugs.clear(); for (let i = 0; i < s.bugs; i++) this.bugs.spawn(new Vector3(2, 0, -2));
    this.office.drawBoard(s.tasks);
  }
  private newGame() { game.reset(); game.clearSave(); this.resetActors(); this.phase = 'intro'; this.office.camera.detachControl(); this.ui.showIntro(); }
  private continueGame() { if (!game.load()) { this.newGame(); return; } this.resetActors(); this.beginShift(); }
  private beginShift() {
    this.phase = 'playing'; this.minuteClock = 0; this.office.camera.attachControl(this.engine.getRenderingCanvas(), true); this.goOverview();
    this.ui.showHud(game.get());
    const t = activeTask(game.get()); if (t) window.setTimeout(() => { if (this.phase !== 'playing') return; this.focusOn(t.role); this.ui.toast(`${game.get().cats[t.role].name} tiene un encargo. Haz clic en el gato con «!» o pulsa ESPACIO.`); }, 1500);
  }
  private setPaused(paused: boolean) {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.phase = paused ? 'paused' : 'playing'; this.ui.showPause(paused); if (paused) game.save();
  }
  private toTitle() {
    this.boss.dispose(); this.ui.hideBoss(); this.bugs.clear();
    if (!game.get().outcome) game.save();
    this.phase = 'title'; this.office.camera.detachControl(); this.camGoal = { ...TITLE_POSE, target: TITLE_POSE.target.clone() };
    this.ui.showTitle(game.hasSave());
  }

  // ───────────────────────── Cámara y etiquetas ─────────────────────────
  private setCamera(p: CamPose) { const c = this.office.camera; c.alpha = p.alpha; c.beta = p.beta; c.radius = p.radius; c.target.copyFrom(p.target); }
  private moveCamera(dt: number) {
    const g = this.camGoal; if (!g) return; const c = this.office.camera; const k = 1 - Math.exp(-dt * 4);
    let da = g.alpha - c.alpha; da = Math.atan2(Math.sin(da), Math.cos(da));
    c.alpha += da * k; c.beta += (g.beta - c.beta) * k; c.radius += (g.radius - c.radius) * k; c.target = Vector3.Lerp(c.target, g.target, k);
    if (Math.abs(da) < .002 && Math.abs(g.radius - c.radius) < .02 && Vector3.Distance(c.target, g.target) < .01) this.camGoal = undefined;
  }

  /** Posición en pantalla de la etiqueta sobre cada gato. */
  private tags(): TagInfo[] {
    const scene = this.office.scene; const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
    const vp = this.office.camera.viewport.toGlobal(w, h); const transform = scene.getTransformMatrix();
    const scale = (this.engine.getRenderingCanvas()?.clientWidth ?? w) / w;
    return ROLES.map(id => {
      const a = this.actors.get(id)!; const p = a.root.position;
      const top = new Vector3(p.x, (a.isSeated ? SEATED_Y : 0) + CAT_HEIGHT + .3, p.z);
      const v = Vector3.Project(top, this.projection, transform, vp);
      return { role: id, x: v.x * scale, y: v.y * scale, visible: v.z > 0 && v.z < 1 };
    });
  }

  private wireInput() {
    const canvas = this.engine.getRenderingCanvas()!;
    const cancelGoal = () => { if (this.phase === 'playing') this.camGoal = undefined; };
    canvas.addEventListener('pointerdown', cancelGoal); canvas.addEventListener('wheel', cancelGoal, { passive: true });
    this.office.scene.onPointerObservable.add(info => {
      if (info.type !== PointerEventTypes.POINTERPICK || this.phase !== 'playing' || this.ui.modalOpen) return;
      // Los bugs tienen prioridad: se pueden aplastar aunque estén detrás de un mueble.
      const scene = this.office.scene; const bugHit = scene.pick(scene.pointerX, scene.pointerY, m => m.name.startsWith('bug-hit-'));
      const mesh = bugHit?.hit ? bugHit.pickedMesh : info.pickInfo?.pickedMesh; const id: string = mesh?.metadata?.pick ?? mesh?.name ?? '';
      if (id.startsWith('bug-')) this.smashBug(Number(id.slice(4)));
      else if (id === 'coffee-machine') this.coffee(game.get().selected);
      else if (id === 'board') this.openActiveTask();
      else if (/^(monitor|cat)-/.test(id)) {
        const role = id.replace(/^(monitor|cat)-/, '') as Role; const t = activeTask(game.get());
        if (t && t.role === role && t.status === 'pending') this.openActiveTask(); else this.select(role, true);
      }
    });
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'm') { this.ui.setMuted(sfx.toggle()); return; }
      if (this.phase !== 'playing' && this.phase !== 'paused') return;
      if (k === 'escape') { if (this.ui.modalOpen) this.ui.closeModal(); else this.setPaused(this.phase === 'playing'); return; }
      if (this.phase !== 'playing' || this.ui.modalOpen) return;
      if (k >= '1' && k <= '4') this.select(ROLES[Number(k) - 1], true);
      else if (k === ' ' || k === 'enter') { e.preventDefault(); this.openActiveTask(); }
      else if (k === 'c') this.coffee(game.get().selected);
      else if (k === 'v') this.goOverview();
      else if (k === 'h') this.ui.toggleHelp();
    });
  }
}

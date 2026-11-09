import { ArcRotateCamera, Color3, Color4, DirectionalLight, DynamicTexture, Engine, HemisphericLight, Mesh, MeshBuilder, PBRMaterial, Scene, ShadowGenerator, StandardMaterial, Texture, TransformNode, Vector3 } from '@babylonjs/core';
import { ASSETS, MODEL_FIXES, WorkstationSlot, assetUrl } from '../assets/AssetRegistry';
import { FitAxis, placeModel } from '../assets/ModelLoader';
import { CHAIR_HEIGHT, DESK, STATIONS, Station } from '../game/layout';
import type { Task } from '../game/store';

/** Dónde va cada accesorio en un puesto (coordenadas locales: el gato mira a +Z). */
interface PropSlot { slot: WorkstationSlot; at: [number, number, number]; yaw: number; fit: FitAxis; size: number; hides?: string[]; shadow?: boolean; }
const T = DESK.top;
const STATION_PROPS: PropSlot[] = [
  { slot: 'chair', at: [0, 0, 0], yaw: 0, fit: 'height', size: CHAIR_HEIGHT, hides: ['chair'], shadow: true },
  { slot: 'monitor', at: [0, T, 1.22], yaw: Math.PI, fit: 'max', size: 0.88, hides: ['monitor', 'screen-glow'], shadow: true },
  { slot: 'computer', at: [0.9, T, 1.12], yaw: Math.PI, fit: 'height', size: 0.6, hides: ['tower'] },
  { slot: 'keyboard', at: [-0.05, T, 0.64], yaw: Math.PI, fit: 'width', size: 0.62, hides: ['keyboard'] },
  { slot: 'mouse', at: [0.5, T, 0.66], yaw: Math.PI, fit: 'depth', size: 0.16 },
  { slot: 'cup', at: [-0.62, T, 0.58], yaw: Math.PI * 0.8, fit: 'height', size: 0.17 },
  { slot: 'headset', at: [-0.98, T, 0.72], yaw: Math.PI, fit: 'height', size: 0.3 },
  { slot: 'lamp', at: [-0.95, T, 1.26], yaw: Math.PI * 0.75, fit: 'height', size: 0.62 }
];

interface BoxOpts { parent?: TransformNode; cast?: boolean; pick?: boolean; }

export class OfficeScene {
  scene: Scene; camera: ArcRotateCamera; shadows: ShadowGenerator; ground: Mesh;
  stationRoots = new Map<string, TransformNode>();
  /** Se resuelve cuando todos los modelos de la oficina terminaron de cargar (o fallaron). */
  ready: Promise<void>;
  private boardTexture!: DynamicTexture;
  private materials = new Map<string, PBRMaterial>();

  constructor(public engine: Engine) {
    const scene = this.scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString('#0b1122ff');
    scene.skipPointerMovePicking = true;          // no buscar objetos bajo el ratón en cada movimiento
    scene.constantlyUpdateMeshUnderPointer = false;
    scene.imageProcessingConfiguration.contrast = 1.12; scene.imageProcessingConfiguration.exposure = 1.08;
    scene.imageProcessingConfiguration.vignetteEnabled = true; scene.imageProcessingConfiguration.vignetteWeight = 2.2;
    scene.imageProcessingConfiguration.vignetteColor = new Color4(0.02, 0.03, 0.08, 1);

    this.camera = new ArcRotateCamera('camera', -Math.PI / 2 - 0.3, 0.98, 23, new Vector3(-1, 0.6, 0.5), scene);
    this.camera.lowerRadiusLimit = 6; this.camera.upperRadiusLimit = 30; this.camera.lowerBetaLimit = 0.35; this.camera.upperBetaLimit = 1.38;
    this.camera.wheelDeltaPercentage = .025; this.camera.panningSensibility = 120; this.camera.inertia = .85; this.camera.minZ = .3; this.camera.maxZ = 120;
    this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

    // Dos luces: cielo + sol con sombras. (Antes había 6 luces y un GlowLayer.)
    const sky = new HemisphericLight('sky', new Vector3(-.2, 1, -.3), scene); sky.intensity = 1.05; sky.diffuse = Color3.FromHexString('#ffe9cf'); sky.groundColor = Color3.FromHexString('#3b4a70');
    const sun = new DirectionalLight('sun', new Vector3(-.4, -1, .35), scene); sun.position = new Vector3(8, 14, -8); sun.intensity = 1.1; sun.diffuse = Color3.FromHexString('#ffe2bd');
    this.shadows = new ShadowGenerator(1024, sun);
    this.shadows.usePercentageCloserFiltering = true; this.shadows.filteringQuality = ShadowGenerator.QUALITY_LOW; this.shadows.bias = .002; this.shadows.darkness = .35;

    this.ground = MeshBuilder.CreateGround('office-floor', { width: 30, height: 22 }, scene);
    const floor = new StandardMaterial('floor-mat', scene); floor.diffuseTexture = this.planks(); (floor.diffuseTexture as Texture).uScale = 6; (floor.diffuseTexture as Texture).vScale = 4.4; floor.specularColor = new Color3(.08, .08, .1);
    this.ground.material = floor; this.ground.receiveShadows = true; this.ground.isPickable = false; this.ground.freezeWorldMatrix();

    this.buildOffice();
    this.ready = Promise.allSettled([...Object.values(STATIONS).map(s => this.loadStation(s)), this.loadSharedProps()]).then(() => undefined);
  }

  /** Material compartido por color (antes se creaba uno por cada caja). */
  mat(mesh: Mesh, hex: string, rough = .85) {
    let m = this.materials.get(hex + rough);
    if (!m) { m = new PBRMaterial('mat-' + hex, this.scene); m.albedoColor = Color3.FromHexString(hex); m.roughness = rough; m.metallic = 0; this.materials.set(hex + rough, m); }
    mesh.material = m; return m;
  }
  emissive(mesh: Mesh, hex: string, texture?: DynamicTexture) {
    if (texture) { const p = new PBRMaterial(mesh.name + '-unlit', this.scene); p.unlit = true; p.albedoTexture = texture; p.albedoColor = Color3.White(); mesh.material = p; return p; }
    const m = new StandardMaterial(mesh.name + '-emissive', this.scene); m.disableLighting = true; m.specularColor = Color3.Black(); m.diffuseColor = Color3.Black(); m.emissiveColor = Color3.FromHexString(hex); mesh.material = m; return m; }
  box(name: string, pos: Vector3, size: Vector3, color: string, o: BoxOpts = {}) {
    const m = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene);
    if (o.parent) m.parent = o.parent; m.position = pos; this.mat(m, color); m.receiveShadows = true; m.isPickable = !!o.pick;
    if (o.cast) this.shadows.addShadowCaster(m);
    return m;
  }
  sign(text: string, pos: Vector3, w: number, color = '#ffba5d', billboard = false) {
    const p = MeshBuilder.CreatePlane('sign-' + text, { width: w, height: w * .22 }, this.scene); p.position = pos; p.isPickable = false; if (billboard) p.billboardMode = Mesh.BILLBOARDMODE_Y;
    const t = new DynamicTexture('label-' + text, { width: 1024, height: 256 }, this.scene, true); t.hasAlpha = true;
    const ctx = t.getContext() as CanvasRenderingContext2D; let px = 150; do { ctx.font = `bold ${px}px "Lilita One", Arial`; px -= 6; } while (px > 30 && ctx.measureText(text).width > 960);
    t.drawText(text, null, 180, ctx.font, 'white', 'transparent', true);
    const m = new StandardMaterial('signmat-' + text, this.scene); m.diffuseTexture = t; m.opacityTexture = t; m.emissiveColor = Color3.FromHexString(color); m.disableLighting = true; m.backFaceCulling = false; p.material = m; return p;
  }

  private async place(file: string, parent: TransformNode, fit: FitAxis, size: number, pick?: string, hides: string[] = [], shadow = false) {
    try {
      const placed = await placeModel(this.scene, assetUrl(file), parent, { fit, size, pick, isStatic: true, ...MODEL_FIXES[file] });
      if (shadow) placed.meshes.forEach(m => this.shadows.addShadowCaster(m, false));
      hides.forEach(name => this.scene.getMeshByName(name)?.dispose());
      return placed;
    } catch (error) { console.warn(`No se pudo cargar ${file}; se mantiene el marcador provisional.`, error); return undefined; }
  }

  private async loadStation(s: Station) {
    const root = this.stationRoots.get(s.key)!;
    const assets = ASSETS.workstations[s.key];
    await Promise.all(STATION_PROPS.map(p => {
      const holder = new TransformNode(`${s.key}-${p.slot}`, this.scene);
      holder.parent = root; holder.position.set(...p.at); holder.rotation.y = p.yaw;
      return this.place(assets[p.slot], holder, p.fit, p.size, `monitor-${s.key}`, (p.hides ?? []).map(h => `${h}-${s.key}`), p.shadow);
    }));
  }

  private async loadSharedProps() {
    const at = (name: string, x: number, y: number, z: number, yaw = 0) => { const n = new TransformNode(name, this.scene); n.position.set(x, y, z); n.rotation.y = yaw; return n; };
    const jobs: Promise<unknown>[] = [];
    jobs.push(this.place(ASSETS.shared.coffeeMachine, at('coffee-machine-real', -11.5, .95, 9.25, Math.PI), 'height', .75, 'coffee-machine', ['coffee-machine'], true));
    jobs.push(this.place(ASSETS.shared.mug, at('coffee-bar-mug', -10.55, .95, 9.05, 2.6), 'height', .16, 'coffee-machine'));
    jobs.push(this.place(ASSETS.shared.pawMug, at('coffee-bar-paw-mug', -10.15, .95, 9.35, 3.4), 'height', .16, 'coffee-machine'));
    [-8.6, -7, -5.4].forEach((x, i) => {
      jobs.push(this.place(ASSETS.shared.meetingChair, at(`meeting-chair-front-${i}`, x, 0, 3.45, 0), 'height', CHAIR_HEIGHT, undefined, [`meeting-chair-${i}`], true));
      jobs.push(this.place(ASSETS.shared.meetingChair, at(`meeting-chair-back-${i}`, x, 0, 6.55, Math.PI), 'height', CHAIR_HEIGHT, undefined, [`meeting-chair-${i + 3}`], true));
    });
    jobs.push(this.place(ASSETS.shared.mug, at('meeting-mug', -8.4, .9, 4.7, 1.2), 'height', .16));
    jobs.push(this.place(ASSETS.shared.spareHeadset, at('meeting-headset', -5.6, .9, 5.3, -0.4), 'height', .28));
    await Promise.all(jobs);
  }

  private buildStation(s: Station) {
    const root = new TransformNode(`station-${s.key}`, this.scene); root.position.set(s.x, 0, s.z); root.rotation.y = s.yaw; root.computeWorldMatrix(true); this.stationRoots.set(s.key, root);
    const { width: w, depth: d, top, thickness: th, centerZ: cz } = DESK;
    this.box(`desk-${s.key}`, new Vector3(0, top - th / 2, cz), new Vector3(w, th, d), '#b77352', { parent: root, cast: true, pick: true }).metadata = { pick: `monitor-${s.key}` };
    for (const lx of [-w / 2 + .1, w / 2 - .1]) for (const lz of [cz - d / 2 + .1, cz + d / 2 - .1]) this.box(`desk-leg-${s.key}`, new Vector3(lx, (top - th) / 2, lz), new Vector3(.08, top - th, .08), '#5b3b2e', { parent: root });
    this.box(`desk-panel-${s.key}`, new Vector3(0, top * .55, cz + d / 2 - .1), new Vector3(w - .3, top * .5, .04), '#8f5a42', { parent: root });
    // Provisionales mientras cargan los modelos reales.
    this.box(`monitor-${s.key}`, new Vector3(0, top + .45, 1.25), new Vector3(.85, .5, .06), '#10192d', { parent: root });
    const screen = this.box(`screen-glow-${s.key}`, new Vector3(0, top + .45, 1.215), new Vector3(.75, .4, .01), '#5b9fc6', { parent: root }); this.emissive(screen, '#58a9e0');
    this.box(`keyboard-${s.key}`, new Vector3(-.05, top + .02, .64), new Vector3(.6, .04, .2), '#d4d5ce', { parent: root });
    this.box(`tower-${s.key}`, new Vector3(.9, top + .3, 1.12), new Vector3(.25, .6, .45), '#2b3350', { parent: root });
    this.box(`chair-${s.key}`, new Vector3(0, .3, 0), new Vector3(.7, .6, .7), '#3e5279', { parent: root });
  }

  buildOffice() {
    const wallColor = '#2a3a5c';
    this.box('back-wall', new Vector3(0, 2.5, 10), new Vector3(30, 5, .35), wallColor); this.box('left-wall', new Vector3(-14.8, 2.5, 0), new Vector3(.35, 5, 20), wallColor);
    this.box('baseboard-back', new Vector3(0, .08, 9.8), new Vector3(30, .16, .06), '#1a253d'); this.box('baseboard-left', new Vector3(-14.6, .08, 0), new Vector3(.06, .16, 20), '#1a253d');
    const skyline = this.skyline();
    for (const x of [-11, -5.5, 5.5, 11]) {
      const win = MeshBuilder.CreatePlane('night-window', { width: 4.5, height: 2.6 }, this.scene); win.position.set(x, 3.25, 9.8); win.isPickable = false; this.emissive(win, '#2a6f98', skyline);
      this.box('window-frame-h', new Vector3(x, 3.25, 9.78), new Vector3(4.7, .1, .08), '#17233c'); this.box('window-frame-v', new Vector3(x, 3.25, 9.78), new Vector3(.1, 2.75, .08), '#17233c');
      this.box('window-sill', new Vector3(x, 1.92, 9.7), new Vector3(4.8, .08, .25), '#17233c');
    }
    this.sign('CAT DEV STUDIO', new Vector3(0, 4.55, 9.6), 7, '#ff9d6e');
    // Tablero kanban: refleja el estado real de los hitos.
    const board = MeshBuilder.CreatePlane('board', { width: 5.5, height: 2.4 }, this.scene); board.position.set(0, 2.85, 9.8); board.metadata = { pick: 'board' };
    this.boardTexture = new DynamicTexture('board-tex', { width: 1024, height: 448 }, this.scene, true);
    const bm = new StandardMaterial('board-mat', this.scene); bm.diffuseTexture = this.boardTexture; bm.emissiveColor = new Color3(.55, .55, .55); bm.specularColor = Color3.Black(); board.material = bm;
    this.box('board-frame', new Vector3(0, 2.85, 9.83), new Vector3(5.7, 2.6, .05), '#5b3b2e');
    this.drawBoard([]);
    this.box('meeting-rug', new Vector3(-7, .01, 5), new Vector3(8, .02, 5.2), '#3c5272'); this.box('dev-rug', new Vector3(3.5, .01, -3.2), new Vector3(13, .02, 5.5), '#34466b');
    this.box('meeting-table', new Vector3(-7, .86, 5), new Vector3(4.8, .08, 2), '#b86f4e', { cast: true });
    for (const x of [-9.2, -4.8]) for (const z of [4.2, 5.8]) this.box('meeting-table-leg', new Vector3(x, .41, z), new Vector3(.1, .82, .1), '#5b3b2e');
    [-8.6, -7, -5.4, -8.6, -7, -5.4].forEach((x, i) => this.box(`meeting-chair-${i}`, new Vector3(x, .3, i < 3 ? 3.45 : 6.55), new Vector3(.7, .6, .7), '#d6a24d'));
    Object.values(STATIONS).forEach(s => this.buildStation(s));
    // Sala de servidores con luces de estado.
    this.box('server-room', new Vector3(12, 1.5, -1), new Vector3(3, 3, 5), '#1c243b', { cast: true });
    for (let z = -2.4; z <= .4; z += .7) { this.box('server-rack', new Vector3(10.48, 1.5, z), new Vector3(.04, 2.2, .55), '#11182a'); for (let y = .7; y <= 2.3; y += .4) { const led = this.box('server-led', new Vector3(10.45, y, z - .15), new Vector3(.03, .05, .08), '#e8785e'); this.emissive(led, (Math.round(y * 10) + Math.round(z * 10)) % 3 === 0 ? '#ffb347' : '#5fe3a1'); } }
    this.sign('SERVIDORES', new Vector3(10.2, 3.4, -1), 2.4, '#e8785e', true);
    // Barra de café.
    this.box('coffee-bar', new Vector3(-11, .475, 9.3), new Vector3(4, .95, .9), '#744f4c', { cast: true }); this.box('coffee-bar-top', new Vector3(-11, .965, 9.3), new Vector3(4.1, .03, 1), '#d9c3a0');
    this.box('coffee-machine', new Vector3(-11.5, 1.25, 9.25), new Vector3(.5, .6, .45), '#d4c2a2', { pick: true }).metadata = { pick: 'coffee-machine' };
    this.sign('CAFÉ', new Vector3(-11, 2.15, 9.6), 2.2, '#ffcc75');
    // Plantas.
    const leafMat = new PBRMaterial('leaf-mat', this.scene); leafMat.albedoColor = Color3.FromHexString('#3f9a6e'); leafMat.roughness = .9; leafMat.metallic = 0;
    for (const [x, z] of [[-13.6, 8.6], [13, 8.6], [-13.6, -7], [13, -7]]) {
      this.box('plant-pot', new Vector3(x, .35, z), new Vector3(.6, .7, .6), '#d68b68', { cast: true });
      for (const [dx, dy, dz, r] of [[0, 1.15, 0, .55], [.25, 1.45, .1, .4], [-.22, 1.4, -.12, .42], [.05, 1.75, 0, .32]]) { const leaf = MeshBuilder.CreateSphere('plant-leaf', { diameter: r * 2, segments: 8 }, this.scene); leaf.position.set(x + dx, dy, z + dz); leaf.material = leafMat; leaf.isPickable = false; }
    }
    // Lámparas colgantes (solo emisivas: sin luces extra).
    for (const [x, z] of [[0, -4], [6, -4], [-7, 5]]) { const lamp = this.box('pendant-lamp', new Vector3(x, 3.6, z), new Vector3(.6, .14, .6), '#ffe3a8'); this.emissive(lamp, '#ffd27a'); this.box('pendant-cord', new Vector3(x, 4.8, z), new Vector3(.02, 2.3, .02), '#17233c'); }
    // Todo lo construido aquí es estático.
    this.scene.meshes.forEach(m => { if (!m.name.startsWith('sign-') && !m.name.startsWith('monitor-') && !m.name.startsWith('screen-glow-') && !m.name.startsWith('keyboard-') && !m.name.startsWith('tower-') && !m.name.startsWith('chair-') && !m.name.startsWith('coffee-machine') && !/meeting-chair-\d/.test(m.name)) m.freezeWorldMatrix(); });
  }

  /** Redibuja el tablero kanban con el estado de los hitos. */
  drawBoard(tasks: Task[]) {
    const ctx = this.boardTexture.getContext() as CanvasRenderingContext2D; const W = 1024, H = 448;
    ctx.fillStyle = '#efe6cf'; ctx.fillRect(0, 0, W, H);
    const cols: [string, Task['status']][] = [['POR HACER', 'pending'], ['EN CURSO', 'working'], ['HECHO', 'completed']];
    const colors: Record<string, string> = { pm: '#9cc3e6', junior: '#ffc98a', senior: '#d7b49e', qa: '#a8dcb1' };
    cols.forEach(([title, status], c) => {
      const x = 20 + c * 335;
      ctx.fillStyle = '#d8ccae'; ctx.fillRect(x, 16, 315, H - 32);
      ctx.fillStyle = '#3b2a1c'; ctx.font = 'bold 34px "Lilita One", Arial'; ctx.textAlign = 'center'; ctx.fillText(title, x + 157, 58);
      tasks.filter(t => t.status === status).forEach((t, i) => {
        const y = 78 + i * 70; ctx.save(); ctx.translate(x + 157, y + 30); ctx.rotate(((i * 37 + c * 11) % 7 - 3) * .012);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-138, -24, 280, 60); ctx.fillStyle = colors[t.role]; ctx.fillRect(-140, -28, 280, 58);
        ctx.fillStyle = '#2a2018'; ctx.font = 'bold 24px Arial'; ctx.fillText(t.name, 0, 8); ctx.restore();
      });
    });
    this.boardTexture.update();
  }

  private skyline(): DynamicTexture {
    const t = new DynamicTexture('skyline', { width: 512, height: 296 }, this.scene, true); const ctx = t.getContext() as CanvasRenderingContext2D;
    const g = ctx.createLinearGradient(0, 0, 0, 296); g.addColorStop(0, '#0b1636'); g.addColorStop(.6, '#2b2f6b'); g.addColorStop(1, '#7a4a7a'); ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 296);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(255,255,255,${.3 + rnd() * .6})`; ctx.fillRect(rnd() * 512, rnd() * 140, 1.5, 1.5); }
    ctx.fillStyle = '#f6e7b5'; ctx.beginPath(); ctx.arc(420, 60, 22, 0, Math.PI * 2); ctx.fill();
    for (let layer = 0; layer < 2; layer++) {
      let x = -10; while (x < 520) {
        const w = 26 + rnd() * 46, h = (layer ? 70 : 110) + rnd() * (layer ? 90 : 120); ctx.fillStyle = layer ? '#0d1229' : '#1a1f45'; ctx.fillRect(x, 296 - h, w, h);
        if (layer) for (let wy = 296 - h + 8; wy < 290; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 9) if (rnd() > .62) { ctx.fillStyle = rnd() > .3 ? '#ffd27a' : '#8fd3ff'; ctx.fillRect(wx, wy, 4, 5); }
        x += w + 2;
      }
    }
    t.update(); return t;
  }

  private planks(): DynamicTexture {
    const t = new DynamicTexture('planks', { width: 512, height: 512 }, this.scene, true); const ctx = t.getContext() as CanvasRenderingContext2D;
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let row = 0; row < 8; row++) { let x = -rnd() * 200; while (x < 512) { const w = 160 + rnd() * 120; const l = 20 + rnd() * 6; ctx.fillStyle = `hsl(222, 22%, ${l}%)`; ctx.fillRect(x, row * 64, w, 62); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + w - 2, row * 64, 2, 64); x += w; } ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, row * 64 + 62, 512, 2); }
    t.update(); t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; return t;
  }
}

import { Color3, Mesh, MeshBuilder, PBRMaterial, Scene, ShadowGenerator, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { Cat } from '../game/store';
import { placeModel } from '../assets/ModelLoader';
import { CAT_HEIGHT, SEATED_Y } from '../game/layout';

/**
 * Gato de la oficina. `root` está siempre en el suelo (y = 0) cuando camina y a
 * SEATED_Y cuando está sentado; el modelo tiene su base en el origen de `root`.
 */
export class CatActor {
  root: TransformNode; target = new Vector3();
  /** Sube cada vez que el gato recibe una orden nueva (caminar, volver, sentarse). Sirve para descartar órdenes viejas programadas con setTimeout. */
  errand = 0;
  private bob = 0; private seated = false; private returnToSeat = false;
  private seat = new Vector3(); private seatYaw = 0; private arriveYaw?: number; private onArrive?: () => void; private celebrateT = 0;
  private modelPivot: TransformNode; private placeholder: TransformNode; private loaded = false;

  constructor(public cat: Cat, scene: Scene, start: Vector3, private shadows?: ShadowGenerator) {
    this.root = new TransformNode(cat.id + '-actor-root', scene); this.root.position = new Vector3(start.x, 0, start.z);
    this.modelPivot = new TransformNode(cat.id + '-model-pivot', scene); this.modelPivot.parent = this.root;
    // Sustituto simple mientras carga el modelo (base apoyada en y = 0).
    this.placeholder = new TransformNode(cat.id + '-placeholder', scene); this.placeholder.parent = this.root; this.placeholder.position.y = .78;
    const fur = new PBRMaterial(cat.id + '-fur', scene); fur.albedoColor = Color3.FromHexString(cat.color); fur.roughness = .92;
    const part = (m: Mesh) => { m.parent = this.placeholder; m.material = fur; m.metadata = { pick: 'cat-' + cat.id }; return m; };
    part(MeshBuilder.CreateCapsule(cat.id + '-placeholder-body', { height: 1.1, radius: .4 }, scene)).position.y = -.22;
    const head = part(MeshBuilder.CreateSphere(cat.id + '-head', { diameter: .8 }, scene)); head.position.y = .42;
    for (const x of [-.22, .22]) { const ear = MeshBuilder.CreateCylinder(cat.id + '-ear', { diameter: .3, height: .28, tessellation: 3 }, scene); ear.parent = head; ear.material = fur; ear.position.set(x, .36, 0); ear.rotation.z = x < 0 ? .25 : -.25; }
    const eyes = new StandardMaterial(cat.id + '-eyes', scene); eyes.emissiveColor = Color3.FromHexString('#d8f5b8');
    for (const x of [-.15, .15]) { const eye = MeshBuilder.CreateSphere(cat.id + '-eye', { diameter: .11 }, scene); eye.parent = head; eye.position.set(x, .05, .37); eye.material = eyes; }
  }

  async loadModel(url: string) {
    try {
      const placed = await placeModel(this.root.getScene(), url, this.modelPivot, { fit: 'height', size: CAT_HEIGHT, pick: 'cat-' + this.cat.id });
      placed.meshes.forEach(m => this.shadows?.addShadowCaster(m, false));
      this.placeholder.setEnabled(false); this.loaded = true;
    } catch (error) { console.warn(`No se pudo cargar el modelo de ${this.cat.name}; se usará el sustituto.`, error); }
  }

  /** Gira al gato (sentado o de pie) para mirar un punto. */
  face(point: Vector3) { this.root.rotation.y = Math.atan2(point.x - this.root.position.x, point.z - this.root.position.z); this.arriveYaw = undefined; }

  /** Lo sienta directamente en su silla mirando hacia `yaw` (hacia su PC). */
  sitAt(seat: Vector3, yaw: number) {
    this.seat.copyFrom(seat); this.seatYaw = yaw; this.seated = true; this.returnToSeat = false; this.arriveYaw = undefined; this.onArrive = undefined; this.errand++;
    this.root.position.set(seat.x, SEATED_Y, seat.z); this.root.rotation.y = yaw; this.target.copyFrom(this.root.position);
  }
  /** Camina de vuelta a su silla y se sienta. */
  goHome(onSeated?: () => void) { if (this.seated) { onSeated?.(); return; } this.errand++; this.target.set(this.seat.x, 0, this.seat.z); this.returnToSeat = true; this.onArrive = onSeated; }
  get isSeated() { return this.seated; }
  get isWalking() { return !this.seated && Vector3.DistanceSquared(new Vector3(this.target.x, 0, this.target.z), new Vector3(this.root.position.x, 0, this.root.position.z)) > .0036; }
  /** Pequeño salto de alegría (al terminar un hito). */
  celebrate() { this.celebrateT = 1.2; }
  /** Camina a un punto; si se indica `faceYaw`, al llegar se gira hacia allí. */
  walkTo(position: Vector3, faceYaw?: number, onArrive?: () => void) { this.stand(); this.target.set(position.x, 0, position.z); this.returnToSeat = false; this.arriveYaw = faceYaw; this.onArrive = onArrive; this.errand++; }
  private stand() { if (this.seated) { this.seated = false; this.root.position.y = 0; } }

  update(dt: number) {
    const d = this.target.subtract(this.root.position); d.y = 0;
    if (!this.seated && d.length() > .06) {
      const step = Math.min(d.length(), dt * 2.4); d.normalize(); this.root.position.addInPlace(d.scale(step)); this.root.position.y = 0;
      const want = Math.atan2(d.x, d.z); let diff = want - this.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); this.root.rotation.y += diff * Math.min(1, dt * 12);
      this.pose('walk'); return;
    }
    if (this.returnToSeat) { const cb = this.onArrive; this.sitAt(this.seat, this.seatYaw); this.onArrive = cb; }
    else if (this.arriveYaw !== undefined) { this.root.rotation.y = this.arriveYaw; this.arriveYaw = undefined; }
    if (this.onArrive) { const cb = this.onArrive; this.onArrive = undefined; cb(); }
    if (this.celebrateT > 0) { this.celebrateT -= dt; this.modelPivot.position.y = Math.abs(Math.sin(this.celebrateT * 9)) * .35; this.modelPivot.rotation.y = (1.2 - this.celebrateT) * Math.PI * 1.67; if (this.celebrateT <= 0) { this.modelPivot.position.y = 0; this.modelPivot.rotation.y = 0; } return; }
    this.bob += dt * (this.seated ? 5 : 2);
    if (this.seated) {
      this.root.position.y = SEATED_Y + Math.sin(this.bob) * .008;
      this.pose('typing');
    } else { this.root.position.y = Math.abs(Math.sin(this.bob)) * .015; this.pose('idle'); }
  }

  /** Animación sencilla por transformaciones (los modelos no traen esqueleto ni clips). */
  private pose(mode: 'walk' | 'typing' | 'idle') {
    if (!this.loaded) return;
    const t = performance.now() / 1000;
    this.modelPivot.rotation.z = mode === 'walk' ? Math.sin(t * 10) * .06 : 0;
    this.modelPivot.rotation.x = mode === 'typing' ? .06 + Math.sin(t * 4) * .015 : 0;
    this.modelPivot.position.y = mode === 'walk' ? Math.abs(Math.sin(t * 10)) * .05 : 0;
  }
}

import { Mesh, MeshBuilder, Scene, ShadowGenerator, TransformNode, Vector3 } from '@babylonjs/core';
import { ASSETS, assetUrl } from '../assets/AssetRegistry';
import { placeModel } from '../assets/ModelLoader';

interface LiveBug { id: number; root: TransformNode; target: Vector3; speed: number; t: number; dying?: number; hammer?: TransformNode; absorbed?: boolean; }

/** Zona por la que deambulan los bugs (suelo de la oficina, lejos de las paredes). */
const AREA = { minX: -12, maxX: 9.5, minZ: -8, maxZ: 7.5 };
const BUG_SIZE = .42, HAMMER_SIZE = .9;

/**
 * Cada bug que se escapa aparece como un bicho caminando por la oficina.
 * Al aplastarlo cae el martillo, el bicho se aplana y desaparece.
 */
export class BugSwarm {
  private bugs: LiveBug[] = [];
  private nextId = 1;
  /** Cuando aparece el jefe final, todos los bugs corren hacia él y se fusionan. */
  private absorbInto?: Vector3;
  constructor(private scene: Scene, private shadows: ShadowGenerator) {}

  get count() { return this.bugs.filter(b => b.dying === undefined).length; }

  spawn(near: Vector3) {
    const id = this.nextId++;
    const root = new TransformNode(`bug-${id}`, this.scene);
    root.position.set(clamp(near.x + rand(-.8, .8), AREA.minX, AREA.maxX), 0, clamp(near.z + rand(-.8, .8), AREA.minZ, AREA.maxZ));
    root.scaling.setAll(.01);
    // Caja invisible más grande que el bicho para que sea fácil hacerle clic.
    const hit = MeshBuilder.CreateBox(`bug-hit-${id}`, { width: .9, height: .7, depth: .9 }, this.scene) as Mesh;
    hit.parent = root; hit.position.y = .3; hit.visibility = 0; hit.metadata = { pick: `bug-${id}` };
    const bug: LiveBug = { id, root, target: this.randomPoint(), speed: rand(.6, 1), t: 0 };
    this.bugs.push(bug);
    void placeModel(this.scene, assetUrl(ASSETS.shared.bug), root, { fit: 'height', size: BUG_SIZE, pick: `bug-${id}` })
      .then(p => p.meshes.forEach(m => this.shadows.addShadowCaster(m, false)))
      .catch(e => console.warn('No se pudo cargar el bug', e));
    return id;
  }

  /** Aplasta un bug con el martillo. Devuelve false si ya no existe. */
  smash(id: number) {
    const bug = this.bugs.find(b => b.id === id && b.dying === undefined); if (!bug) return false;
    bug.dying = 0;
    const hammer = new TransformNode(`hammer-${id}`, this.scene);
    hammer.position.set(bug.root.position.x, 1.6, bug.root.position.z); hammer.rotation.set(0, rand(0, Math.PI * 2), Math.PI * .85);
    bug.hammer = hammer;
    void placeModel(this.scene, assetUrl(ASSETS.shared.hammer), hammer, { fit: 'height', size: HAMMER_SIZE }).catch(() => undefined);
    return true;
  }

  clear() { this.bugs.forEach(b => this.dispose(b)); this.bugs = []; this.absorbInto = undefined; }
  absorb(point: Vector3) { this.absorbInto = point.clone(); this.bugs.forEach(b => { b.speed = rand(3, 4.2); }); }

  update(dt: number) {
    for (const b of [...this.bugs]) {
      b.t += dt;
      if (b.dying !== undefined) { this.animateSmash(b, dt); continue; }
      // Aparece con un pequeño "pop".
      if (this.absorbInto) {
        b.target = this.absorbInto;
        if (Vector3.Distance(b.root.position, this.absorbInto) < 2.6) { b.absorbed = true; }
        if (b.absorbed) { b.root.scaling.setAll(Math.max(0, b.root.scaling.x - dt * 2.5)); b.root.position.y += dt * 1.5; if (b.root.scaling.x <= 0) { this.dispose(b); this.bugs = this.bugs.filter(x => x !== b); } continue; }
      }
      else if (b.root.scaling.x < 1) b.root.scaling.setAll(Math.min(1, b.root.scaling.x + dt * 4));
      const d = b.target.subtract(b.root.position); d.y = 0;
      if (d.length() < .1 && !this.absorbInto) { b.target = this.randomPoint(); continue; }
      d.normalize(); b.root.position.addInPlace(d.scale(dt * b.speed));
      const want = Math.atan2(d.x, d.z); let diff = want - b.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); b.root.rotation.y += diff * Math.min(1, dt * 6);
      b.root.position.y = Math.abs(Math.sin(b.t * 14)) * .03;
    }
  }

  private animateSmash(b: LiveBug, dt: number) {
    b.dying! += dt; const t = b.dying!;
    const h = b.hammer;
    if (h) {
      if (t < .22) h.position.y = 1.6 - (t / .22) * (1.6 - HAMMER_SIZE * .95);          // cae
      else if (t < .7) h.position.y = HAMMER_SIZE * .95 + Math.sin((t - .22) / .48 * Math.PI) * .25; // rebota
      else h.position.y += dt * 3;
    }
    if (t >= .22) { b.root.scaling.set(1.35, .18, 1.35); }                                  // aplastado
    if (t > 1.1) { this.dispose(b); this.bugs = this.bugs.filter(x => x !== b); }
  }

  private dispose(b: LiveBug) { b.root.dispose(false, true); b.hammer?.dispose(false, true); }
  private randomPoint() { return new Vector3(rand(AREA.minX, AREA.maxX), 0, rand(AREA.minZ, AREA.maxZ)); }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

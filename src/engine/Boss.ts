import { Color3, Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { ASSETS, assetUrl } from '../assets/AssetRegistry';
import { placeModel } from '../assets/ModelLoader';

export const BOSS = { name: 'BUGZILLA', title: 'Señor de Producción', height: 4.4, spot: new Vector3(2, 0, 2.6) };
const RISE = 1.9;

/**
 * El jefe final: un bug gigante que emerge del suelo cuando pierdes la partida.
 * Sale de una grieta roja, tiembla al subir y luego respira amenazante.
 */
export class BossBug {
  private root?: TransformNode; private crack?: Mesh; private crackMat?: StandardMaterial; private t = 0;
  constructor(private scene: Scene, private shadows: ShadowGenerator) {}

  get active() { return !!this.root; }
  /** 0 → 1 mientras emerge (para el temblor de cámara). */
  get rising() { return this.root ? Math.max(0, 1 - this.t / RISE) : 0; }

  summon(faceYaw: number) {
    this.dispose(); this.t = 0;
    const root = this.root = new TransformNode('boss-bug', this.scene);
    root.position.set(BOSS.spot.x, -BOSS.height, BOSS.spot.z); root.rotation.y = faceYaw;
    // Grieta brillante en el suelo.
    const crack = this.crack = MeshBuilder.CreateDisc('boss-crack', { radius: 3.4, tessellation: 40 }, this.scene);
    crack.rotation.x = Math.PI / 2; crack.position.set(BOSS.spot.x, .035, BOSS.spot.z); crack.scaling.setAll(.01); crack.isPickable = false;
    const m = this.crackMat = new StandardMaterial('boss-crack-mat', this.scene); m.disableLighting = true; m.diffuseColor = Color3.Black(); m.emissiveColor = Color3.FromHexString('#ff2a3a'); m.alpha = .6; crack.material = m;
    void placeModel(this.scene, assetUrl(ASSETS.shared.boss), root, { fit: 'height', size: BOSS.height })
      .then(p => p.meshes.forEach(mesh => { mesh.isPickable = false; this.shadows.addShadowCaster(mesh, false); }))
      .catch(e => console.warn('No se pudo cargar el jefe final', e));
  }

  update(dt: number) {
    const r = this.root; if (!r) return;
    this.t += dt; const t = this.t;
    const k = Math.min(1, t / RISE); const ease = 1 - Math.pow(1 - k, 3);
    const shake = (1 - k) * .09;
    r.position.set(BOSS.spot.x + (Math.random() - .5) * shake, -BOSS.height * (1 - ease), BOSS.spot.z + (Math.random() - .5) * shake);
    if (k >= 1) {
      // Respira y se balancea.
      const b = Math.sin(t * 2.2);
      r.scaling.set(1 - b * .012, 1 + b * .025, 1 - b * .012);
      r.rotation.z = Math.sin(t * 1.1) * .03;
    }
    if (this.crack && this.crackMat) {
      this.crack.scaling.setAll(Math.min(1, t * 1.6));
      this.crackMat.alpha = .35 + Math.sin(t * 5) * .15 + (1 - k) * .3;
    }
  }

  dispose() { this.root?.dispose(false, true); this.crack?.dispose(false, true); this.root = undefined; this.crack = undefined; }
}

import '@babylonjs/loaders/glTF';
import { AbstractMesh, AssetContainer, Scene, SceneLoader, TransformNode, Vector3 } from '@babylonjs/core';

export type FitAxis = 'height' | 'width' | 'depth' | 'max';

export interface PlaceOptions {
  /** Qué medida del modelo se ajusta a `size`. */
  fit: FitAxis;
  size: number;
  /** Corrección de orientación propia del archivo (radianes). */
  yaw?: number;
  pitch?: number;
  roll?: number;
  /** Identificador que se guarda en `mesh.metadata.pick` para los clics. */
  pick?: string;
  /** Objeto que nunca se mueve: se congela su matriz y su material (más rápido). */
  isStatic?: boolean;
}

export interface PlacedModel { node: TransformNode; meshes: AbstractMesh[]; size: Vector3; }

/**
 * Cada archivo se descarga UNA sola vez (AssetContainer) y se clona tantas veces
 * como haga falta compartiendo geometría y texturas. Las descargas se limitan a
 * unas pocas en paralelo para no saturar el navegador.
 */
const containers = new Map<string, Promise<AssetContainer>>();
/** Progreso de carga para la pantalla de carga. */
export const loadStats = { requested: 0, finished: 0 };
const MAX_PARALLEL = 4;
let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(job: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>(resolve => waiting.push(resolve));
  active++;
  try { return await job(); } finally { active--; waiting.shift()?.(); }
}

function loadContainer(scene: Scene, url: string): Promise<AssetContainer> {
  let pending = containers.get(url);
  if (!pending) {
    const cut = url.lastIndexOf('/') + 1;
    pending = withSlot(() => SceneLoader.LoadAssetContainerAsync(url.slice(0, cut), url.slice(cut), scene));
    pending.catch(() => containers.delete(url));
    containers.set(url, pending);
  }
  return pending;
}

/**
 * Coloca un modelo glTF bajo `parent`:
 *  parent → fit (escala + centrado, base en y=0) → orient (corrección del archivo) → __root__ del glTF.
 * El nodo __root__ conserva su conversión de ejes del glTF (no se toca), así los
 * modelos no quedan espejados ni con las caras invertidas.
 */
export async function placeModel(scene: Scene, url: string, parent: TransformNode, opts: PlaceOptions): Promise<PlacedModel> {
  loadStats.requested++;
  try { return await placeModelInner(scene, url, parent, opts); } finally { loadStats.finished++; }
}

async function placeModelInner(scene: Scene, url: string, parent: TransformNode, opts: PlaceOptions): Promise<PlacedModel> {
  const container = await loadContainer(scene, url);
  const tag = parent.name;
  const entries = container.instantiateModelsToScene(name => `${tag}:${name}`, false, { doNotInstantiate: true });

  const fit = new TransformNode(`${tag}:fit`, scene);
  const orient = new TransformNode(`${tag}:orient`, scene);
  orient.parent = fit;
  orient.rotation.set(opts.pitch ?? 0, opts.yaw ?? 0, opts.roll ?? 0);
  entries.rootNodes.forEach(node => { node.parent = orient; });

  const meshes: AbstractMesh[] = [];
  for (const node of entries.rootNodes) {
    if (node instanceof AbstractMesh) meshes.push(node);
    meshes.push(...node.getChildMeshes(false));
  }

  // Medir con el nodo fit en el origen y sin escala.
  fit.computeWorldMatrix(true);
  orient.computeWorldMatrix(true);
  for (const node of entries.rootNodes) {
    node.computeWorldMatrix(true);
    node.getDescendants(false).forEach(d => (d as TransformNode).computeWorldMatrix?.(true));
  }
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    if (!mesh.getTotalVertices()) continue;
    const box = mesh.getBoundingInfo().boundingBox;
    min.minimizeInPlace(box.minimumWorld);
    max.maximizeInPlace(box.maximumWorld);
  }
  if (!Number.isFinite(min.x)) throw new Error(`El modelo ${url} no contiene geometría.`);

  const dims = max.subtract(min);
  const measured = opts.fit === 'height' ? dims.y : opts.fit === 'width' ? dims.x : opts.fit === 'depth' ? dims.z : Math.max(dims.x, dims.y, dims.z);
  const scale = opts.size / Math.max(measured, 1e-4);
  fit.scaling.setAll(scale);
  fit.position.set(-(min.x + max.x) / 2 * scale, -min.y * scale, -(min.z + max.z) / 2 * scale);
  fit.parent = parent;

  for (const mesh of meshes) {
    mesh.setEnabled(true);
    mesh.isVisible = true;
    mesh.isPickable = true;
    mesh.receiveShadows = true;
    if (opts.pick) mesh.metadata = { ...(mesh.metadata ?? {}), pick: opts.pick };
    if (opts.isStatic) { const chain: TransformNode[] = []; for (let n: any = mesh; n; n = n.parent) chain.unshift(n); chain.forEach(n => n.computeWorldMatrix(true)); mesh.freezeWorldMatrix(); mesh.doNotSyncBoundingInfo = true; mesh.material?.freeze(); }
  }
  return { node: fit, meshes, size: dims.scale(scale) };
}

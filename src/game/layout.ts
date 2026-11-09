import { Vector3 } from '@babylonjs/core';
import type { Role } from './store';

/**
 * Distribución de la oficina. Todo lo que pertenece a un puesto se coloca en
 * coordenadas LOCALES del puesto: el origen es el centro de la silla en el suelo
 * y el gato sentado mira hacia +Z local (hacia su escritorio y su monitor).
 * `yaw` gira el puesto entero: 0 = mira a la pared del fondo, PI/2 = mira a +X.
 */
export interface Station { key: Role; label: string; x: number; z: number; yaw: number; }

export const STATIONS: Record<Role, Station> = {
  junior: { key: 'junior', label: 'JUNIOR', x: 0, z: -4.6, yaw: 0 },
  senior: { key: 'senior', label: 'SENIOR', x: 6, z: -4.6, yaw: 0 },
  pm: { key: 'pm', label: 'PM', x: -10.6, z: -1.5, yaw: -Math.PI / 2 },
  qa: { key: 'qa', label: 'QA', x: 8.4, z: 4.6, yaw: Math.PI / 2 }
};

/** Medidas comunes (en unidades de mundo; un gato de pie mide CAT_HEIGHT). */
export const CAT_HEIGHT = 1.55;
export const DESK = { width: 2.5, depth: 1.1, top: 0.9, thickness: 0.08, centerZ: 0.95 };
export const CHAIR_HEIGHT = 1.25;
/** Altura a la que se coloca la base del modelo del gato cuando está sentado (las patas quedan dentro del asiento). */
export const SEATED_Y = 0.24;
/** El gato se sienta un poco adelantado respecto al centro de la silla. */
export const SEAT_FORWARD = 0.06;

/** Convierte un punto local del puesto a coordenadas de mundo. */
export function stationPoint(s: Station, lx: number, lz: number, y = 0): Vector3 {
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
  return new Vector3(s.x + lx * c + lz * sn, y, s.z - lx * sn + lz * c);
}

/** Punto (en el suelo) donde el gato se sienta en su puesto. */
export const seatOf = (s: Station) => stationPoint(s, 0, SEAT_FORWARD);

/** Lugares de la oficina a los que caminan los gatos, con la orientación al llegar. */
export const SPOTS = {
  coffee: { pos: new Vector3(-11.3, 0, 8.15), yaw: 0 },
  servers: { pos: new Vector3(9.7, 0, -1), yaw: Math.PI / 2 },
  /** De pie junto al puesto de Michi Jr., mirando su monitor. */
  review: { pos: stationPoint(STATIONS.junior, 1.45, 0.2), yaw: -0.55 }
};

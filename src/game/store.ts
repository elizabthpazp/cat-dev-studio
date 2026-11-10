export type Role = 'junior' | 'senior' | 'pm' | 'qa';
export type TaskStatus = 'pending' | 'working' | 'completed';
export interface Task { id: string; name: string; desc: string; role: Role; duration: number; progress: number; status: TaskStatus; }
export interface Cat { id: Role; name: string; title: string; energy: number; stress: number; xp: number; color: string; state: string; coffeeCooldown: number; }
export type Outcome = { won: boolean; reason: string; stars: number };
export interface State {
  day: number; time: number; selected: Role; cats: Record<Role, Cat>; tasks: Task[];
  bugs: number; budget: number; morale: number; log: string[]; outcome?: Outcome;
}

export const ROLES: Role[] = ['junior', 'senior', 'pm', 'qa'];
export const START_TIME = 8 * 60 + 40;
export const DEADLINE = 18 * 60;
/** Segundos reales que dura un minuto de juego. La jornada completa dura ≈ 4 min 40 s. */
export const SECONDS_PER_MINUTE = 0.5;
export const MAX_BUGS = 5;
export const COFFEE_COST = 4;
export const COFFEE_COOLDOWN = 25;
/** Presupuesto que cuesta aplastar un bug con el martillo. */
export const SMASH_COST = 10;

function fresh(): State {
  const cat = (id: Role, name: string, title: string, color: string, energy: number, stress: number): Cat => ({ id, name, title, energy, stress, xp: 0, color, state: 'En su puesto', coffeeCooldown: 0 });
  return {
    day: 1, time: START_TIME, selected: 'pm', bugs: 0, budget: 100, morale: 72,
    cats: {
      junior: cat('junior', 'Michi Jr.', 'Dev junior', '#e8a35b', 86, 18),
      senior: cat('senior', 'Gatardo', 'Dev senior', '#9a6b54', 66, 38),
      pm: cat('pm', 'Michi PM', 'Project manager', '#6f8da8', 78, 27),
      qa: cat('qa', 'Doña QA', 'QA engineer', '#76a77b', 74, 22)
    },
    // Los hitos van en cadena: siempre hay un único hito activo (el primero sin completar).
    tasks: [
      { id: 'spec', name: 'Aterrizar el encargo', desc: 'El cliente cambió el brief por tercera vez. Michi PM necesita una decisión clara.', role: 'pm', duration: 10, progress: 0, status: 'pending' },
      { id: 'feature', name: 'Construir la feature', desc: 'Una función sencilla. En teoría. Michi Jr. necesita una pista.', role: 'junior', duration: 16, progress: 0, status: 'pending' },
      { id: 'review', name: 'Revisión de código', desc: 'Gatardo debe encontrar el cambio que no debería llegar a producción.', role: 'senior', duration: 12, progress: 0, status: 'pending' },
      { id: 'qa', name: 'Pruebas de QA', desc: 'Doña QA huele un error escondido. Decide qué probar primero.', role: 'qa', duration: 14, progress: 0, status: 'pending' },
      { id: 'deploy', name: 'Despliegue seguro', desc: 'Coordina una secuencia limpia antes de que acabe la jornada.', role: 'senior', duration: 10, progress: 0, status: 'pending' }
    ],
    log: ['08:40 · El sprint comienza. El café no.']
  };
}

const SAVE_KEY = 'cat-dev-save-v2';
let state: State = fresh();

export const game = {
  get: () => state,
  reset() { state = fresh(); },
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ } },
  hasSave(): boolean { try { const raw = localStorage.getItem(SAVE_KEY); return !!raw && !JSON.parse(raw).outcome; } catch { return false; } },
  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
      const data = JSON.parse(raw) as State; if (data.outcome) return false;
      state = { ...fresh(), ...data };
      // Un hito a medias se retoma como pendiente para volver a lanzarlo con su pergamino.
      state.tasks.forEach(t => { if (t.status === 'working') { t.status = 'pending'; t.progress = 0; } });
      return true;
    } catch { return false; }
  },
  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* nada */ } }
};

export const activeTask = (s: State) => s.tasks.find(t => t.status !== 'completed');
export const completedCount = (s: State) => s.tasks.filter(t => t.status === 'completed').length;
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
export function log(s: State, text: string) { s.log.push(`${clock(s.time)} · ${text}`); if (s.log.length > 30) s.log.shift(); }

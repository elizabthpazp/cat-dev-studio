export const ASSETS = {
  characters: { junior: 'characters/junior_cat.glb', senior: 'characters/senior_cat.glb', pm: 'characters/project_manager_cat.glb', qa: 'characters/qa_cat.glb' },
  workstations: {
    junior: { monitor: 'props/junior_monitor.glb', computer: 'props/junior_desktop_computer.glb', chair: 'props/junior_chair.glb', keyboard: 'props/junior_keyboard.glb', mouse: 'props/junior_mouse.glb', headset: 'props/junior_headsetphones.glb', cup: 'props/junior_coffee_cup.glb', lamp: 'props/desk_lamp.glb' },
    senior: { monitor: 'props/senior_monitor.glb', computer: 'props/generic_desktop_computer.glb', chair: 'props/office_chair.glb', keyboard: 'props/blue_keyboard.glb', mouse: 'props/computer_mouse.glb', headset: 'props/headset_phones.glb', cup: 'props/coffee_cup.glb', lamp: 'props/generic_lamp.glb' },
    pm: { monitor: 'props/pm_monitor.glb', computer: 'props/pm_desktop_computer.glb', chair: 'props/pm_chair.glb', keyboard: 'props/keyboard.glb', mouse: 'props/computer_mouse.glb', headset: 'props/headset_phones.glb', cup: 'props/coffee_cup.glb', lamp: 'props/generic_lamp.glb' },
    qa: { monitor: 'props/qa_monitor.glb', computer: 'props/generic_desktop_computer.glb', chair: 'props/office_chair.glb', keyboard: 'props/keyboard.glb', mouse: 'props/computer_mouse.glb', headset: 'props/headset_phones.glb', cup: 'props/coffee_cup.glb', lamp: 'props/generic_lamp.glb' }
  },
  shared: {
    coffeeMachine: 'props/coffee_machine_real.glb',
    meetingChair: 'props/office_chair.glb',
    mug: 'props/coffee_cup.glb',
    pawMug: 'props/junior_coffee_cup.glb',
    spareHeadset: 'props/junior_headsetphones.glb',
    meetingTable: 'props/desk_natural.glb',
    whiteboard: 'props/whiteboard.glb',
    plant: 'props/indoor_plant.glb',
    serverRack: 'props/server_rack.glb',
    serverTower: 'props/server_tower.glb',
    fileStorage: 'props/file_storage.glb',
    organizer: 'props/desk_organizer.glb',
    bug: 'props/bug.glb',
    hammer: 'props/hammer.glb',
    boss: 'props/final_boss_bug.glb'
  },
  /** Mesa de cada puesto. */
  desks: { junior: 'props/desk_pink.glb', senior: 'props/desk_black.glb', pm: 'props/desk_natural.glb', qa: 'props/desk_natural.glb' }
} as const;

export type WorkstationSlot = keyof typeof ASSETS.workstations.junior;

/**
 * Los modelos (Tripo) miran hacia +Z: la cara del gato, la pantalla del monitor,
 * el asiento de la silla y el lado del usuario del teclado. Aquí se corrigen los
 * archivos que no siguen esa convención.
 */
export const MODEL_FIXES: Record<string, { yaw?: number; pitch?: number; roll?: number }> = {
  'props/pm_chair.glb': { yaw: Math.PI / 2 },          // viene mirando de lado (-X)
  'props/junior_keyboard.glb': { pitch: -0.906 },      // viene inclinado ~52° como foto de producto
  'props/computer_mouse.glb': { yaw: Math.PI },        // el cable/botones apuntan a -Z
  'props/headset_phones.glb': { yaw: Math.PI / 2 },    // de pie con las orejeras en ±Z
  'props/desk_black.glb': { yaw: Math.PI / 2 },        // su lado largo viene en Z
  'props/server_rack.glb': { yaw: -Math.PI / 2 }       // fila de racks a lo largo de Z con el frente hacia +X → frente a +Z
};

export const assetUrl = (file: string) => `/assets/${file}`;

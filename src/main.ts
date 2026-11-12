import { Game } from './game/Game';
import * as store from './game/store';
import './ui/styles.css';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const root = document.getElementById('ui-root') as HTMLDivElement;
try { const game = new Game(canvas, root); game.start(); if (import.meta.env.DEV) Object.assign(window, { __game: game, __store: store }); }
catch (error) { console.error(error); root.innerHTML = `<div style="padding:32px;color:#f6f0df;background:#171b2e;font:16px sans-serif">No se pudo iniciar la oficina 3D.<br><small style="color:#e8785e">${String(error)}</small></div>`; }

export interface Challenge { question: string; code: string; correct: string; wrong: string[]; why: string; }

/** Una decisión por hito. Las opciones se barajan cada vez que se abre el pergamino. */
export const CHALLENGES: Record<string, Challenge> = {
  spec: {
    question: 'El cliente dice: «hazlo más viral». ¿Qué hace un PM que quiere que el equipo sobreviva?',
    code: 'Cliente: «que sea más viral»\nFecha límite: hoy · alcance: ???',
    correct: 'Pedir una métrica y un caso de uso concreto',
    wrong: ['Prometer una red social completa para mañana', 'Abrir un canal nuevo para debatirlo sin fin'],
    why: 'Sin una métrica no hay forma de saber cuándo el trabajo está terminado.'
  },
  feature: {
    question: 'Michi Jr. va a pulsar «merge». ¿Qué pista evita el bug?',
    code: 'if (usuario) {\n  enviarFactura(usuario.email)\n}',
    correct: 'Validar que usuario.email exista antes de enviar',
    wrong: ['Cambiar el nombre de la variable', 'Añadir tres emojis al commit'],
    why: 'Un usuario puede existir sin email: la factura fallaría en producción.'
  },
  review: {
    question: 'Gatardo encuentra este cambio justo antes del merge. ¿Qué hace?',
    code: 'const API_KEY = "prod-super-secret";\nfetch("/api", { headers: { API_KEY } })',
    correct: 'Bloquearlo: el secreto va en variables de entorno',
    wrong: ['Aprobarlo si la descripción del PR es buena', 'Comentar «LGTM» e ir por café'],
    why: 'Una clave en el código queda en el historial para siempre.'
  },
  qa: {
    question: 'Doña QA quiere encontrar el mayor riesgo antes del despliegue. ¿Qué prueba primero?',
    code: 'Nueva función: editar perfiles\nCambio: validación de permisos',
    correct: 'Que otro usuario no pueda editar perfiles ajenos',
    wrong: ['Que el botón tenga un color bonito', 'Cerrar el navegador y confiar'],
    why: 'Un fallo de permisos es el bug más caro de este cambio.'
  },
  deploy: {
    question: 'El monitor está en rojo. ¿Cuál es el ritual correcto para llegar a producción?',
    code: '[ ] Build   [ ] Tests   [ ] Migración\n[ ] Configuración   [ ] Verificación',
    correct: 'Tests → Build → Configurar → Migrar → Desplegar → Verificar',
    wrong: ['Desplegar → Migrar → pedir perdón', 'Configurar producción desde el móvil'],
    why: 'Primero se comprueba, luego se construye y al final se verifica en vivo.'
  }
};

export function shuffledOptions(c: Challenge) {
  const options = [{ text: c.correct, ok: true }, ...c.wrong.map(text => ({ text, ok: false }))];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return options;
}

---
name: sdd
description: Spec-Driven Development method for AppCasa — phases, approval gates, EARS requirement format and spec/plan/tasks rules. Use when writing, reviewing, planning or implementing anything under docs/specs/, or when a new domain feature is about to start.
user-invocable: false
---

# Método SDD de AppCasa

Fuente única del método. Motivos y alcance: `docs/adr/0007-spec-driven-development.md`. Plantillas: `docs/specs/_templates/`.

## Cuándo se aplica

- **Sí:** funcionalidades de dominio con reglas de negocio (auth, hogares, tareas, gastos, listas, notificaciones).
- **No:** infraestructura o decisiones transversales (→ ADR), y cambios pequeños o arreglos (→ rama + PR normal). Si dudas, pregunta al autor.

## Fases

```
Spec → Clarificación → [aprobación] → Plan + Tareas → [aprobación] → Implementación → Validación
```

| Fase | Comando | Estado |
|---|---|---|
| Spec | `/sdd-spec <NNN-capacidad> <idea>` | disponible |
| Clarificación | `/sdd-clarify <NNN-capacidad>` | disponible (subagente `reviewer`) |
| Plan + tareas | `/sdd-plan` | pendiente de crear |
| Implementación | `/sdd-implement <Tn>` | pendiente de crear |
| Validación | `/sdd-validate` | pendiente de crear |
| Cambio | `/sdd-change` | pendiente de crear |

Mientras un comando no exista, la fase se hace en conversación siguiendo estas mismas reglas.

## Reglas

1. **No se pasa de fase sin aprobación explícita del autor.** Solo el autor cambia el estado de una spec a `aprobada`.
2. **La spec manda.** Lo que no está en la spec no se implementa. Si falta una decisión, se para y se pregunta.
3. **Los cambios entran por arriba:** primero spec, luego plan y tareas, por último código.
4. **El autor decide y revisa; Claude redacta.** En la spec, Claude pregunta y ofrece opciones con trade-offs; tras cada decisión redacta el requisito, explica qué conviene revisar (qué hueco cierra cada parte) y el autor lo confirma o corrige. Claude no introduce reglas de negocio que el autor no haya decidido: una decisión pendiente se marca `[NECESITA ACLARACIÓN]`. (Desde 2026-11-23; antes redactaba el autor. Variante prevista en ADR-0007.)
5. **Una tarea cada vez:** tests primero (en rojo), código hasta verde, marcar `[x]`, parar.
6. **Trazabilidad:** cada test que cubre un requisito lo nombra por su id, p. ej. `it('RF-3: rejects an expired invitation')`.
7. **Estado del proyecto:** `docs/STATUS.md` apunta a la spec activa pero no copia su progreso; el avance de tareas vive solo en `tasks.md`.

## spec.md: QUÉ y POR QUÉ

- Sin tecnología: nada de tablas, endpoints, librerías ni ficheros.
- Secciones (ver plantilla): contexto y objetivo · usuarios · definiciones · historias de usuario (`HU-n`) · requisitos funcionales (`RF-n`) · no funcionales (`RNF-n`) · casos límite · fuera de alcance · criterios de finalización · dudas abiertas.
- Estados: `borrador` → `aprobada` → `implementada`.

### Requisitos en EARS

| Patrón | Uso |
|---|---|
| `CUANDO <evento>, EL SISTEMA <respuesta>.` | Reacción a un evento |
| `SI <condición no deseada>, ENTONCES EL SISTEMA <respuesta>.` | Errores y rechazos |
| `MIENTRAS <estado>, EL SISTEMA <respuesta>.` | Comportamiento dependiente de estado |
| `EL SISTEMA <comportamiento>.` | Siempre se cumple (invariante) |

Un buen RF:
- describe **un** comportamiento observable desde fuera;
- es **verificable**: se puede escribir un test que pase o falle sin interpretación;
- no usa palabras vagas ("rápido", "fácil", "adecuado", "etc.") sin un criterio concreto;
- indica la HU que cubre.

Ejemplo: `SI un usuario acepta una invitación caducada, ENTONCES EL SISTEMA rechaza la aceptación e indica que la invitación ha caducado.`

## plan.md: CÓMO

Diseño, no listado de ficheros: módulos afectados, modelo de datos, contrato de API, flujos y consistencia (transacciones, concurrencia, idempotencia, eventos), seguridad y aislamiento entre hogares, decisiones con su alternativa descartada, estrategia de tests por RF, riesgos. Cada parte indica qué RF cubre. Una decisión que afecte a más de esta funcionalidad se convierte en ADR.

## tasks.md: tareas

- Máximo 10, de 20–30 min, en orden de dependencia. Si salen más, se propone dividir la spec.
- Formato:
  ```
  - [ ] **Tn. <Descripción>.** RF-x, RF-y · Responsable: autor | claude
    - Hecho cuando: <comprobación verificable>.
  ```
- Responsable `autor` para la lógica de dominio que conviene que el autor escriba; `claude` para infraestructura y código repetitivo.

## Git

Una rama por spec (`feat/NNN-capacidad`), un commit por tarea, PR al validar la spec.

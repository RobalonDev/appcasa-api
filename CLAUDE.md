# CLAUDE.md

@AGENTS.md

@docs/STATUS.md

## Proyecto

AppCasa: backend de un gestor del hogar (miembros de un hogar, tareas, gastos compartidos, listas de la compra). Solo backend; el frontend (web + móvil) irá en otro repo y consumirá esta API.

Además de producto, es un **proyecto de aprendizaje**: el autor es desarrollador backend y quiere crecer en decisiones técnicas, arquitectura, diseño de sistemas y sistemas distribuidos.

## Cómo trabajar en este repo

- **Explica el porqué.** Cada decisión no trivial se justifica con alternativas y trade-offs. Si afecta a la estructura, a una dependencia relevante o a un patrón transversal, se documenta como ADR en `docs/adr/` (ver su README).
- **Reparto de trabajo:** Claude implementa infraestructura y código repetitivo; la lógica de dominio interesante se ofrece primero al autor. Si se atasca, Claude desbloquea con pistas o con código, sin hacerle esperar.
- **Tareas pequeñas** y verificables. Para funcionalidades grandes, plan primero.
- **No añadir dependencias sin preguntar.** Fijar versiones estables (nunca RC/beta aunque npm las marque como `latest`). Nuevos scripts de instalación se aprueban explícitamente en `pnpm-workspace.yaml`.
- **Antes de dar algo por terminado**, ejecutar `pnpm check` (y `pnpm test:e2e` si toca HTTP o base de datos).

## Flujo de trabajo: Spec-Driven Development (ADR-0007)

Las funcionalidades de dominio se especifican antes de programarse. El método completo está en la skill `sdd` (`.claude/skills/sdd/SKILL.md`).

```
/sdd-spec NNN → /sdd-clarify NNN → [aprobación] → /sdd-plan NNN → /sdd-clarify NNN plan → [aprobación] → /sdd-tasks NNN → [aprobación] → implementación (1 tarea cada vez, tests primero) → validación
```

- **El autor decide y revisa; Claude entrevista, ofrece opciones con trade-offs, redacta los requisitos** (explicando qué revisar en cada uno) y hace de QA. Nunca introduce reglas de negocio no decididas por el autor.
- **No se pasa de fase sin aprobación explícita del autor.** La spec manda: lo que no está en ella no se implementa; si falta una decisión, se para y se pregunta.
- Los cambios de requisitos entran primero por la spec, luego plan y tareas, por último código.
- Los tests que cubren un requisito lo citan por su id: `it('RF-3: …')`.
- **No aplica** a infraestructura o decisiones transversales (→ ADR) ni a cambios pequeños (→ rama + PR).

## Comandos

```bash
pnpm install              # también genera el cliente de Prisma (postinstall)
pnpm infra:up             # Postgres en Docker (espera a healthy); infra:down para pararlo
pnpm start:dev            # API en http://localhost:3000 con recarga
pnpm check                # typecheck + lint + format:check + tests unitarios
pnpm test                 # unitarios (*.spec.ts junto al código)
pnpm test:e2e             # e2e (test/*.e2e-spec.ts); requiere infra:up
pnpm db:migrate           # crear/aplicar migración en desarrollo (prisma migrate dev)
pnpm db:generate          # regenerar cliente tras cambiar schema.prisma
pnpm db:studio            # explorar la BD
```

Primera vez: `cp .env.example .env && pnpm install && pnpm --silent keys:generate >> .env && pnpm infra:up`.

## Stack

NestJS 12 (ESM) · TypeScript estricto · Prisma 7 + `@prisma/adapter-pg` · PostgreSQL 18 · Zod · Vitest · oxlint + Prettier · pnpm. Decisiones y motivos en `docs/adr/`.

## Estructura

```
src/
  main.ts             bootstrap (puerto desde config, shutdown hooks)
  app.module.ts       módulo raíz
  config/             esquema Zod de variables de entorno (env.ts)
  database/           PrismaService (global)
  health/             GET /health
  generated/prisma/   cliente Prisma generado: NO editar, ignorado por git
prisma/schema.prisma  modelos y migraciones (prisma/migrations)
test/                 tests e2e
docs/adr/             Architecture Decision Records
docs/specs/           specs SDD (NNN-capacidad/{spec,plan,tasks}.md) y plantillas
docs/STATUS.md        estado del proyecto y errores a evitar (memoria de trabajo)
.claude/skills/       método SDD (sdd) y comandos /sdd-*
.claude/agents/       subagente reviewer (solo lectura)
```

## Convenciones

- **Idioma:** código, identificadores, commits y nombres de ramas en inglés. ADRs y documentación en español.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). Trabajo en ramas `feat/...`, `fix/...` y PR a `main`.
- **ESM:** los imports relativos terminan en `.js`. Usa `import type` para lo que solo es tipo, **excepto** en los tipos que Nest inyecta por constructor (necesitan existir en runtime para los metadatos de DI).
- **TypeScript:** sin `any` (usa `unknown` y estrecha). `noUncheckedIndexedAccess` está activo: los accesos por índice pueden ser `undefined`.
- **Configuración:** toda variable de entorno nueva se añade a `src/config/env.ts` y a `.env.example`. Se lee con `ConfigService<Env, true>` y `get('X', { infer: true })`, nunca con `process.env` directamente en la app.
- **Base de datos:** cambios de esquema solo mediante migraciones de Prisma. Nunca editar una migración ya aplicada; crear una nueva.
- **Arquitectura (ADR-0003):** un módulo Nest por bounded context. Un módulo no accede a tablas ni providers internos de otro: usa su servicio exportado o sus eventos.
- **Multi-tenancy (ADR-0006):** todo dato de dominio pertenece a un hogar (`householdId`) y toda operación verifica la membresía del usuario en ese hogar. Excepción: la identidad (cuentas y sesiones, spec 001) es global y no pertenece a ningún hogar.
- **Tests:** unitarios junto al código (`*.spec.ts`), e2e en `test/`. Lógica de dominio siempre con tests.

## Hoja de ruta

La fase en curso se indica en `docs/STATUS.md`.

0. Base del proyecto
1. Identidad y hogares: auth (JWT + refresh), membresías, invitaciones, roles
2. Tareas: recurrencia, asignación, rotación, jobs programados
3. Gastos compartidos: repartos, saldos, liquidaciones, idempotencia
4. Lista de la compra en tiempo real: WebSockets, concurrencia, Redis pub/sub
5. Notificaciones: eventos de dominio, outbox, colas (BullMQ), worker
6. Producción: observabilidad, rate limiting, caché, despliegue
7. Opcional: extracción de servicios, mensajería, sagas

## Memoria

- `docs/STATUS.md` es la memoria de trabajo del proyecto y se carga automáticamente
  (import al inicio de este fichero).
- Al terminar una tarea, actualízalo: estado actual, decisiones importantes y errores a
  evitar. Las decisiones con su porqué van en un ADR; en `STATUS.md` solo se enlazan.
- Mantenlo breve (máximo ~50 líneas): resume o elimina lo que ya no aporte.
- Si algo se convierte en una regla permanente, propón moverlo a `CLAUDE.md` en lugar de
  dejarlo en la memoria.
- El repo es público: no guardes nunca datos sensibles (claves, tokens, datos personales).
  Las preferencias personales del autor van en la memoria privada de Claude, no aquí.

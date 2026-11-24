# AppCasa — API

Backend de un gestor del hogar: un espacio compartido por los miembros de una familia o por quienes comparten piso para organizar **tareas**, **gastos compartidos** y **listas de la compra**.

Es también un proyecto de aprendizaje de arquitectura y diseño de sistemas: cada decisión técnica relevante está documentada como [ADR](docs/adr/README.md).

## Stack

NestJS 12 (ESM) · TypeScript estricto · Prisma 7 · PostgreSQL 18 · Zod · Vitest · Docker Compose · pnpm

## Puesta en marcha

Requisitos: Node ≥ 24.7, pnpm 11, Docker.

```bash
cp .env.example .env
pnpm install          # instala dependencias y genera el cliente de Prisma
pnpm --silent keys:generate >> .env   # claves JWT y secreto de códigos (ADR-0008)
pnpm infra:up         # levanta PostgreSQL en Docker
pnpm start:dev        # API en http://localhost:3000
curl localhost:3000/health
```

## Scripts principales

| Script | Qué hace |
|---|---|
| `pnpm start:dev` | API con recarga en caliente |
| `pnpm check` | typecheck, lint, formato y tests unitarios |
| `pnpm test:e2e` | tests end-to-end (requiere `pnpm infra:up`) |
| `pnpm db:migrate` | crea y aplica migraciones en desarrollo |
| `pnpm db:studio` | explorador visual de la base de datos |
| `pnpm infra:down` | para los contenedores (los datos se conservan) |

## Hoja de ruta

- [x] **Fase 0** — Base: configuración validada, Prisma, Docker, CI, ADRs
- [ ] **Fase 1** — Identidad y hogares: autenticación, membresías, invitaciones, roles
- [ ] **Fase 2** — Tareas del hogar: recurrencia, asignación y rotación
- [ ] **Fase 3** — Gastos compartidos: repartos, saldos y liquidaciones
- [ ] **Fase 4** — Lista de la compra en tiempo real
- [ ] **Fase 5** — Notificaciones: eventos de dominio, outbox y colas
- [ ] **Fase 6** — Producción: observabilidad, rate limiting, despliegue

## Documentación

- [Decisiones de arquitectura (ADRs)](docs/adr/README.md)

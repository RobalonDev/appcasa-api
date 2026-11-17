# Estado del proyecto

> Memoria de trabajo del proyecto: se carga en cada sesión desde `CLAUDE.md`.
> Máximo ~50 líneas. Las decisiones con su porqué viven en `docs/adr/`; aquí solo se enlazan.

## Estado actual

- Fase 0 (base) completada el 2026-11-16. CI en verde.
- Siguiente: **fase 1 — identidad y hogares**. Empezar por el diseño (modelo de datos, flujo de auth, invitaciones) y su ADR, antes del código.

## Decisiones clave

Ver `docs/adr/`. Resumen: NestJS 12 + Prisma 7 + Postgres 18 (0002), monolito modular (0003), pnpm (0004), auth propia (0005), hogar como tenant (0006).

## Errores a evitar

- npm marca a veces una RC como `latest` (pasó con Prisma 8): comprobar `pnpm view <pkg> dist-tags`.
- `prisma init` instala skills de agentes por defecto: usar `--no-skills`.
- pnpm bloquea los scripts de instalación: aprobarlos en `pnpm-workspace.yaml` (`allowBuilds`).
- `prisma.config.ts` usa `env('DATABASE_URL')`: `prisma generate` (y por tanto `pnpm install`) falla si no está definida. Relevante para Docker y CI.
- Subir ficheros a `.github/workflows/` requiere el scope `workflow` en `gh`.

## Pendiente

- Licencia: se queda `UNLICENSED` (decisión del autor).

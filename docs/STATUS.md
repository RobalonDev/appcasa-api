# Estado del proyecto

> Memoria de trabajo del proyecto: se carga en cada sesión desde `CLAUDE.md`.
> Máximo ~50 líneas. Las decisiones con su porqué viven en `docs/adr/`; aquí solo se enlazan.

## Estado actual

- Fase 0 (base) completada el 2026-11-16. CI en verde.
- SDD ligero adoptado el 2026-11-17 (ADR-0007). Disponibles `/sdd-spec` y `/sdd-clarify`; el resto de comandos se crean al llegar a cada fase.
- Fase en curso: **fase 1 — identidad y hogares**.
- Fase 1 dividida en specs: 001-authentication → 002-households → 003-invitations; además 004-account-management (recuperación/cambio de contraseña, nombre, borrado) antes de desplegar.
- Desde 2026-11-23 Claude redacta los requisitos y el autor decide y revisa (variante prevista en ADR-0007).
- Spec activa: **001-authentication** (borrador, ronda 3 cerrada; rama `feat/001-authentication`). Siguiente: ronda 4 (corta) de `/sdd-spec`, después `/sdd-clarify`.

## Decisiones clave

Ver `docs/adr/`. Resumen: NestJS 12 + Prisma 7 + Postgres 18 (0002), monolito modular (0003), pnpm (0004), auth propia (0005), hogar como tenant (0006), SDD ligero (0007).

## Errores a evitar

- npm marca a veces una RC como `latest` (pasó con Prisma 8): comprobar `pnpm view <pkg> dist-tags`.
- `prisma init` instala skills de agentes por defecto: usar `--no-skills`.
- pnpm bloquea los scripts de instalación: aprobarlos en `pnpm-workspace.yaml` (`allowBuilds`).
- `prisma.config.ts` usa `env('DATABASE_URL')`: `prisma generate` (y por tanto `pnpm install`) falla si no está definida. Relevante para Docker y CI.
- Subir ficheros a `.github/workflows/` requiere el scope `workflow` en `gh`.

## Pendiente

- Licencia: se queda `UNLICENSED` (decisión del autor).

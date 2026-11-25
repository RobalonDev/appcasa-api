# Estado del proyecto

> Memoria de trabajo del proyecto: se carga en cada sesión desde `CLAUDE.md`.
> Máximo ~50 líneas. Las decisiones con su porqué viven en `docs/adr/`; aquí solo se enlazan.

## Estado actual

- Fase 0 (base) completada el 2026-11-16. CI en verde.
- SDD ligero adoptado el 2026-11-17 (ADR-0007). Disponibles `/sdd-spec`, `/sdd-clarify` (spec y plan), `/sdd-plan` y `/sdd-tasks`; el resto de comandos se crean al llegar a cada fase.
- Fase en curso: **fase 1 — identidad y hogares**.
- Fase 1 dividida en specs: 001-authentication → 002-households → 003-invitations; además 004-account-management (recuperación/cambio de contraseña, nombre, borrado) antes de desplegar.
- Desde 2026-11-23 Claude redacta los requisitos y el autor decide y revisa (variante prevista en ADR-0007).
- Spec activa: **001-authentication**. Spec, plan (ADR-0008 a 0013) y tareas aprobados y en main (PR #4). 19 tareas en 3 entregas; todas las implementa Claude.
  - **Entrega A (T1–T9) terminada** en `feat/001-authentication-a`, sin subir: pendiente de push y PR (el commit de T2 toca `.github/workflows/`).
  - Entregas B y C en ramas locales apiladas (`-b` sale de `-a`, `-c` de `-b`); se rebasan sobre main al mergear cada una. Avance en `tasks.md`.

## Decisiones clave

Ver `docs/adr/`. Resumen: NestJS 12 + Prisma 7 + Postgres 18 (0002), monolito modular (0003), pnpm (0004), auth propia (0005), hogar como tenant (0006), SDD ligero (0007), diseño de la autenticación (0008), emails en segundo plano (0009), límites con bloqueo por clave (0010), errores RFC 9457 y UUIDv7 (0011), denegar por defecto y reloj inyectable (0012), envío reservar–enviar–confirmar (0013).

## Errores a evitar

- npm marca a veces una RC como `latest` (pasó con Prisma 8): comprobar `pnpm view <pkg> dist-tags`.
- `prisma init` instala skills de agentes por defecto: usar `--no-skills`.
- pnpm bloquea los scripts de instalación: aprobarlos en `pnpm-workspace.yaml` (`allowBuilds`).
- `prisma.config.ts` usa `env('DATABASE_URL')`: `prisma generate` (y por tanto `pnpm install`) falla si no está definida. Relevante para Docker y CI.
- Subir ficheros a `.github/workflows/` requiere el scope `workflow` en `gh`.
- `AggregateError` en todos los e2e = Postgres no responde: Docker parado. `open -a Docker && pnpm infra:up`.
- Al escribir ficheros, Claude puede convertir los escapes `\uXXXX` en caracteres invisibles (acentos combinados, espacios raros): en los tests de Unicode, comprobar con `cat -v` que el escape sigue escrito.
- El reviewer (y cualquier subagente) ve el `CLAUDE.md` y sus imports, como este `STATUS.md`, tal como se cargaron al iniciar la sesión: si `STATUS.md` cambia, reiniciar la sesión para que lo vea actualizado.

## Pendiente

- Limpieza de datos de autenticación caducados (eventos de límites, códigos, sesiones finalizadas): fase 2, antes de desplegar (plan 001, E5).
- Licencia: se queda `UNLICENSED` (decisión del autor).

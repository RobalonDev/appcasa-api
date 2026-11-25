# Tareas 001: Autenticación

- **Estado:** aprobadas <!-- borrador | aprobadas -->
- **Aprobadas por el autor** el 2026-11-24.
- **Plan:** [plan.md](plan.md) (debe estar `aprobado`)
- **Fecha:** 2026-11-24
- **Responsables:** el autor pidió que Claude implemente todas las tareas (2026-11-24). Se puede cambiar sobre la marcha.

<!--
Una tarea es un comportamiento o una pieza que se puede verificar por sí sola:
- lleva un puñado de tests (orientativo: hasta ~1 h de trabajo y ~10 tests);
- acaba en un commit con `pnpm check` en verde, y `pnpm test:e2e` si toca HTTP o la base de datos;
- si necesita más, se parte en dos.

Orden: el de las dependencias. Como máximo 10 tareas por entrega. Cada entrega tiene su rama, que sale
de main, y su PR, y valida sus propios RF.

«Plan:» y «Ficheros:» apuntan al diseño, no lo copian. «§» = sección de plan.md.

Cada tarea: tests primero (en rojo), luego código hasta verde, marcar [x] y parar.
-->

## Entregas

| Entrega | Rama | Valida por completo | Tareas |
|---|---|---|---|
| A — Base y solicitud de registro | `feat/001-authentication-a` | RF-1, 6, 7, 12, 32, 34, 38, 40, 42 | T1–T9 |
| B — Completar el registro | `feat/001-authentication-b` | RF-4, 5, 9, 10, 11, 15, 16, 23–25, 27–30, 37, 41, RNF-5, D20 | T10–T14 |
| C — Sesiones y requisitos globales | `feat/001-authentication-c` | RF-13, 17–22, 26, 31, 33, 35, 36, 39, RNF-1–4 | T15–T19 |

Los RF con parte unitaria y parte e2e se cierran en la entrega donde existe su ruta (p. ej. RF-15: T7 + T13; RF-22: T7 + T15; RF-35: T5, T8, T13 y T15).

## Entrega A — Base y solicitud de registro (`feat/001-authentication-a`)

- [x] **T1. Base transversal de la app.** ADR-0011, ADR-0012 · Responsable: claude
  - Plan: §Módulos afectados (Infraestructura compartida).
  - Ficheros: `src/http/` (`ProblemDetailsFilter`, `configureApp`, `public.decorator.ts`), `src/clock/`, `src/main.ts`, `src/database/prisma.service.ts` (desconexión en `onApplicationShutdown`), `vitest.config.e2e.ts` (`fileParallelism: false`), `test/app.e2e-spec.ts`.
  - Hecho cuando: tests unitarios del filtro (cuerpo `application/problem+json` con `code`; `VALIDATION_FAILED` con `errors[]`) y del reloj controlable en verde; el e2e de `/health` usa `configureApp`; `pnpm check` y `pnpm test:e2e` pasan.
- [x] **T2. Configuración y claves.** ADR-0008, ADR-0009 · Responsable: claude
  - Plan: §Configuración y entorno local.
  - Ficheros: `src/config/env.ts` (+ `env.spec.ts`), `.env.example`, `scripts/generate-secrets.ts` (`pnpm keys:generate`), `.github/workflows/ci.yml` (secretos generados con el mismo script), `package.json` (`engines.node`).
  - Hecho cuando: `env.spec.ts` cubre las variables nuevas (válidas y no válidas); `pnpm keys:generate` imprime un par Ed25519 utilizable; `pnpm check` pasa.
- [x] **T3. Esquema de datos y bloqueo por email.** RF-40 · Responsable: claude
  - Plan: §Modelo de datos; §Módulos afectados (`src/database/`).
  - Ficheros: `prisma/schema.prisma`, `prisma/migrations/…` (con el índice único parcial en SQL), `src/database/lock-key.ts`.
  - Hecho cuando: test `RF-40` (insertar un email duplicado falla en la BD) y tests de que `lockKey` serializa dos transacciones con la misma clave y no bloquea claves distintas, en verde; único parcial sobre `ACTIVE` comprobado; `pnpm check` y `pnpm test:e2e` pasan.
- [x] **T4. Envío de correo.** ADR-0009 · Responsable: claude
  - Plan: §Módulos afectados (`src/mail/`); §Configuración (Mailpit).
  - Ficheros: `src/mail/` (`MailSender`, `SmtpMailSender`, `InMemoryMailSender`, módulo), `docker-compose.yml` (`mailpit`), dependencia `nodemailer`.
  - Hecho cuando: tests unitarios de `InMemoryMailSender` (registra enviados, simula fallo, resultado incierto y retardo) en verde; con `pnpm infra:up`, un envío de prueba aparece en Mailpit (`localhost:8025`); `pnpm check` pasa.
- [x] **T5. Email y código de verificación (dominio).** RF-26, RF-34, RF-35 · Responsable: claude
  - Plan: §Flujos (Normalización); §Módulos afectados (`domain/`).
  - Ficheros: `src/identity/domain/email.ts`, `verification-code.ts` (+ `*.spec.ts`).
  - Hecho cuando: tests unitarios `RF-26` (mayúsculas y espacios Unicode en los extremos), `RF-35` (formato, > 254, ausente; casos de E2) y `RF-34` (6 dígitos con ceros a la izquierda) en verde; `pnpm check` pasa.
- [x] **T6. Criptografía: hash de contraseñas y tokens.** RF-33, RF-39 · Responsable: claude
  - Plan: §Módulos afectados (`crypto/`); §Contrato de API (contenido y verificación del JWT); ADR-0008.
  - Ficheros: `src/identity/crypto/password-hasher.ts`, `tokens.service.ts` (+ `*.spec.ts`), dependencia `jose`.
  - Hecho cuando: tests unitarios en verde: argon2id PHC verifica y rechaza, `needsRehash`, hash ficticio; `RF-39` (NFC y NFD verifican igual; ancho completo no); JWT EdDSA válido y rechazo de manipulado, otro algoritmo, `iss`/`aud` erróneos y caducado (`RF-33`); refresh de 32 bytes y su SHA-256; HMAC de código; `pnpm check` pasa.
- [x] **T7. Ventana con bloqueo posterior.** RF-15, RF-22, RF-31 · Responsable: claude
  - Plan: §Flujos (Ventana con bloqueo posterior).
  - Ficheros: `src/identity/domain/attempt-window.ts` (+ `.spec.ts`).
  - Hecho cuando: tests unitarios `RF-15` (10 fallos en 24 h; bloqueado hasta 24 h tras el décimo, en ambos bordes), `RF-22` (5 fallos en 15 min sin éxito entre medias; bordes; un éxito reinicia) y `RF-31` (los rechazados no alargan) en verde; `pnpm check` pasa.
- [x] **T8. Solicitar el registro: camino normal.** RF-1, RF-6, RF-7, RF-11, RF-35 · Responsable: claude
  - Plan: §Flujos (Solicitud de registro); §Contrato de API; ADR-0013; §Seguridad (contenido de los emails).
  - Ficheros: `src/identity/registration.controller.ts`, `registration.service.ts`, `registration-email.job.ts` (`AuthEmailJobs` con cola acotada y `drain()`), `identity.module.ts`, `test/identity/registration-request.e2e-spec.ts`.
  - Hecho cuando: e2e `RF-1` (código enviado, sin cuenta), `RF-6` (misma respuesta con y sin cuenta), `RF-7` (aviso en vez de código), `RF-11` (al confirmar, el anterior queda invalidado; mientras está reservado, sigue activo) y `RF-35` (email no válido) en verde; cola llena descarta el trabajo; `pnpm check` y `pnpm test:e2e` pasan.
- [x] **T9. Solicitar el registro: límites y fallos.** RF-12, RF-32, RF-38, RF-42 · Responsable: claude
  - Plan: §Flujos (Solicitud de registro, Límites); ADR-0013; spec D19.
  - Ficheros: `registration-email.job.ts`, `test/identity/registration-limits.e2e-spec.ts`.
  - Hecho cuando: tests `RF-12` (2.ª en < 1 min y 6.ª en < 1 h no envían; avisos y códigos comparten límite; un envío en curso o incierto cuenta), `RF-32`, `RF-38` (fallo simulado: misma respuesta, el anterior sigue, no cuenta) y `RF-42` (bloqueo de RF-15 sembrado en BD: no envía, no consume cupo, no invalida) en verde; `pnpm check` y `pnpm test:e2e` pasan.

## Entrega B — Completar el registro (`feat/001-authentication-b`)

- [x] **T10. Política de contraseñas y lista filtrada.** RF-23, RF-24, RF-25, RF-39, RNF-5 · Responsable: claude
  - Plan: §Flujos (Normalización); decisión E1.
  - Ficheros: `src/identity/domain/password-policy.ts` (+ `.spec.ts`), `src/identity/data/leaked-passwords.txt`, `scripts/build-leaked-passwords.ts`.
  - Hecho cuando: tests unitarios `RF-23` (11/129 no; 12/128 sí), `RF-24`, `RF-25`, `RF-39` (NFC antes de comprobar) y `RNF-5` (sin red) en verde; el script regenera la lista; `pnpm check` pasa.
- [x] **T11. Validación del nombre visible.** RF-27 · Responsable: claude
  - Plan: §Flujos (Normalización).
  - Ficheros: `src/identity/domain/display-name.ts` (+ `.spec.ts`).
  - Hecho cuando: tests unitarios `RF-27` (1/31 caracteres, control, formato, separadores, uso privado, sin asignar; tabulador en extremos eliminado y en medio rechazado) en verde; `pnpm check` pasa.
- [x] **T12. Creación de sesiones y guard global.** RF-33, RNF-1 · Responsable: claude
  - Plan: §Flujos (Guard global); §Modelo de datos (`Session`, `RefreshToken`); ADR-0012.
  - Ficheros: `src/identity/sessions.service.ts` (crear sesión + refresh + JWT), `access-token.guard.ts`, `current-session.decorator.ts`, `health.controller.ts` (`@Public()`), ruta de test `GET /__test/session`, `test/identity/guard.e2e-spec.ts`.
  - Hecho cuando: e2e `RF-33` (sin token, manipulado, otro algoritmo, caducado → `401 AUTHENTICATION_REQUIRED`), `/health` sin token → 200 y `RNF-1` para las rutas existentes en verde; `pnpm check` y `pnpm test:e2e` pasan.
- [x] **T13. Completar el registro: validación y evaluación del código.** RF-9, RF-10, RF-11, RF-15, RF-16, RF-23, RF-24, RF-27, RF-28, RF-35, RF-37, RF-41 · Responsable: claude
  - Plan: §Flujos (Completar el registro, pasos 1–5; Términos); decisión Q3.
  - Ficheros: `registration.service.ts`, `registration.controller.ts`, `test/identity/registration-complete.e2e-spec.ts`.
  - Hecho cuando: e2e `RF-37` (solo `INVALID_EMAIL`, también con contraseña ausente), `RF-28` (el código sigue y no cuenta), `RF-23`/`RF-24`/`RF-27`/`RF-35` por HTTP, `RF-9` (bordes de 15 min), `RF-10` (4 fallos aún sirve; 5 no), `RF-11` (el anterior ya no sirve), `RF-15` (bordes de 24 h), `RF-16` (todos los casos, incluidos vacío, 5 dígitos, letras y ausente) y `RF-41` en verde; `pnpm check` y `pnpm test:e2e` pasan.
- [x] **T14. Completar el registro: cuenta y sesión.** RF-4, RF-5, RF-26, RF-29, RF-30, D20 · Responsable: claude
  - Plan: §Flujos (Completar el registro, paso 6 y notas).
  - Ficheros: `registration.service.ts`, `test/identity/registration-account.e2e-spec.ts`.
  - Hecho cuando: e2e `RF-4`, `RF-5` (tokens; el acceso sirve en `/__test/session`), `RF-26` (registro con mayúsculas/espacios), `RF-29`, `RF-30` (N simultáneas → una cuenta) y `D20` (con RF-22 activo se crea cuenta y sesión) en verde; `pnpm check` y `pnpm test:e2e` pasan.

## Entrega C — Sesiones y requisitos globales (`feat/001-authentication-c`)

- [x] **T15. Iniciar sesión.** RF-13, RF-17, RF-22, RF-26, RF-31, RF-35, RF-39 · Responsable: claude
  - Plan: §Flujos (Iniciar sesión); §Contrato de API.
  - Ficheros: `sessions.controller.ts`, `sessions.service.ts`, `test/identity/sign-in.e2e-spec.ts`.
  - Hecho cuando: e2e `RF-13`, `RF-17`, `RF-22` (bordes de 15 min; sin cuenta; contraseña correcta bloqueada; un éxito reinicia), `RF-31`, `RF-26`, `RF-35` y `RF-39` (registro NFC, login NFD) en verde; re-hash al cambiar parámetros; `pnpm check` y `pnpm test:e2e` pasan.
- [x] **T16. Renovar la sesión.** RF-20, RF-21, RF-36, RNF-4 · Responsable: claude
  - Plan: §Flujos (Sesiones: orden de bloqueo; Renovar la sesión); §Modelo de datos (caducidad).
  - Ficheros: `sessions.service.ts`, `sessions.controller.ts`, `test/identity/refresh.e2e-spec.ts`.
  - Hecho cuando: e2e `RF-20` (renueva a 30 d; falla a 30 d + 5 min + 1 s), `RF-21` (bordes de 90 d), `RF-36` (refresh reutilizado finaliza esa sesión; las demás siguen; dos renovaciones simultáneas) y `RNF-4` (renovar cruzado con un cierre no produce un JWT posterior al cierre) en verde; `pnpm check` y `pnpm test:e2e` pasan.
- [x] **T17. Cerrar sesión y cerrar todas.** RF-18, RF-19, RF-36, RNF-1, RNF-4 · Responsable: claude
  - Plan: §Flujos (Cerrar sesión; Guard global); decisión Q2.
  - Ficheros: `sessions.controller.ts`, `sessions.service.ts`, `test/identity/sign-out.e2e-spec.ts`.
  - Hecho cuando: e2e `RF-18` (también con el JWT caducado), `RF-19` (las posteriores siguen), `RF-36` (cerrar con un refresh ya usado), `RNF-4` (tras cerrar, el JWT vale ≤ 5 min y el refresh deja de servir al momento) y `RNF-1` (todas las rutas del módulo sin credencial → 401 salvo las públicas) en verde; `pnpm check` y `pnpm test:e2e` pasan.
- [ ] **T18. Límites bajo concurrencia.** RNF-3 · Responsable: claude
  - Plan: §Flujos (Límites); ADR-0010, ADR-0013.
  - Ficheros: `test/identity/concurrency.e2e-spec.ts`.
  - Hecho cuando: e2e `RNF-3` (ráfagas simultáneas contra RF-10, RF-12, RF-15 y RF-22: nunca se supera el límite) en verde; `pnpm test:e2e` pasa.
- [ ] **T19. Tiempos de respuesta.** RNF-2 · Responsable: claude
  - Plan: §Estrategia de tests (Cómo se mide RNF-2); decisión E4.
  - Ficheros: `test/identity/timing.e2e-spec.ts`.
  - Hecho cuando: e2e `RNF-2` (100 peticiones por caso; diferencia de medias ≤ 50 ms en las tres operaciones, también con límites y bloqueos) en verde en local y en CI; `pnpm test:e2e` pasa.

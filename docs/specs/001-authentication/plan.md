# Plan 001: Autenticación

- **Estado:** borrador <!-- borrador | aprobado -->
- **Spec:** [spec.md](spec.md) (debe estar `aprobada`)
- **Fecha:** 2026-11-24
- **ADRs:** [0008](../../adr/0008-diseno-de-la-autenticacion.md)
- **Entrevista de diseño:** ronda 1 de 3 hecha (A1–A5). Pendientes: ronda 2 (B1, B2, C1, D1, D2) y ronda 3 (E1–E5 y la propuesta de lo que se deduce de las decisiones).

<!--
CÓMO se implementa. Describe el diseño, no un listado de funciones (eso caduca al programar).
Cada sección indica qué RF/RNF cubre.
Si una decisión afecta a más de esta funcionalidad, se convierte en ADR y aquí solo se enlaza.
-->

## Resumen

Pendiente: se redacta al cerrar la entrevista.

## Módulos afectados

Pendiente (ronda 3).

## Modelo de datos

Pendiente (ronda 3). Ya decidido por ADR-0008: la sesión es una fila en la base de datos. Se guardan el hash del refresh vigente y los hashes de los refresh ya usados de cada sesión, para distinguir una sesión copiada (RF-36) de un token inventado.

## Contrato de API

Pendiente (ronda 3). Ya decidido por ADR-0008: el JWT de acceso va en `Authorization: Bearer` y el refresh token en el cuerpo JSON, con el mismo contrato para web y móvil.

## Flujos y consistencia

Pendiente (rondas 2 y 3).

## Seguridad y autorización

Pendiente (ronda 3).

## Decisiones

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| A1. Autenticación propia sobre `node:crypto` (ADR-0008) | `@nestjs/authentication` 0.1.7 | Está en 0.x, sustituiría ADR-0005 y oculta lo que queremos aprender; las reglas propias de la spec habría que escribirlas igualmente. |
| A2. JWT de acceso sin estado de 5 min y refresh opaco rotativo; un refresh reutilizado indica sesión copiada y se finaliza esa sesión (ADR-0008) | Ventana de gracia en la rotación; validar la sesión en la BD en cada petición | La ventana añade estado y deja pasar una copia; validar en cada petición contradice ADR-0005. RNF-4 se cumple por la vida del JWT. Se acepta que un corte de red obligue a iniciar sesión de nuevo en ese dispositivo (D18). |
| A3. Bearer para el acceso y refresh en el cuerpo JSON, igual para web y móvil (ADR-0008) | Cookie HttpOnly para el refresh en la web | Un solo contrato y sin CSRF. Riesgo aceptado: un XSS en la web puede leer el refresh; lo mitiga la detección de copia. |
| A4. `jose` 6.2.x con EdDSA (Ed25519), con el algoritmo fijado al verificar (ADR-0008) | `@nestjs/jwt` con HS256; JWT programado a mano | Con firma asimétrica, quien verifica no puede firmar; `jose` es ESM y no tiene dependencias. A mano es fácil equivocarse en el formato. |
| A5. argon2id nativo (`crypto.argon2`) con m=19 MiB, t=2, p=1; NFC antes del hash; formato PHC; hash ficticio si el email no tiene cuenta (ADR-0008) | 64 MiB, t=3, p=4 (RFC 9106); calibrar en cada entorno | Es el mínimo de OWASP y aguanta logins simultáneos en un servidor pequeño. El formato PHC permite subir los parámetros más adelante. |

## Notas de la spec

| Nota | Resolución | Dónde |
|---|---|---|
| Lista de contraseñas filtradas y su mantenimiento (RF-24, RNF-5) | Pendiente | ronda 3 (E1) |
| Contenido del aviso de intento de registro (RF-7) | Pendiente | ronda 3 (se propone) |
| Entorno y método de medición de RNF-2 | Pendiente | ronda 3 (E4) |
| Límites bajo concurrencia (RNF-3) y creación única (RF-30) | Pendiente | ronda 2 (C1) |
| Margen de RNF-4 con el diseño de ADR-0005 | Resuelta: el JWT de acceso vive 5 min y no consulta la BD; una sesión finalizada deja de renovarse al momento | ADR-0008 |
| ADR de diseño de la autenticación que anuncia ADR-0005 | Resuelta | ADR-0008 |
| Detección de una sesión copiada (RF-36) | Resuelta: presentar un refresh ya usado de esa sesión | ADR-0008 |
| Reintentos de un envío fallido (RF-38) | Pendiente | ronda 2 (B2) |
| Último uso de una sesión (RF-20) | Resuelta: el momento de la última renovación (error de 5 min como mucho) | ADR-0008 |
| Comparación sin mayúsculas en emails no ASCII (RF-26) | Pendiente | ronda 3 (E2) |
| Validación de formato del email y casos frontera (RF-35) | Pendiente | ronda 3 (E2) |
| RNF-2 cuando un límite o un bloqueo impide el envío | Pendiente | ronda 2 (B1) |
| Completar el registro con un email bloqueado por RF-22 | Pendiente | ronda 3 (E3) |
| Definir «emitir» un código y unificar «vigente» y «válido» | Pendiente | ronda 2 (B1) |
| Tabulador al principio o al final del nombre visible | Pendiente | ronda 3 (se propone) |
| D14: cómo dividir el trabajo si salen más de 10 tareas | Pendiente | al cerrar el plan |

## Estrategia de tests

Pendiente (ronda 3): una fila por cada RF y RNF activo de la spec.

## Oportunidades de aprendizaje

Pendiente (ronda 3).

## Riesgos

- La sesión se pierde si se corta la red durante una renovación (ADR-0008, D18): el dispositivo tiene que volver a iniciar sesión.
- En la web, un XSS puede leer el refresh token (ADR-0008).

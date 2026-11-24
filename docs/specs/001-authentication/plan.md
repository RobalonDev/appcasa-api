# Plan 001: Autenticación

- **Estado:** borrador <!-- borrador | aprobado -->
- **Spec:** [spec.md](spec.md) (debe estar `aprobada`)
- **Fecha:** 2026-11-24
- **ADRs:** [0008](../../adr/0008-diseno-de-la-autenticacion.md), [0009](../../adr/0009-envio-de-emails-de-autenticacion.md), [0010](../../adr/0010-limites-y-concurrencia-por-clave.md), [0011](../../adr/0011-convenciones-de-la-api.md)
- **Entrevista de diseño:** rondas 1 (A1–A5) y 2 (B1, B2, C1, D1, D2) de 3 hechas. Pendiente: ronda 3 (E1–E5 y la propuesta de lo que se deduce de las decisiones).

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

Pendiente (ronda 3). Ya decidido: identificadores UUIDv7 (ADR-0011); tablas de eventos para los límites (ADR-0010); email normalizado único en la tabla de usuarios (RF-30, RF-40). Por ADR-0008, la sesión es una fila en la base de datos. Se guardan el hash del refresh vigente y los hashes de los refresh ya usados de cada sesión, para distinguir una sesión copiada (RF-36) de un token inventado.

## Contrato de API

Pendiente (ronda 3). Ya decidido: el JWT de acceso va en `Authorization: Bearer` y el refresh token en el cuerpo JSON, con el mismo contrato para web y móvil (ADR-0008). Los errores siguen RFC 9457 con un `code` estable (ADR-0011): un único `code` para todos los casos de RF-16 (incluidos RF-30 y RF-41) y otro compartido por RF-13 y RF-22. Los nombres concretos se fijan con el contrato.

## Flujos y consistencia

### Términos (cubre la nota de la revisión 4 sobre «emitir», «vigente» y «válido»)

- **Emitir un código:** el servicio de correo acepta su envío (ADR-0009). Los 15 minutos de RF-9 cuentan desde ese momento.
- **Código vigente** (en la spec también «válido»; aquí son sinónimos): emitido, con menos de 15 minutos desde su emisión y no invalidado. Se invalida por 5 fallos (RF-10), por la emisión de otro código (RF-11) o por la creación de la cuenta (RF-29).

### Solicitud de registro (RF-1, 6, 7, 11, 12, 32, 38, 42, RNF-2)

1. La petición valida el formato del email (RF-35). Si es válido, deja el trabajo en la cola en memoria (ADR-0009) y responde siempre igual. La respuesta no consulta nada que dependa de la cuenta.
2. Después de responder, el trabajo abre una transacción y toma el bloqueo del email normalizado (ADR-0010).
3. Si el email está bloqueado por RF-15, termina sin hacer nada (RF-42).
4. Si enviar superaría el límite de RF-12, termina sin hacer nada (RF-32).
5. Si el email tiene cuenta, prepara el aviso de intento de registro (RF-7). Si no, genera un código nuevo (RF-34).
6. Dentro de la transacción, registra el envío y, si hay código, lo guarda y deja el anterior invalidado (RF-11). Después envía.
7. Si el correo acepta el envío, hace commit: el envío cuenta para RF-12 y el código queda emitido. Si falla, hace rollback, de modo que no hay código nuevo, el anterior sigue vigente y el envío no cuenta (RF-38).

Detalle pendiente para la ronda 3: el contenido del aviso (RF-7).

### Límites (RF-10, 12, 15, 22, 31, RNF-3)

Patrón de ADR-0010. Dentro de una transacción, sobre el email normalizado: tomar el bloqueo, contar los eventos de la ventana deslizante, decidir y escribir. Los flujos de completar el registro y de iniciar sesión se detallan en la ronda 3.

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
| B1. El trabajo de envío se hace en memoria, después de responder, detrás de una interfaz; «emitir» = el correo acepta el envío (ADR-0009) | Tabla de trabajos con `SKIP LOCKED`; `@nestjs/outbox` 0.1.4 | Sin infraestructura nueva y sin adelantar la fase 5. Riesgo aceptado: una caída del proceso pierde el email. |
| B2. `MailSender` propio con `nodemailer` por SMTP, Mailpit en local, implementación en memoria en los tests y sin reintentos (ADR-0009) | Solo log en local; `@nestjs/mail` 0.0.2 | Se prueba un envío real en local; `@nestjs/mail` es muy temprano y sus reintentos chocan con RF-38. |
| C1. Eventos en Postgres más `pg_advisory_xact_lock` por email; `UNIQUE` sobre el email normalizado (ADR-0010) | Contador por ventana fija; Redis | Las ventanas deslizantes se cumplen con exactitud y sin infraestructura nueva; Redis llega en la fase 4. |
| D1. Errores RFC 9457 con `code` y `errors[]` (ADR-0011) | Formato de Nest con `code`; envoltorio propio | Un estándar compartido por todas las fases. |
| D2. Identificadores UUIDv7 (ADR-0011) | UUIDv4; bigint autoincremental | Ordenados (índice compacto) y no enumerables. |

## Notas de la spec

| Nota | Resolución | Dónde |
|---|---|---|
| Lista de contraseñas filtradas y su mantenimiento (RF-24, RNF-5) | Pendiente | ronda 3 (E1) |
| Contenido del aviso de intento de registro (RF-7) | Pendiente | ronda 3 (se propone) |
| Entorno y método de medición de RNF-2 | Pendiente | ronda 3 (E4) |
| Límites bajo concurrencia (RNF-3) y creación única (RF-30) | Resuelta: eventos en Postgres más bloqueo consultivo por email; `UNIQUE` sobre el email normalizado | ADR-0010 |
| Margen de RNF-4 con el diseño de ADR-0005 | Resuelta: el JWT de acceso vive 5 min y no consulta la BD; una sesión finalizada deja de renovarse al momento | ADR-0008 |
| ADR de diseño de la autenticación que anuncia ADR-0005 | Resuelta | ADR-0008 |
| Detección de una sesión copiada (RF-36) | Resuelta: presentar un refresh ya usado de esa sesión | ADR-0008 |
| Reintentos de un envío fallido (RF-38) | Resuelta: ninguno; un fallo es un envío no realizado | ADR-0009 |
| Último uso de una sesión (RF-20) | Resuelta: el momento de la última renovación (error de 5 min como mucho) | ADR-0008 |
| Comparación sin mayúsculas en emails no ASCII (RF-26) | Pendiente | ronda 3 (E2) |
| Validación de formato del email y casos frontera (RF-35) | Pendiente | ronda 3 (E2) |
| RNF-2 cuando un límite o un bloqueo impide el envío | Resuelta: el trabajo se hace después de responder, así que la respuesta no depende de si se envía | ADR-0009; «Flujos y consistencia» |
| Completar el registro con un email bloqueado por RF-22 | Pendiente | ronda 3 (E3) |
| Definir «emitir» un código y unificar «vigente» y «válido» | Resuelta: emitir = el correo acepta el envío; vigente y válido son sinónimos | ADR-0009; «Flujos y consistencia» |
| Tabulador al principio o al final del nombre visible | Pendiente | ronda 3 (se propone) |
| D14: cómo dividir el trabajo si salen más de 10 tareas | Pendiente | al cerrar el plan |

## Estrategia de tests

Pendiente (ronda 3): una fila por cada RF y RNF activo de la spec.

## Oportunidades de aprendizaje

Pendiente (ronda 3).

## Riesgos

- La sesión se pierde si se corta la red durante una renovación (ADR-0008, D18): el dispositivo tiene que volver a iniciar sesión.
- En la web, un XSS puede leer el refresh token (ADR-0008).
- Si el proceso se cae entre la respuesta y el envío, el email se pierde; la persona tiene que volver a solicitarlo (ADR-0009).
- Si el correo acepta el envío y después falla el commit, la persona recibe un código que no funciona, y ese envío no cuenta para RF-12 (ADR-0009).
- El bloqueo por email se mantiene durante el envío SMTP: un servicio de correo lento retrasa las demás operaciones sobre ese email y ocupa una conexión del pool (ADR-0010).

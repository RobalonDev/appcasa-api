# Plan 001: Autenticación

- **Estado:** aprobado <!-- borrador | aprobado -->
- **Spec:** [spec.md](spec.md) (debe estar `aprobada`)
- **Fecha:** 2026-11-24
- **ADRs:** [0008](../../adr/0008-diseno-de-la-autenticacion.md), [0009](../../adr/0009-envio-de-emails-de-autenticacion.md), [0010](../../adr/0010-limites-y-concurrencia-por-clave.md), [0011](../../adr/0011-convenciones-de-la-api.md), [0012](../../adr/0012-convenciones-transversales-de-la-aplicacion.md), [0013](../../adr/0013-envio-de-emails-reservar-enviar-confirmar.md)
- **Entrevista de diseño:** terminada en 3 rondas (A1–A5; B1, B2, C1, D1, D2; E1–E5 y la propuesta de lo que se deduce de ellas).
- **Revisión `/sdd-clarify … plan`:** hecha el 2026-11-24. Encontró 7 problemas, resueltos con las decisiones Q1–Q5, los ADRs 0012 y 0013 y las aclaraciones D19–D21 de la spec. Las observaciones también se han incorporado.
- **Aprobado por el autor** el 2026-11-24. Siguiente paso: `/sdd-tasks 001-authentication`.

<!--
CÓMO se implementa. Describe el diseño, no un listado de funciones (eso caduca al programar).
Cada sección indica qué RF/RNF cubre.
Si una decisión afecta a más de esta funcionalidad, se convierte en ADR y aquí solo se enlaza.
-->

## Resumen

Se crea el módulo `identity`. Cubre el registro en dos pasos, iniciar y cerrar sesión, y renovar la sesión:

- El token de acceso es un JWT firmado con EdDSA que caduca a los 5 minutos y no se consulta en la base de datos. El refresh token es opaco, se sustituye en cada renovación y su reutilización revela una sesión copiada (ADR-0008).
- Los emails se envían en segundo plano, después de responder, en tres pasos: reservar, enviar y confirmar (ADR-0009, ADR-0013).
- Los límites se aplican con eventos en Postgres y un bloqueo consultivo por email (ADR-0010).
- Los errores siguen RFC 9457 y los identificadores son UUIDv7 (ADR-0011).
- Un guard global exige sesión en toda ruta que no esté marcada como pública, y todas las fechas salen de un reloj inyectable (ADR-0012).

## Módulos afectados

ADR-0003: un módulo por bounded context, y ningún módulo accede a lo interno de otro.

### `src/identity/` (bounded context nuevo)

- **Controladores y servicios:**
  - `registration.controller.ts` y `registration.service.ts`: solicitar y completar el registro.
  - `sessions.controller.ts` y `sessions.service.ts`: iniciar sesión, renovar y cerrar sesión, una o todas.
- **Trabajo en segundo plano:** `registration-email.job.ts`, el de la solicitud de registro (ADR-0013). Va detrás de la interfaz `AuthEmailJobs`, cuya implementación en memoria:
  - está acotada a unos 4 envíos simultáneos y unos 1.000 trabajos en espera; si la cola está llena, el trabajo se descarta como un envío fallido;
  - tiene `drain()` para que los tests esperen a que termine;
  - se vacía en `beforeApplicationShutdown`.
- **`domain/`**, funciones puras con tests unitarios:
  - `email.ts`: normalizar y validar el email (RF-26, 35).
  - `display-name.ts`: validar el nombre visible (RF-27).
  - `password-policy.ts`: longitud, NFC y lista de contraseñas filtradas (RF-23, 24, 25, 39).
  - `verification-code.ts`: generar el código de 6 dígitos (RF-34).
  - `attempt-window.ts`: ventana deslizante con bloqueo posterior (RF-15, 22, 31).
- **`crypto/`:**
  - `password-hasher.ts`: argon2id en formato PHC, hash ficticio y `needsRehash`.
  - `tokens.service.ts`:
    - firma y verificación del JWT con `jose`;
    - refresh token de 32 bytes aleatorios y su SHA-256;
    - HMAC de los códigos de verificación.
- **Autenticación de las rutas:** `access-token.guard.ts` (global, con `APP_GUARD`) y `current-session.decorator.ts`.
- **Lista de contraseñas filtradas:** el fichero `data/leaked-passwords.txt` y el script `scripts/build-leaked-passwords.ts`, que lo regenera.
- **Qué expone a otros módulos:** `@CurrentSession()` (id de usuario y de sesión). Nada más hasta la spec 002.

### Infraestructura compartida

- **`src/mail/`:**
  - `MailSender`: clase abstracta que sirve de token de inyección.
  - `SmtpMailSender`: implementación real con nodemailer.
  - `InMemoryMailSender`: para los tests. Permite consultar los enviados, simular fallos y resultados inciertos, y añadir un retardo.
- **`src/http/`** (ADR-0011, ADR-0012):
  - `ProblemDetailsFilter`, filtro de excepciones global.
  - `configureApp(app)`: aplica el pipe de Zod con su `exceptionFactory` y el filtro. Lo usan `main.ts` y los tests e2e.
  - `@Public()`: vive aquí y no en `identity`, para que `/health` no dependa de un módulo de dominio.
- **`src/clock/`** (ADR-0012):
  - `Clock` inyectable, con `now()`. Todas las fechas salen de él, nunca de `now()` en la base de datos.
  - Los tests e2e lo sustituyen por un reloj controlable.
- **`src/database/`:**
  - Helper `lockKey(tx, namespace, key)`, que ejecuta `pg_advisory_xact_lock(hashtextextended(…))` (ADR-0010).
  - Todo el módulo `identity` usa un único espacio de nombres, `identity:email`. Así, la solicitud de registro, completar el registro y el inicio de sesión de un mismo email se ejecutan uno detrás de otro, que es lo que necesitan RF-29 y RF-41.
  - `PrismaService` pasa a desconectarse en `onApplicationShutdown`, para que la cola de envíos se vacíe antes. En Nest, `onModuleDestroy` se ejecuta antes que `beforeApplicationShutdown`.
- **`/health`** se marca `@Public()` (D21).

### Configuración y entorno local

- **Variables nuevas** en `src/config/env.ts`, `.env.example` y CI:
  - `JWT_PRIVATE_KEY` y `JWT_PUBLIC_KEY`: claves PEM Ed25519;
  - `VERIFICATION_CODE_SECRET`: clave del HMAC de los códigos;
  - `SMTP_URL` y `MAIL_FROM`.
- **Generación de claves:**
  - en local, `pnpm keys:generate` imprime las líneas para copiarlas a `.env`;
  - en CI, un paso ejecuta el mismo script (`node scripts/generate-secrets.ts >> "$GITHUB_ENV"`) con secretos de usar y tirar.
- **`docker-compose.yml`:** servicio `mailpit`, con versión fijada. SMTP en el puerto 1025 y web en el 8025.
- **`package.json`:** `engines.node` sube a la primera versión 24.x que trae `crypto.argon2` (se comprueba al implementar; en local hay 24.19).
- **`vitest.config.e2e.ts`:** `fileParallelism: false`, porque los tests comparten base de datos y reloj controlable.

## Modelo de datos

Prisma, con ids UUIDv7 (ADR-0011) y fechas `timestamptz`.

| Modelo | Campos clave | Restricciones e índices | Cubre |
|---|---|---|---|
| `User` | `email` (normalizado), `displayName`, `passwordHash` (PHC), `createdAt` | `UNIQUE(email)` | RF-4, 26, 30, 40 |
| `VerificationCode` | `email`, `codeHmac`, `status` (`PENDING` \| `ACTIVE` \| `INVALIDATED`), `issuedAt?`, `failedAttempts` | índice (email, status); `UNIQUE(email) WHERE status = 'ACTIVE'` (SQL en la migración) | RF-9, 10, 11, 29, 34 |
| `AuthEmailSend` | `email`, `kind` (`VERIFICATION_CODE` \| `REGISTRATION_NOTICE`), `status` (`PENDING` \| `SENT`), `createdAt` | índice (email, createdAt) | RF-7, 12, 38 |
| `VerificationFailure` | `email`, `failedAt` | índice (email, failedAt) | RF-15 |
| `LoginAttempt` | `email`, `at`, `outcome` (`FAILURE` \| `SUCCESS`) | índice (email, at) | RF-22, 31 |
| `Session` | `userId`, `createdAt`, `lastUsedAt`, `endedAt?`, `endReason?` (`LOGOUT` \| `LOGOUT_ALL` \| `COPIED`) | índice (userId) | RF-5, 17–21, 36 |
| `RefreshToken` | `sessionId`, `tokenHash` (SHA-256), `createdAt`, `usedAt?` | `UNIQUE(tokenHash)`; índice (sessionId) | RF-36 |

- **Código de verificación:**
  - Un código `PENDING` está reservado pero todavía no emitido: no es vigente.
  - Pasa a `ACTIVE` al confirmar el envío, y entonces se fija `issuedAt` (ADR-0013).
  - Solo puede haber un código `ACTIVE` por email (RF-11).
  - Se guarda como HMAC-SHA256 con `VERIFICATION_CODE_SECRET`, no en claro. Un hash simple no bastaría, porque un código de 6 dígitos se averigua probando las combinaciones en milisegundos. Con el HMAC, quien obtenga solo una copia de la base de datos no puede completar registros ajenos.
- **Envíos:** para RF-12 cuentan los envíos `PENDING` y los `SENT` (D19). Un envío fallido se borra (RF-38).
- **Caducidad de la sesión:** no se guarda, se calcula.
  - Por falta de uso, caduca en `lastUsedAt + 30 días + 5 minutos`. El uso real puede ser hasta 5 minutos posterior a la última renovación, así que la sesión nunca se finaliza antes de llevar 30 días sin usarse, y como mucho caduca 5 minutos tarde, dentro de la tolerancia de «sesión válida» (precisión de ADR-0008).
  - Como máximo, caduca en `createdAt + 90 días`.
  - `lastUsedAt` empieza siendo igual a `createdAt` y se actualiza en cada renovación.
- **Refresh tokens:** solo uno de cada sesión tiene `usedAt` vacío, que es el vigente. Los ya usados se conservan para reconocer una copia (RF-36) y distinguirla de un token inventado.
- **Qué protege cada capa:**
  - La base de datos: email único (RF-40), un solo código activo por email (RF-11) y hash de refresh único.
  - La aplicación: las ventanas de los límites y los bloqueos (ADR-0010).
- **Limpieza de datos caducados** (incluidas las reservas `PENDING` que se quedan sin confirmar): se aplaza a la fase 2 (decisión E5).

## Contrato de API

- Los errores siguen RFC 9457 (ADR-0011).
- Los errores de validación devuelven `400 VALIDATION_FAILED`, con `errors[]` formado por `{ field, code }`.
- El JWT de acceso va en `Authorization: Bearer` y el refresh token en el cuerpo JSON. El contrato es el mismo para web y móvil (ADR-0008).

| Método | Ruta | Acceso | Cubre | Respuestas |
|---|---|---|---|---|
| `POST` | `/auth/registration-requests` `{ email }` | pública | RF-1, 6, 7, 35 | `202` sin cuerpo · `400` |
| `POST` | `/auth/registrations` `{ email, code, displayName, password }` | pública | RF-4, 5, 23–30, 37, 41 | `201` tokens · `400` |
| `POST` | `/auth/sessions` `{ email, password }` | pública | RF-13, 17, 22, 31, 35 | `201` tokens · `400` · `401` |
| `POST` | `/auth/sessions/refresh` `{ refreshToken }` | con el refresh token (D21) | RF-20, 21, 36 | `200` tokens · `400` · `401` |
| `DELETE` | `/auth/sessions/current` `{ refreshToken }` | con el refresh token (D21) | RF-18, 36 | `204` · `400` · `401` |
| `DELETE` | `/auth/sessions` | Bearer | RF-19 | `204` · `401` |

- **Respuesta con tokens:** `{ accessToken, tokenType: "Bearer", expiresIn: 300, refreshToken }`. No devuelve datos del usuario, porque la spec no los pide.
- **Contenido del JWT:** `sub` (id de usuario), `sid` (id de sesión), `iss` y `aud` con el valor `appcasa`, y `exp` a los 5 minutos.
- **Verificación del JWT:** solo se acepta `EdDSA`, se comprueban `iss` y `aud`, y no hay tolerancia de reloj.
- **Validación de las peticiones:**
  - Completar el registro no usa esquema de tipos: el servicio valida en el orden de RF-37 (decisión Q3).
  - Las demás rutas usan el pipe de Zod, y validan el email antes que el resto de campos.

**Códigos de error (`code`):**

| `code` | Estado | Cuándo |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Cuerpo no válido. En `errors[]` van `INVALID_EMAIL` (RF-35), `INVALID_PASSWORD_LENGTH` (RF-23), `BREACHED_PASSWORD` (RF-24), `INVALID_DISPLAY_NAME` (RF-27) o, fuera de completar el registro, `INVALID_FIELD` (tipo erróneo o campo ausente). |
| `INVALID_VERIFICATION_CODE` | 400 | Todos los casos de RF-16, más RF-30 y RF-41. |
| `INVALID_CREDENTIALS` | 401 | RF-13 y RF-22, con el mismo mensaje. |
| `AUTHENTICATION_REQUIRED` | 401 | RF-33. También al renovar o cerrar sesión con un refresh desconocido, ya usado (copia) o de una sesión finalizada o caducada. |

## Flujos y consistencia

Regla común a todos los flujos: dentro de una transacción, el servicio **no lanza excepciones**. Devuelve un resultado, se hace commit y fuera se traduce a un error HTTP. Si se lanzara dentro, el rollback borraría lo escrito antes del error, como un fallo contado (RF-10, 15) o una sesión finalizada por copia (RF-36).

### Términos (resuelve la nota de la revisión 4 sobre «emitir», «vigente» y «válido»)

- **Emitir un código:** que el servicio de correo acepte su envío y el sistema lo confirme (ADR-0009, ADR-0013). Los 15 minutos de RF-9 cuentan desde ese momento (`issuedAt`).
- **Código vigente:** emitido, sin que hayan pasado **más** de 15 minutos desde su emisión y no invalidado. En la spec también se dice «válido»; aquí son sinónimos. Un código se invalida:
  - con 5 intentos fallidos (RF-10);
  - al emitirse otro código para el mismo email (RF-11);
  - al crearse la cuenta (RF-29).

### Normalización (resuelve las notas sobre RF-26, RF-35 y el tabulador)

- **Espacios en blanco:** son los caracteres con la propiedad Unicode `White_Space`, y se quitan con el regex `\p{White_Space}`. No se usa `trim()`, porque además quita U+FEFF, que es un carácter de formato y RF-27 lo rechaza.
- **Email**, en este orden:
  1. se quitan los espacios de los extremos;
  2. no puede pasar de 254 caracteres;
  3. el formato se valida con `z.email()`;
  4. se pasa a minúsculas.
- **Nombre visible**, en este orden:
  1. se quitan los espacios de los extremos (un tabulador al principio o al final se elimina, y uno en medio se rechaza por ser un carácter de control);
  2. se normaliza a NFC;
  3. debe tener entre 2 y 30 caracteres;
  4. no puede contener caracteres `\p{Cc}`, `\p{Cf}`, `\p{Zl}`, `\p{Zp}`, `\p{Co}` ni `\p{Cn}` (RF-27).
- **Contraseña**, en este orden:
  1. no se recorta (RF-25);
  2. se normaliza a NFC;
  3. debe tener entre 12 y 128 caracteres;
  4. no puede estar en la lista de contraseñas filtradas (RF-23, 24, 39).

### Solicitud de registro (RF-1, 6, 7, 11, 12, 32, 34, 38, 42, RNF-2, RNF-3)

ADR-0013 describe el flujo de reservar, enviar y confirmar:

1. La petición valida el formato del email (RF-35). Si es válido, deja el trabajo en la cola (ADR-0009) y responde siempre igual. Para responder no consulta nada que dependa de si existe la cuenta.
2. **Reservar.** Transacción corta con el bloqueo del email:
   - Si el email está bloqueado por RF-15, termina sin hacer nada (RF-42).
   - Si enviar superaría el límite de RF-12, termina sin hacer nada (RF-32). Cuentan los envíos `PENDING` y `SENT`, también los avisos de RF-7 (D19).
   - Si no, guarda el envío como `PENDING`. Si el email no tiene cuenta, guarda además un código nuevo como `PENDING` (RF-34); si la tiene, el email será el aviso de RF-7.
3. **Enviar**, sin transacción ni conexión de la base de datos.
4. **Confirmar.** Transacción corta con el bloqueo del email:
   - **Si el correo aceptó el envío:** el envío pasa a `SENT`. Si el email sigue sin cuenta y sin bloqueo de RF-15, el código pasa a `ACTIVE` con `issuedAt` y el anterior se invalida (RF-11).
   - **Si el envío falló:** se borran el envío y el código pendiente. No cuenta para RF-12 y el anterior sigue vigente (RF-38).
5. **Resultado incierto** (confirmación fallida, tiempo de espera agotado o caída): el envío queda `PENDING` y cuenta para RF-12, y el código no se emite (D19).

### Completar el registro (RF-4, 5, 9, 10, 15, 16, 28, 29, 30, 37, 40, 41)

Este endpoint no usa esquema de tipos (decisión Q3). Un cuerpo que no es un objeto se trata como si faltaran todos los campos.

1. **Email** (RF-35). Si falta, no es texto o no es válido: `INVALID_EMAIL`, y no se informa de nada más (RF-37).
2. **Nombre y contraseña** (RF-27, 23, 24):
   - nombre ausente o no válido: `INVALID_DISPLAY_NAME`;
   - contraseña ausente: `INVALID_PASSWORD_LENGTH` (tiene 0 caracteres).
   - Si alguno falla, se responde `400` sin evaluar el código (RF-28).
3. Se abre una transacción y se toma el bloqueo del email. Si RF-15 lo bloquea, se responde `INVALID_VERIFICATION_CODE` y el intento no cuenta.
4. **Casos que reciben el error genérico sin contar como fallo:**
   - no hay ningún código vigente (D16);
   - el email ya tiene cuenta (RF-41);
   - el código falta o no es texto.
5. **El código es texto pero no es el correcto** (incluidos un texto vacío, 5 o 7 dígitos o letras; se compara el HMAC con `timingSafeEqual`):
   - se suma 1 a `failedAttempts`, y al llegar a 5 el código se invalida (RF-10);
   - se registra un evento `VerificationFailure` (RF-15);
   - se responde con el error genérico.
6. **El código es correcto.** Por este orden:
   1. se calcula el hash argon2;
   2. se crea el `User`;
   3. se invalidan los códigos del email (RF-29);
   4. se crea la sesión (RF-5);
   5. se responde `201`.

Notas sobre este flujo:
- El bloqueo de RF-22 no interviene aquí (D20, decisión E3).
- No se calcula ningún hash antes del paso 6. Así, los tres casos de RNF-2 hacen el mismo trabajo.
- Dos peticiones simultáneas quedan en fila por el bloqueo: la segunda ya no encuentra ningún código vigente (RF-30). La restricción `UNIQUE` es la última barrera.

### Iniciar sesión (RF-13, 17, 22, 31, RNF-2, RNF-3)

1. Se valida el email (RF-35). La contraseña solo se comprueba que sea texto, porque RF-23 se aplica solo al registro. El límite de tamaño del cuerpo de Express acota el coste del hash.
2. Se abre una transacción y se toma el bloqueo del email.
3. Si RF-22 bloquea el email, se calcula un hash ficticio y se responde `INVALID_CREDENTIALS` sin registrar ningún evento (RF-31).
4. Si no, se verifica la contraseña contra el hash real, o contra uno ficticio si el email no tiene cuenta.
   - Si falla, se registra un evento `FAILURE`.
   - Si es correcta:
     1. se registra un evento `SUCCESS`, que reinicia la cuenta de fallos;
     2. se vuelve a calcular el hash si han cambiado los parámetros de argon2;
     3. se crean la sesión y su refresh token;
     4. se responde `201`.

### Ventana con bloqueo posterior (RF-15, 22, 31)

`attempt-window.ts` es una función pura. Recibe los eventos de un email y el momento actual, y responde si el email está bloqueado y hasta cuándo:
- **RF-15:** 10 fallos en 24 horas bloquean durante las 24 horas siguientes al décimo.
- **RF-22:** 5 fallos en 15 minutos, sin ningún éxito entre ellos, bloquean durante los 15 minutos siguientes al quinto.
- Los intentos rechazados durante el bloqueo no se registran como eventos (RF-31, D16).

### Sesiones: orden de bloqueo (RNF-4)

- Renovar, cerrar sesión, cerrar todas y detectar una copia bloquean **primero** la fila o filas de `Session` con `FOR UPDATE`, y **después** el `RefreshToken`.
- Siempre en ese orden, para evitar interbloqueos.
- El estado de la sesión (`endedAt` y caducidad) se comprueba con la fila ya bloqueada.
- Así, un cierre de sesión que se cruza con una renovación espera a que esta termine. El JWT de la renovación se emitió antes del cierre, y por tanto vive 5 minutos como mucho tras la finalización.

### Renovar la sesión (RF-20, 21, 36, RNF-4)

1. Se busca el `RefreshToken` por su hash. Si no existe, se responde `401`.
2. Se bloquea su `Session` y después el token.
3. Si el token ya estaba usado, la sesión es una copia: se finaliza con `COPIED` (si no lo estaba ya), se hace commit y se responde `401`.
4. Si la sesión está finalizada o caducada (30 días y 5 minutos sin renovar, o 90 días desde su creación), se responde `401`.
5. Si no, por este orden:
   1. se marca el token como usado;
   2. se crea un refresh nuevo;
   3. se actualiza `lastUsedAt`;
   4. se emite un JWT nuevo.

Si llegan dos renovaciones simultáneas con el mismo token, la segunda encuentra el token ya usado y se trata como copia (D18).

### Cerrar sesión (RF-18, 19, 36, RNF-4)

- **Cerrar sesión** (RF-18), con `{ refreshToken }` en el cuerpo y sin necesitar JWT (D21). Siguiendo el mismo orden de bloqueo:
  - refresh vigente de una sesión abierta: se finaliza esa sesión con `LOGOUT` y se responde `204`;
  - refresh ya usado: es una copia (RF-36), la sesión se finaliza con `COPIED` y se responde `401`;
  - refresh desconocido, o de una sesión finalizada o caducada: `401`.
- **Cerrar sesión en todos los dispositivos** (RF-19), con Bearer: se bloquean las sesiones abiertas del usuario y se finalizan con `LOGOUT_ALL`. Las que se creen después no se ven afectadas.
- En ambos casos, un JWT ya emitido sigue sirviendo 5 minutos como mucho (RNF-4). El refresh deja de servir al momento.

### Guard global (RNF-1, RF-33; ADR-0012)

- Toda ruta exige un Bearer válido, salvo las marcadas con `@Public()`.
- Llevan `@Public()`:
  - las tres operaciones públicas de RNF-1: solicitar el registro, completarlo e iniciar sesión;
  - renovar y cerrar sesión, que se acreditan con el refresh de la propia sesión (D21);
  - `/health`, que es infraestructura y queda fuera del alcance de la spec (D21).

### Límites (RF-10, 12, 15, 22, 31, RNF-3)

Se sigue el patrón de ADR-0010: dentro de una transacción, sobre el email normalizado, se toma el bloqueo, se cuentan los eventos de la ventana deslizante, se decide y se escribe. El envío SMTP queda fuera del bloqueo (ADR-0013).

## Seguridad y autorización

- **Identidad global:** las cuentas no pertenecen a ningún hogar, así que no llevan `householdId`. Es la excepción a ADR-0006 recogida en `CLAUDE.md`. No hay roles (D12).
- **Secretos:** solo en variables de entorno. Los logs nunca incluyen contraseñas, códigos, tokens ni hashes.
- **Generación y comparación de secretos:**
  - los secretos se comparan con `timingSafeEqual`;
  - los códigos se generan con `crypto.randomInt` (RF-34);
  - los refresh tokens tienen 256 bits aleatorios.
- **No enumeración:** en los casos de RNF-2, las operaciones públicas devuelven el mismo estado, cuerpo y cabeceras. El test de tiempos lo vigila.
- **Contenido de los emails** (resuelve la nota sobre RF-7). Por ahora los textos van en español; la traducción a otros idiomas llegará más adelante.
  - **Aviso de intento de registro:** alguien ha intentado registrarse con esa dirección; ya tiene cuenta y puede iniciar sesión; si no fue la persona, puede ignorar el mensaje. Sin enlaces ni código.
  - **Email del código:** el código, que caduca en 15 minutos, y que se ignore si no se ha pedido.

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
| E1. Lista de contraseñas filtradas curada en el repo: las más frecuentes de SecLists (licencia MIT), filtradas a 12–128 caracteres y en NFC, cargadas en un `Set` al arrancar y regeneradas con un script | Filtro de Bloom de HIBP; tabla en Postgres | Sin falsos positivos y sin red (RNF-5). El filtro de Bloom vive fuera de git y tiene falsos positivos; la tabla añade una consulta y datos que cargar en CI. Riesgo aceptado: solo cubre las filtradas más frecuentes. |
| E2. Formato del email con `z.email()` de Zod por defecto: solo ASCII, punto obligatorio en el dominio, dominios internacionalizados en punycode salvo el de primer nivel | Regex de HTML5; regex Unicode | Al ser solo ASCII, pasar a minúsculas no tiene casos raros. HTML5 acepta dominios sin punto; Unicode trae homógrafos y soporte desigual. Riesgos aceptados: se rechazan un dominio con ñ o tildes escrito en Unicode, los dominios de primer nivel en punycode (p. ej. `xn--p1ai`, que es `.рф`) y algunos caracteres raros pero válidos de la parte local (`!#$%&*/=?^{\|}~`). |
| E3. Completar el registro con un email bloqueado por RF-22 crea la cuenta y la sesión (spec D20) | Rechazar durante el bloqueo; crear la cuenta sin sesión | RF-22 solo habla del inicio de sesión, y el código ya demuestra que se controla el email. Rechazar daría otra forma de retrasar registros ajenos; no crear la sesión contradice RF-5. |
| E4. RNF-2 se comprueba con un test e2e en CI (`test/identity/timing.e2e-spec.ts`) | Script manual | Un script manual deja de proteger si nadie lo ejecuta. Coste: CI tarda unos 10–20 s más. |
| E5. La limpieza de datos caducados se aplaza a la fase 2; mientras tanto, índices (email, fecha) | Job diario ahora; limpieza oportunista | La fase 2 se dedica a los jobs programados. Hacer limpieza solo cuando se vuelve a usar un email deja datos sin limpiar. |
| Q1. Envío en tres pasos: reservar, enviar y confirmar; los envíos en curso cuentan para RF-12; cola acotada (ADR-0013, spec D19) | Mantener el bloqueo durante el SMTP, con cupo de trabajos | No ocupa conexiones durante el SMTP, así que una ráfaga no deja sin servicio la API, y el límite nunca se supera aunque falle un commit o el resultado sea incierto. Coste: un envío en curso que acaba fallando cuenta mientras dura. |
| Q2. Cerrar sesión con el refresh en el cuerpo; cerrar todas con Bearer (spec D21) | Solo Bearer; refresh en ambas | Una sola llamada aunque el JWT haya caducado, y coincide con ADR-0008. Cerrar todas identifica al usuario con su acceso. |
| Q3. Completar el registro sin esquema de tipos: cada problema se traduce a un error de la spec en el orden de RF-37; un código de texto erróneo cuenta como fallo y uno ausente no | Validar antes la estructura con el pipe de Zod | Cumple RF-16 y RF-37 en todos los casos, sin interpretaciones que solo vivan en el plan. |
| P6. Guard global con `@Public()` y `Clock` como única fuente de tiempo (ADR-0012) | Guard por ruta; temporizadores falsos de Vitest; `now()` en la BD | Un olvido deja la ruta cerrada; los plazos se prueban en los bordes de forma determinista. |

## Notas de la spec

| Nota | Resolución | Dónde |
|---|---|---|
| Lista de contraseñas filtradas y su mantenimiento (RF-24, RNF-5) | Resuelta: lista curada de SecLists en el repo, regenerable con un script | E1; «Módulos afectados» |
| Contenido del aviso de intento de registro (RF-7) | Resuelta | «Seguridad y autorización» |
| Entorno y método de medición de RNF-2 | Resuelta: test e2e en CI, con un `MailSender` falso que tarda a propósito | E4; «Estrategia de tests» |
| Límites bajo concurrencia (RNF-3) y creación única (RF-30) | Resuelta: eventos en Postgres más bloqueo consultivo por email; `UNIQUE` sobre el email normalizado; los envíos en curso cuentan | ADR-0010, ADR-0013 |
| Margen de RNF-4 con el diseño de ADR-0005 | Resuelta: el JWT de acceso vive 5 min y no consulta la BD; las sesiones se bloquean antes que los tokens | ADR-0008; «Sesiones: orden de bloqueo» |
| ADR de diseño de la autenticación que anuncia ADR-0005 | Resuelta | ADR-0008 |
| Detección de una sesión copiada (RF-36) | Resuelta: presentar un refresh ya usado de esa sesión, al renovar o al cerrar sesión | ADR-0008; «Flujos y consistencia» |
| Reintentos de un envío fallido (RF-38) | Resuelta: ninguno; un fallo es un envío no realizado | ADR-0009 |
| Último uso de una sesión (RF-20) | Resuelta: la última renovación; caduca a los 30 días y 5 minutos de ella | ADR-0008 (precisado) |
| Comparación sin mayúsculas en emails no ASCII (RF-26) | Resuelta: solo se aceptan emails ASCII, así que basta con `toLowerCase()` | E2 |
| Validación de formato del email y casos frontera (RF-35) | Resuelta: `z.email()`; se rechazan los dominios sin punto, las comillas y los dominios de primer nivel en punycode | E2 |
| RNF-2 cuando un límite o un bloqueo impide el envío | Resuelta: el trabajo se hace después de responder, así que la respuesta no depende de si se envía | ADR-0009; «Flujos y consistencia» |
| Completar el registro con un email bloqueado por RF-22 | Resuelta: se crean la cuenta y la sesión | E3; spec D20 |
| Definir «emitir» un código y unificar «vigente» y «válido» | Resuelta: emitir = el correo acepta el envío y el sistema lo confirma; vigente y válido son sinónimos | ADR-0013; «Flujos y consistencia» |
| Tabulador al principio o al final del nombre visible | Resuelta: en los extremos se elimina como espacio en blanco; en medio se rechaza como carácter de control | «Flujos y consistencia» (Normalización) |
| D14: cómo dividir el trabajo si salen más de 10 tareas | Se decide en `/sdd-tasks`, con unas 16 tareas estimadas | «Estimación» |

## Estrategia de tests

Referencia de cobertura: una fila por cada RF y RNF activo de la spec.

- **Unit:** funciones puras, en `src/identity/{domain,crypto}/*.spec.ts`.
- **E2E:** en `test/identity/*.e2e-spec.ts`, sin paralelismo entre ficheros, con base de datos real, `InMemoryMailSender` y el reloj controlable.
- **Ruta protegida de prueba:** solo los e2e registran `GET /__test/session`, para comprobar un acceso con sesión sin añadir rutas al producto.
- **Plazos:** cada plazo se prueba justo antes y justo después de su borde.

| RF/RNF | Tipo | Qué comprueba |
|---|---|---|
| RF-1 | e2e | Email sin cuenta: se envía un código y no existe ninguna cuenta. |
| RF-4 | e2e | Código correcto y datos válidos: se crea la cuenta con el email normalizado, el nombre y la contraseña (un inicio de sesión posterior funciona). |
| RF-5 | e2e | Completar el registro devuelve tokens, y el token de acceso sirve en `GET /__test/session`. |
| RF-6 | e2e | Misma respuesta (estado, cuerpo y cabeceras) con y sin cuenta. |
| RF-7 | e2e | Email con cuenta: se envía el aviso, no un código. |
| RF-9 | e2e | El código sirve a los 15 min exactos de su emisión y se rechaza a los 15 min y 1 s (error genérico). |
| RF-10 | e2e | Tras 5 fallos, el código correcto ya no sirve. Con 4 fallos, todavía sirve. |
| RF-11 | e2e | Al emitirse un código nuevo, el anterior deja de servir. Mientras el nuevo solo está reservado, el anterior sigue sirviendo. |
| RF-12 | e2e + unit | La segunda solicitud en menos de 1 min y la sexta en menos de 1 h no envían nada, y responden igual. También con avisos de RF-7 mezclados con códigos. Un envío en curso o de resultado incierto cuenta (D19). |
| RF-13 | e2e | Email inexistente y contraseña errónea: mismo `code` y mismo cuerpo. |
| RF-15 | unit + e2e | 10 fallos en 24 h, repartidos entre varios códigos: el código correcto se rechaza a las 24 h menos 1 s del décimo fallo, y se acepta a las 24 h y 1 s. |
| RF-16 | e2e | Código incorrecto, caducado, invalidado, con el email bloqueado, sin registro en curso, vacío, de 5 dígitos, con letras o ausente: el mismo error en todos los casos. |
| RF-17 | e2e | Un inicio de sesión correcto crea una sesión nueva (dos inicios, dos sesiones). |
| RF-18 | e2e | Cerrar sesión con su refresh: ese refresh deja de servir, y otra sesión sigue funcionando. Funciona aunque el JWT de la sesión haya caducado. |
| RF-19 | e2e | Al cerrar todas, las sesiones anteriores quedan finalizadas y una creada después sigue funcionando. |
| RF-20 | e2e | Se puede renovar a los 30 días sin renovar, y se rechaza (`401`) a los 30 días, 5 minutos y 1 segundo. |
| RF-21 | e2e | Una sesión que se sigue usando se puede renovar a los 90 días menos 1 s de su creación, y se rechaza (`401`) a los 90 días y 1 s. |
| RF-22 | unit + e2e | 5 fallos en 15 min bloquean, incluso con la contraseña correcta y aunque el email no tenga cuenta. A los 15 min menos 1 s del quinto fallo sigue bloqueado; a los 15 min y 1 s ya no. Un éxito entre medias reinicia la cuenta. |
| RF-23 | unit + e2e | 11 y 129 caracteres, o contraseña ausente: `INVALID_PASSWORD_LENGTH`. 12 y 128: válidas. |
| RF-24 | unit + e2e | Una contraseña de la lista: `BREACHED_PASSWORD`. |
| RF-25 | unit | Se admiten espacios y cualquier carácter, sin reglas de composición. |
| RF-26 | unit + e2e | Mayúsculas y espacios Unicode en los extremos dan el mismo email, al registrarse y al iniciar sesión. |
| RF-27 | unit + e2e | 1 y 31 caracteres, nombre ausente, carácter de control, de formato (espacio de ancho cero), separador, uso privado o sin asignar: `INVALID_DISPLAY_NAME`. Un tabulador en los extremos se elimina. |
| RF-28 | e2e | Código correcto con contraseña no válida: `400`. Después, el mismo código sigue sirviendo y no contó como fallo. |
| RF-29 | e2e | Creada la cuenta, ningún código anterior sirve. |
| RF-30 | e2e | N peticiones simultáneas crean una sola cuenta; las demás reciben `INVALID_VERIFICATION_CODE`. |
| RF-31 | unit + e2e | Los intentos durante el bloqueo no lo alargan. |
| RF-32 | e2e | Alcanzado el límite de RF-12, no se emite código nuevo y el anterior sigue sirviendo. |
| RF-33 | e2e | Sin token, con un token manipulado, firmado con otro algoritmo o caducado: `401 AUTHENTICATION_REQUIRED`. |
| RF-34 | unit | Siempre 6 dígitos, incluidos los ceros a la izquierda. |
| RF-35 | unit + e2e | Formato no válido, más de 254 caracteres o email ausente: `INVALID_EMAIL` en las tres operaciones. |
| RF-36 | e2e | Reutilizar un refresh ya rotado, al renovar o al cerrar sesión, finaliza esa sesión; las demás siguen. |
| RF-37 | e2e | Email, nombre y contraseña no válidos a la vez: solo se informa de `INVALID_EMAIL`. También con el email no válido y la contraseña ausente. |
| RF-38 | e2e | Con un fallo simulado del correo, la respuesta es la misma, el código anterior sigue sirviendo y el envío no cuenta para RF-12. |
| RF-39 | unit + e2e | Contraseña registrada en NFC e inicio de sesión en NFD: correcto. En ancho completo: incorrecto. |
| RF-40 | e2e | La restricción `UNIQUE` de la BD impide un duplicado aunque se salte la lógica de la aplicación. |
| RF-41 | e2e | Código vigente para un email que ya tiene cuenta: error genérico, y no cuenta como fallo. |
| RF-42 | e2e | Con el email bloqueado por RF-15 no se envía nada, no se consume el cupo de RF-12 y el código anterior no se invalida. |
| RNF-1 | e2e | Cada ruta del módulo responde `401` sin credencial, salvo las públicas. |
| RNF-2 | e2e (`test/identity/timing.e2e-spec.ts`) | Ver el detalle debajo de la tabla. |
| RNF-3 | e2e | Ráfagas simultáneas contra RF-10, 12, 15 y 22: nunca se supera el límite. |
| RNF-4 | e2e | Tras cerrar sesión, el JWT sirve 5 min como mucho (con el reloj controlable) y el refresh deja de servir al momento. Una renovación que se cruza con un cierre no produce un JWT posterior al cierre. |
| RNF-5 | unit | La comprobación de contraseña filtrada funciona sin red, con la lista local. |
| D20 (E3) | e2e | Completar el registro con el email bloqueado por RF-22 crea la cuenta y la sesión. |

**Cómo se mide RNF-2:**
- Se hacen 100 peticiones por caso, cada una con un email distinto, y la diferencia entre medias no puede superar 50 ms.
- Se incluyen también los casos en que se aplica un límite o un bloqueo (RF-12, 15 y 42).
- Las cuentas de prueba se crean directamente en la BD, con un hash ya calculado.
- El `MailSender` falso tarda unos 300 ms a propósito, para demostrar que la respuesta no espera al envío.

## Oportunidades de aprendizaje

Piezas que conviene que implemente el autor, porque son la lógica de dominio más interesante:

- **`attempt-window.ts`:** la ventana deslizante con bloqueo posterior (RF-15, 22, 31). Es una función pura y muy fácil de probar.
- **Completar el registro:** el orden de validación, el bloqueo y las reglas de qué cuenta como fallo (RF-28, 37, 10, 15, 41).
- **Renovar la sesión:** la rotación del refresh y la detección de copia, con el orden de bloqueo `Session` → `RefreshToken` (RF-36, RNF-4).
- **Validar el nombre visible** con propiedades Unicode (RF-27).

Claude se encarga del resto:
- la configuración y las claves;
- el esquema de Prisma y la migración;
- el correo, la cola acotada y el flujo de reservar, enviar y confirmar;
- el filtro de errores;
- el guard y el reloj;
- la lista de contraseñas filtradas;
- el test de tiempos.

## Riesgos

- Si se corta la red durante una renovación, la sesión se pierde y el dispositivo tiene que volver a iniciar sesión (ADR-0008, D18).
- En la web, un XSS puede leer el refresh token (ADR-0008).
- Si el proceso se cae antes de reservar, el email se pierde y la persona tiene que volver a solicitarlo (ADR-0009). Si cae después, la reserva cuenta para el límite (ADR-0013).
- Si la confirmación falla después de que el correo aceptara el envío, la persona recibe un código que no funciona. El envío cuenta para RF-12, así que tiene que esperar a que el límite lo permita (ADR-0013).
- Si la cola está llena, los trabajos nuevos se descartan como envíos fallidos: con una ráfaga, algunas personas no reciben su código y tienen que volver a pedirlo (ADR-0013).
- El índice único parcial no se puede expresar en `schema.prisma`: va como SQL en la migración, y el esquema y la base de datos podrían desalinearse.
- El test de RNF-2 puede tener ruido en CI. Si falla de forma intermitente, se investiga la causa antes de relajar nada.
- RNF-2 y los parámetros de argon2: si se cambian, las cuentas con el hash antiguo tardan distinto que un email sin cuenta hasta que vuelven a iniciar sesión. Se acepta mientras los parámetros no cambien; antes de cambiarlos, hay que revisarlo.
- La lista de contraseñas filtradas solo cubre las más frecuentes (E1).
- Formato del email: se rechazan algunas direcciones válidas pero raras (E2).
- ~~`@types/nodemailer` va por la versión 8.0.2~~ Resuelto en T4: nodemailer 10 trae sus propios tipos.
- Los datos de autenticación, incluidas las reservas `PENDING`, crecen sin limpiarse hasta la fase 2 (E5). Hay que limpiarlos antes de desplegar.

## Estimación

Unas 16 tareas:
- 4 de infraestructura transversal;
- 3 de dominio puro;
- 3 de registro;
- 4 de sesiones;
- 2 de tests de RNF-2 y RNF-3.

Son más de 10, así que en `/sdd-tasks` se agruparán en entregas (D14). Propuesta orientativa:
- **Entrega A:** la infraestructura y el registro completo, que termina devolviendo tokens.
- **Entrega B:** el guard, el inicio de sesión, la renovación, los cierres de sesión y los tests de RNF-2 y RNF-3.

# Architecture Decision Records (ADR)

Un ADR documenta **una** decisión técnica relevante: qué problema había, qué opciones se valoraron, qué se eligió y qué consecuencias tiene. Sirven para que dentro de seis meses (o en una entrevista) se pueda explicar *por qué* el sistema es como es.

## Reglas

- Un fichero por decisión: `NNNN-titulo-en-kebab-case.md`, numeración correlativa.
- Se escriben en español. Cortos: si ocupa más de una pantalla, probablemente son dos decisiones.
- Un ADR aceptado **no se edita** para cambiar la decisión: se crea uno nuevo que lo sustituye y se marca el antiguo como `Sustituido por ADR-XXXX`.
- Estados: `Propuesto` → `Aceptado` | `Rechazado`; más tarde, `Obsoleto` o `Sustituido por ADR-XXXX`.
- Plantilla: [`0000-plantilla.md`](0000-plantilla.md).

## Índice

| ADR | Título | Estado |
|---|---|---|
| [0001](0001-registrar-decisiones-con-adrs.md) | Registrar decisiones de arquitectura con ADRs | Aceptado |
| [0002](0002-stack-backend.md) | Stack backend: NestJS, Prisma y PostgreSQL | Aceptado |
| [0003](0003-monolito-modular.md) | Empezar con un monolito modular | Aceptado |
| [0004](0004-pnpm-como-gestor-de-paquetes.md) | pnpm como gestor de paquetes | Aceptado |
| [0005](0005-autenticacion-propia.md) | Autenticación propia con JWT y refresh tokens | Aceptado |
| [0006](0006-hogar-como-tenant.md) | El hogar como tenant; un usuario puede pertenecer a varios | Aceptado |
| [0007](0007-spec-driven-development.md) | Spec-Driven Development ligero para funcionalidades de dominio | Aceptado |
| [0008](0008-diseno-de-la-autenticacion.md) | Diseño de la autenticación: sesiones, tokens y hash de contraseñas | Aceptado |
| [0009](0009-envio-de-emails-de-autenticacion.md) | Envío de emails de autenticación: en segundo plano y detrás de una interfaz | Aceptado; sustituido en parte por ADR-0013 |
| [0010](0010-limites-y-concurrencia-por-clave.md) | Límites exactos bajo concurrencia: eventos en Postgres y bloqueo consultivo por clave | Aceptado; sustituido en parte por ADR-0013 |
| [0011](0011-convenciones-de-la-api.md) | Convenciones de la API: errores RFC 9457 e identificadores UUIDv7 | Aceptado |
| [0012](0012-convenciones-transversales-de-la-aplicacion.md) | Convenciones transversales de la aplicación: denegar por defecto y reloj inyectable | Aceptado |
| [0013](0013-envio-de-emails-reservar-enviar-confirmar.md) | Envío de emails de autenticación: reservar, enviar y confirmar | Aceptado |

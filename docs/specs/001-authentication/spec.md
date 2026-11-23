# Spec 001: Autenticación

- **Estado:** borrador <!-- borrador | aprobada | implementada -->
- **Fecha:** 2026-11-23
- **ADRs relacionados:** [0005](../../adr/0005-autenticacion-propia.md), [0006](../../adr/0006-hogar-como-tenant.md)
- **Ronda de entrevista:** 1 cerrada. Los elementos marcados _(propuesto)_ los redactó Claude a partir de decisiones del autor y están pendientes de su confirmación.

<!--
Solo QUÉ y POR QUÉ. Nada de tecnología, tablas, endpoints ni nombres de ficheros: eso va en plan.md.
Cada requisito funcional en formato EARS y verificable (debe poder convertirse en un test).
-->

## Contexto y objetivo

Una persona crea **una única cuenta** en AppCasa y la usa desde web y móvil. Se identifica con su email y una contraseña.

La cuenta es **global e independiente de los hogares**: existe aunque no pertenezca a ninguno. La pertenencia a uno o varios hogares, y los roles dentro de cada uno, son autorización y se especifican en la spec 002 (el rol pertenece a la membresía, no al usuario: ADR-0006).

El sistema **deniega por defecto**: toda operación requiere una sesión válida salvo las marcadas explícitamente como públicas.

### Decisiones del autor y su porqué

| Id | Decisión | Por qué |
|---|---|---|
| D1 | La verificación del email es obligatoria antes de poder usar la cuenta. | Sin verificar, alguien podría registrarse con un email ajeno, recibir invitaciones a hogares dirigidas a esa persona (spec 003) y hacer poco fiable la recuperación por email. |
| D1-código | La verificación se hace con un código, no con un enlace. | Funciona mejor en móvil: no obliga a salir de la app. |
| D1a | En el inicio de sesión, el sistema solo revela que la cuenta está pendiente si las credenciales son correctas. | Evita la enumeración de usuarios: nadie que no conozca la contraseña puede averiguar si un email tiene cuenta. |
| D1b | Registrarse con un email ya existente recibe la misma respuesta que un registro nuevo; el aviso se envía por email al dueño. | El registro no pide contraseña: cualquier diferencia en la respuesta confirmaría qué emails tienen cuenta (recomendación OWASP). |
| D1c | Tras verificar, el usuario queda con la sesión iniciada. | Acaba de demostrar que controla el email y conoce la contraseña; pedirle un login más es fricción sin ganancia. |
| D1d | El código caduca a los 15 min, se invalida tras 5 intentos fallidos, solo hay uno válido a la vez y el reenvío está limitado a 1 por minuto. | Sin límites, un código de 6 dígitos se puede adivinar por fuerza bruta y activar una cuenta con un email ajeno. |

## Usuarios

- **Persona sin cuenta:** quiere registrarse.
- **Usuario con cuenta pendiente:** se ha registrado pero aún no ha verificado su email.
- **Usuario con cuenta activa:** ha verificado su email y puede usar AppCasa.

## Definiciones

_(propuesto)_

- **Cuenta pendiente:** cuenta registrada cuyo email aún no se ha verificado. No permite usar AppCasa.
- **Cuenta activa:** cuenta cuyo email se ha verificado.
- **Credenciales:** el email y la contraseña de una cuenta.
- **Código de verificación:** código que el sistema envía al email de una cuenta pendiente para demostrar que quien se registró controla ese email.

## Historias de usuario

_(propuesto)_

- **HU-1.** Como persona sin cuenta, quiero registrarme con mi email y una contraseña para usar AppCasa.
- **HU-2.** Como usuario con la cuenta pendiente, quiero verificar mi email con un código para activar mi cuenta.

## Requisitos funcionales

### Confirmados por el autor

- **RF-1** (HU-1). CUANDO un usuario se registra, EL SISTEMA crea su cuenta en estado pendiente y le envía un código de verificación al email indicado.
- **RF-2** (HU-2). SI un usuario intenta iniciar sesión con credenciales correctas y su cuenta está pendiente de verificación, ENTONCES EL SISTEMA deniega el acceso e indica que debe verificar su email.
- **RF-3** (HU-2). CUANDO un usuario con la cuenta pendiente solicita un nuevo código, EL SISTEMA le envía un nuevo código de verificación.
- **RF-4** (HU-2). CUANDO un usuario introduce el código de verificación correcto, EL SISTEMA activa su cuenta.
- **RF-5** (HU-2). CUANDO EL SISTEMA activa una cuenta mediante verificación, EL SISTEMA inicia la sesión del usuario.

### Pendientes de confirmar _(propuesto, derivados de D1a, D1b y D1d)_

- **RF-6** (HU-1). SI alguien se registra con un email que ya tiene cuenta, ENTONCES EL SISTEMA responde exactamente igual que a un registro nuevo.
- **RF-7** (HU-1). CUANDO alguien se registra con el email de una cuenta activa, EL SISTEMA envía al dueño de ese email un aviso de intento de registro.
- **RF-8** (HU-1). CUANDO alguien se registra con el email de una cuenta pendiente, EL SISTEMA reenvía un código de verificación a ese email.
- **RF-9** (HU-2). SI se introduce un código de verificación emitido hace más de 15 minutos, ENTONCES EL SISTEMA lo rechaza.
- **RF-10** (HU-2). SI se producen 5 intentos fallidos con un mismo código de verificación, ENTONCES EL SISTEMA invalida ese código.
- **RF-11** (HU-2). CUANDO EL SISTEMA emite un código de verificación nuevo para una cuenta, EL SISTEMA invalida el anterior.
- **RF-12** (HU-2). SI se solicita un nuevo código antes de que haya pasado 1 minuto desde el anterior, ENTONCES EL SISTEMA rechaza la solicitud.
- **RF-13** (HU-1). SI alguien intenta iniciar sesión con credenciales incorrectas, ENTONCES EL SISTEMA responde con el mismo mensaje genérico tanto si el email no existe como si la contraseña es errónea.

## Requisitos no funcionales

- **RNF-1** _(propuesto)_. EL SISTEMA exige una sesión válida en toda operación salvo las marcadas explícitamente como públicas: registro, verificación del email, solicitud de un nuevo código e inicio de sesión.

## Casos límite

- Registro con un email que ya tiene cuenta (activa o pendiente): RF-6, RF-7, RF-8.
- Código caducado, agotado por intentos fallidos o sustituido por uno nuevo: RF-9, RF-10, RF-11.
- Resto de casos límite: pendiente de la ronda 2 (ver dudas abiertas).

## Fuera de alcance

- Pertenencia a hogares, membresías y roles: spec 002.
- Invitaciones a hogares: spec 003.
- Interfaz de usuario (pantallas, navegación, redirecciones): la decide cada cliente; esta spec define el comportamiento de la API.

## Criterios de finalización

- Todos los RF y RNF tienen al menos un test que los referencia por su id (`RF-n`) y está en verde.
- `pnpm check` y `pnpm test:e2e` en verde.
- El reviewer da `VEREDICTO: APROBADO`.

## Dudas abiertas

La spec no puede pasar a `aprobada` con dudas abiertas.

- [NECESITA ACLARACIÓN] **Confirmación** de RF-6 a RF-13, RNF-1, historias de usuario y definiciones.
- [NECESITA ACLARACIÓN] **Sesiones:** ¿varias a la vez (web y móvil)? ¿Cerrar sesión en un dispositivo o en todos? ¿Cuánto dura una sesión?
- [NECESITA ACLARACIÓN] **Recuperación de contraseña:** ¿dentro o fuera de alcance de esta spec?
- [NECESITA ACLARACIÓN] **Fuerza bruta en el inicio de sesión:** ¿bloqueo de la cuenta, limitación de intentos o ambos?
- [NECESITA ACLARACIÓN] **Requisitos de la contraseña:** longitud mínima, rechazo de contraseñas comprometidas…
- [NECESITA ACLARACIÓN] **Perfil y borrado:** ¿qué datos mínimos tiene una cuenta (p. ej. un nombre visible para los demás miembros del hogar)? ¿Se puede borrar la cuenta en esta spec?
- [NECESITA ACLARACIÓN] **Cuentas pendientes abandonadas:** ¿una cuenta que nunca se verifica caduca o se elimina?
- [NECESITA ACLARACIÓN] **Formato del email:** ¿`Ana@Ejemplo.com` y `ana@ejemplo.com` son la misma cuenta?
- [NECESITA ACLARACIÓN] **Rol de plataforma** (superadministrador de AppCasa): previsiblemente fuera de alcance; confirmar.

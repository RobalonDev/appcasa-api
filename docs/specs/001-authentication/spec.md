# Spec 001: Autenticación

- **Estado:** borrador <!-- borrador | aprobada | implementada -->
- **Fecha:** 2026-11-23
- **ADRs relacionados:** [0005](../../adr/0005-autenticacion-propia.md), [0006](../../adr/0006-hogar-como-tenant.md)
- **Ronda de entrevista:** 3 cerrada. Los elementos marcados _(propuesto)_ están pendientes de confirmación del autor.

<!--
Solo QUÉ y POR QUÉ. Nada de tecnología, tablas, endpoints ni nombres de ficheros: eso va en plan.md.
Cada requisito funcional en formato EARS y verificable (debe poder convertirse en un test).
-->

## Contexto y objetivo

Una persona crea **una única cuenta** en AppCasa y la usa desde web y móvil. Se identifica con su email y una contraseña.

La cuenta es **global e independiente de los hogares**: existe aunque no pertenezca a ninguno. La pertenencia a uno o varios hogares, y los roles dentro de cada uno, son autorización y se especifican en la spec 002 (el rol pertenece a la membresía, no al usuario: ADR-0006).

El sistema **deniega por defecto**: toda operación requiere una sesión válida salvo las marcadas explícitamente como públicas.

**Principio de no enumeración:** ninguna operación pública (registro, inicio de sesión, solicitud de código, verificación) permite averiguar si un email tiene cuenta a quien no conoce su contraseña: ni por el mensaje ni por el tiempo de respuesta.

### Decisiones del autor y su porqué

| Id | Decisión | Por qué |
|---|---|---|
| D1 | La verificación del email es obligatoria antes de poder usar la cuenta. | Sin verificar, alguien podría registrarse con un email ajeno, recibir invitaciones a hogares dirigidas a esa persona (spec 003) y hacer poco fiable la recuperación por email. |
| D1-código | La verificación se hace con un código, no con un enlace. | Funciona mejor en móvil: no obliga a salir de la app. |
| D1a | En el inicio de sesión, el sistema solo revela que la cuenta está pendiente si las credenciales son correctas. | Evita la enumeración de usuarios: nadie que no conozca la contraseña puede averiguar si un email tiene cuenta. |
| D1b | Registrarse con un email ya existente recibe la misma respuesta que un registro nuevo; el aviso se envía por email al dueño. | El registro no pide contraseña: cualquier diferencia en la respuesta confirmaría qué emails tienen cuenta (recomendación OWASP). |
| D1c | Tras verificar, el usuario queda con la sesión iniciada. | Acaba de demostrar que controla el email y conoce la contraseña; pedirle un login más es fricción sin ganancia. |
| D1d | El código caduca a los 15 min, se invalida tras 5 intentos fallidos y solo hay uno válido a la vez. | Sin límites, un código de 6 dígitos se puede adivinar por fuerza bruta y activar una cuenta con un email ajeno. |
| D2 | Todos los emails de autenticación a una misma dirección (código, reenvío, aviso) comparten un límite de 1 por minuto y 5 por hora; si se supera, no se envía, pero la respuesta es idéntica. | Registrarse de nuevo con un email pendiente se saltaba el límite de reenvío, y los avisos de intento de registro permitían llenar de spam un buzón ajeno. Una regla común cierra ambos huecos sin filtrar nada. |
| D3 | Máximo 10 intentos fallidos de verificación por cuenta en 24 horas, sumando todos sus códigos. | Con D1d y D2, un atacante insistente aún podía probar unos 600 códigos al día (≈20 % de acertar en un año). Con el tope, ≈1 entre 100.000 al día. Se acepta que un usuario legítimo bloqueado no lo sepa (principio de no enumeración). |
| D4 | Cada dispositivo tiene su propia sesión; cerrar sesión afecta solo al actual, y existe «cerrar sesión en todos los dispositivos». | El caso de uso es web y móvil a la vez, y quien pierde el móvil debe poder echar a ese dispositivo sin tenerlo. |
| D5 | Una sesión caduca tras 30 días sin uso y, en cualquier caso, a los 90 días de iniciarse. | Equilibrio entre comodidad en móvil (unos 4 inicios de sesión al año para un uso diario) y la vida máxima de una sesión robada. |
| D6 | Tras 5 intentos fallidos de inicio de sesión con un mismo email en 15 minutos, se rechazan los intentos con ese email durante 15 minutos, también con la contraseña correcta, con el mismo mensaje genérico y aunque el email no exista. | Frena la fuerza bruta (≈480 intentos al día como máximo) y limita a 15 minutos el bloqueo malicioso. Bloquear hasta que el dueño desbloquee permitiría dejar sin acceso a cualquiera; limitar solo por IP no frena ataques distribuidos. |
| D7 | La recuperación y el cambio de contraseña quedan fuera de esta spec y van a la spec 004 (gestión de cuenta), antes de desplegar. | Son flujos propios y esta spec ya tiene un tamaño considerable. |
| D8 | La contraseña tiene entre 12 y 128 caracteres, admite cualquier carácter, no tiene reglas de composición y no puede ser una contraseña filtrada conocida. | Las reglas de composición no aportan seguridad real (la gente pone «Password1!»; NIST SP 800-63B las desaconseja). La longitud y el rechazo de contraseñas filtradas sí la aportan. |
| D9 | Los emails no distinguen mayúsculas de minúsculas y se ignoran los espacios al principio y al final; los alias no se unifican. | Evita cuentas duplicadas y fallos de inicio de sesión. Unificar alias depende de cada proveedor y confunde a quien los usa a propósito. |
| D10 | Al registrarse se pide un nombre visible obligatorio. Editarlo y borrar la cuenta van a la spec 004. | Los miembros de un hogar se verán entre sí y el email no debe exponerse. El borrado depende de qué pase con los datos compartidos (hogares, gastos), que aún no existen. |

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
- **Sesión:** acceso autenticado de un usuario desde un dispositivo concreto, desde que inicia sesión hasta que la cierra o caduca.
- **Email de autenticación:** cualquier email que el sistema envía como parte de esta spec (código de verificación o aviso de intento de registro).
- **Nombre visible:** nombre con el que los demás miembros de un hogar identifican al usuario.

## Historias de usuario

- **HU-1** _(propuesto)_. Como persona sin cuenta, quiero registrarme con mi email, mi nombre y una contraseña para usar AppCasa.
- **HU-2** _(propuesto)_. Como usuario con la cuenta pendiente, quiero verificar mi email con un código para activar mi cuenta.
- **HU-3.** Como usuario con cuenta activa, quiero iniciar y cerrar sesión en mis dispositivos para usar AppCasa y proteger mi cuenta si pierdo uno.

## Requisitos funcionales

### Registro

- **RF-1** (HU-1). CUANDO un usuario se registra, EL SISTEMA crea su cuenta en estado pendiente y le envía un código de verificación al email indicado.
- **RF-6** (HU-1). SI alguien se registra con un email que ya tiene cuenta, ENTONCES EL SISTEMA responde exactamente igual que a un registro nuevo.
- **RF-7** (HU-1). CUANDO alguien se registra con el email de una cuenta activa, EL SISTEMA envía al dueño de ese email un aviso de intento de registro.
- **RF-8** (HU-1). CUANDO alguien se registra con el email de una cuenta pendiente, EL SISTEMA reenvía un código de verificación a ese email.
- **RF-23** (HU-1). SI alguien se registra con una contraseña de menos de 12 o más de 128 caracteres, ENTONCES EL SISTEMA rechaza el registro e indica los requisitos de la contraseña.
- **RF-24** (HU-1). SI alguien se registra con una contraseña que figura en una lista de contraseñas filtradas conocidas, ENTONCES EL SISTEMA rechaza el registro e indica que la contraseña no es segura.
- **RF-25** (HU-1). EL SISTEMA admite en la contraseña cualquier carácter, incluidos los espacios, sin exigir combinaciones de tipos de caracteres.
- **RF-27** (HU-1). SI alguien se registra sin un nombre visible, ENTONCES EL SISTEMA rechaza el registro.

### Verificación del email

- **RF-3** (HU-2). CUANDO un usuario con la cuenta pendiente solicita un nuevo código, EL SISTEMA le envía un nuevo código de verificación.
- **RF-4** (HU-2). CUANDO un usuario introduce el código de verificación correcto, EL SISTEMA activa su cuenta.
- **RF-5** (HU-2). CUANDO EL SISTEMA activa una cuenta mediante verificación, EL SISTEMA inicia la sesión del usuario.
- **RF-9** (HU-2). SI se introduce un código de verificación emitido hace más de 15 minutos, ENTONCES EL SISTEMA lo rechaza.
- **RF-10** (HU-2). SI se producen 5 intentos fallidos con un mismo código de verificación, ENTONCES EL SISTEMA invalida ese código.
- **RF-11** (HU-2). CUANDO EL SISTEMA emite un código de verificación nuevo para una cuenta, EL SISTEMA invalida el anterior.
- **RF-14** (HU-2). CUANDO alguien solicita un nuevo código, EL SISTEMA responde con el mismo mensaje tanto si existe una cuenta pendiente con ese email como si no.
- **RF-15** (HU-2). SI una cuenta acumula 10 intentos fallidos de verificación, ENTONCES EL SISTEMA rechaza todo código para esa cuenta, incluido el correcto, durante las 24 horas siguientes al décimo fallo.
- **RF-16** (HU-2). SI un código es incorrecto, ha caducado o ha sido invalidado, o la cuenta ha alcanzado el tope de RF-15, ENTONCES EL SISTEMA responde con el mismo mensaje genérico, también si el email no corresponde a ninguna cuenta pendiente.

### Límite de emails

- **RF-12** (HU-1, HU-2). SI un email de autenticación a una dirección superaría el límite de 1 por minuto o 5 por hora, ENTONCES EL SISTEMA no lo envía y responde igual que si lo hubiera enviado.

### Formato del email

- **RF-26** (HU-1, HU-3). EL SISTEMA trata como el mismo email dos direcciones que solo se diferencian en mayúsculas y minúsculas o en espacios al principio o al final.

### Inicio y cierre de sesión

- **RF-2** (HU-2). SI un usuario intenta iniciar sesión con credenciales correctas y su cuenta está pendiente de verificación, ENTONCES EL SISTEMA deniega el acceso e indica que debe verificar su email.
- **RF-13** (HU-3). SI alguien intenta iniciar sesión con credenciales incorrectas, ENTONCES EL SISTEMA responde con el mismo mensaje genérico tanto si el email no existe como si la contraseña es errónea.
- **RF-17** (HU-3). CUANDO un usuario inicia sesión con credenciales correctas y su cuenta está activa, EL SISTEMA inicia una sesión para ese dispositivo.
- **RF-18** (HU-3). CUANDO un usuario cierra sesión, EL SISTEMA finaliza la sesión del dispositivo actual sin afectar a sus demás sesiones.
- **RF-19** (HU-3). CUANDO un usuario cierra sesión en todos los dispositivos, EL SISTEMA finaliza todas sus sesiones.
- **RF-20** (HU-3). SI una sesión lleva 30 días sin usarse, ENTONCES EL SISTEMA la finaliza.
- **RF-21** (HU-3). SI han pasado 90 días desde que se inició una sesión, ENTONCES EL SISTEMA la finaliza aunque se haya seguido usando.
- **RF-22** (HU-3). SI se producen 5 intentos fallidos de inicio de sesión con un mismo email en 15 minutos, ENTONCES EL SISTEMA rechaza todo intento de inicio de sesión con ese email durante los 15 minutos siguientes, con el mismo mensaje genérico de RF-13, incluso con la contraseña correcta y aunque el email no tenga cuenta.

## Requisitos no funcionales

- **RNF-1.** EL SISTEMA exige una sesión válida en toda operación salvo las marcadas explícitamente como públicas: registro, verificación del email, solicitud de un nuevo código e inicio de sesión.
- **RNF-2.** EL SISTEMA responde al registro, al inicio de sesión, a la solicitud de código y a la verificación en un tiempo que no permite distinguir si el email tiene cuenta: la diferencia entre los tiempos medios de ambos casos no supera 50 ms, medida sobre 100 peticiones de cada tipo.

## Casos límite

- Registro con un email que ya tiene cuenta (activa o pendiente): RF-6, RF-7, RF-8.
- Registro repetido para saltarse el límite de reenvío o para llenar de avisos un buzón ajeno: RF-12.
- Código caducado, agotado por intentos fallidos o sustituido por uno nuevo: RF-9, RF-10, RF-11.
- Fuerza bruta acumulada pidiendo códigos nuevos una y otra vez: RF-15, RF-16.
- Dispositivo perdido o robado: RF-19.
- Fuerza bruta en el inicio de sesión, y bloqueo malicioso de la cuenta de otra persona: RF-22 (como mucho 15 minutos seguidos).
- El mismo email escrito con distintas mayúsculas o con espacios: RF-26.
- Resto de casos límite: pendiente de la ronda 4 (ver dudas abiertas).

## Fuera de alcance

- Pertenencia a hogares, membresías y roles: spec 002.
- Invitaciones a hogares: spec 003.
- Recuperación y cambio de contraseña, edición del nombre visible y borrado de cuenta: spec 004 (gestión de cuenta), antes de desplegar.
- Interfaz de usuario (pantallas, navegación, redirecciones): la decide cada cliente; esta spec define el comportamiento de la API.

## Criterios de finalización

- Todos los RF y RNF tienen al menos un test que los referencia por su id (`RF-n`) y está en verde.
- `pnpm check` y `pnpm test:e2e` en verde.
- El reviewer da `VEREDICTO: APROBADO`.

## Dudas abiertas

La spec no puede pasar a `aprobada` con dudas abiertas.

- [NECESITA ACLARACIÓN] **Confirmación** de HU-1, HU-2 y las definiciones.
- [NECESITA ACLARACIÓN] **Cuentas pendientes abandonadas:** ¿una cuenta que nunca se verifica caduca o se elimina?
- [NECESITA ACLARACIÓN] **Rol de plataforma** (superadministrador de AppCasa): previsiblemente fuera de alcance; confirmar.
- [NECESITA ACLARACIÓN] **Nombre visible:** ¿longitud mínima y máxima?
- [NECESITA ACLARACIÓN] **Tamaño de la spec:** con 27 RF, ¿se divide antes del plan (p. ej. registro y verificación por un lado, sesiones por otro)?

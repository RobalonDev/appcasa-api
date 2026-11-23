# Spec 001: Autenticación

- **Estado:** borrador <!-- borrador | aprobada | implementada -->
- **Fecha:** 2026-11-23
- **ADRs relacionados:** [0005](../../adr/0005-autenticacion-propia.md), [0006](../../adr/0006-hogar-como-tenant.md)
- **Entrevista:** completa (4 rondas). Siguiente paso: `/sdd-clarify 001-authentication`.

<!--
Solo QUÉ y POR QUÉ. Nada de tecnología, tablas, endpoints ni nombres de ficheros: eso va en plan.md.
Cada requisito funcional en formato EARS y verificable (debe poder convertirse en un test).
-->

## Contexto y objetivo

Una persona crea **una única cuenta** en AppCasa y la usa desde web y móvil. Se identifica con su email y una contraseña.

El registro tiene **dos pasos**: primero la persona indica su email y recibe un código; después introduce ese código junto con su nombre y su contraseña, y entonces se crea la cuenta. Hasta completar el segundo paso no existe ninguna cuenta.

La cuenta es **global e independiente de los hogares**: existe aunque no pertenezca a ninguno. La pertenencia a uno o varios hogares, y los roles dentro de cada uno, son autorización y se especifican en la spec 002 (el rol pertenece a la membresía, no al usuario: ADR-0006).

El sistema **deniega por defecto**: toda operación requiere una sesión válida salvo las marcadas explícitamente como públicas.

**Principio de no enumeración:** ninguna operación pública (solicitar el registro, completarlo, iniciar sesión) permite averiguar si un email tiene cuenta a quien no conoce su contraseña: ni por el mensaje ni por el tiempo de respuesta.

### Decisiones del autor y su porqué

| Id | Decisión | Por qué |
|---|---|---|
| D1 | Solo se puede crear una cuenta tras demostrar, con un código enviado al email, que se controla ese email. | Sin esa prueba, alguien podría crear una cuenta con un email ajeno, recibir invitaciones a hogares dirigidas a esa persona (spec 003) y hacer poco fiable cualquier recuperación por email. |
| D1-código | La verificación se hace con un código, no con un enlace. | Funciona mejor en móvil: no obliga a salir de la app. |
| D1a | _Sustituida por D11._ (Inicio de sesión con una cuenta pendiente: ya no existen cuentas pendientes.) | — |
| D1b | Solicitar el registro con un email que ya tiene cuenta recibe la misma respuesta que con un email nuevo; el aviso se envía por email al dueño. | La solicitud de registro no pide contraseña: cualquier diferencia en la respuesta confirmaría qué emails tienen cuenta (recomendación OWASP). |
| D1c | Al completar el registro, el usuario queda con la sesión iniciada. | Acaba de demostrar que controla el email y de elegir su contraseña; pedirle un login más es fricción sin ganancia. |
| D1d | El código caduca a los 15 min, se invalida tras 5 intentos fallidos y solo hay uno válido a la vez por email. | Sin límites, un código de 6 dígitos se puede adivinar por fuerza bruta. |
| D2 | Todos los emails de autenticación a una misma dirección (código o aviso) comparten un límite de 1 por minuto y 5 por hora; si se supera, no se envía, pero la respuesta es idéntica. | Repetir la solicitud de registro permitía saltarse el límite de reenvío, y los avisos de intento de registro permitían llenar de spam un buzón ajeno. Una regla común cierra ambos huecos sin filtrar nada. |
| D3 | Máximo 10 intentos fallidos de verificación por email en 24 horas, sumando todos sus códigos. | Con D1d y D2, un atacante insistente aún podía probar unos 600 códigos al día (≈20 % de acertar en un año). Con el tope, ≈1 entre 100.000 al día. Se acepta que una persona bloqueada no lo sepa (principio de no enumeración). |
| D4 | Cada dispositivo tiene su propia sesión; cerrar sesión afecta solo al actual, y existe «cerrar sesión en todos los dispositivos». | El caso de uso es web y móvil a la vez, y quien pierde el móvil debe poder echar a ese dispositivo sin tenerlo. |
| D5 | Una sesión caduca tras 30 días sin uso y, en cualquier caso, a los 90 días de iniciarse. | Equilibrio entre comodidad en móvil (unos 4 inicios de sesión al año para un uso diario) y la vida máxima de una sesión robada. |
| D6 | Tras 5 intentos fallidos de inicio de sesión con un mismo email en 15 minutos, se rechazan los intentos con ese email durante 15 minutos, también con la contraseña correcta, con el mismo mensaje genérico y aunque el email no exista. | Frena la fuerza bruta (≈480 intentos al día como máximo) y limita a 15 minutos el bloqueo malicioso. Bloquear hasta que el dueño desbloquee permitiría dejar sin acceso a cualquiera; limitar solo por IP no frena ataques distribuidos. |
| D7 | La recuperación y el cambio de contraseña quedan fuera de esta spec y van a la spec 004 (gestión de cuenta), antes de desplegar. | Son flujos propios y esta spec ya tiene un tamaño considerable. |
| D8 | La contraseña tiene entre 12 y 128 caracteres, admite cualquier carácter, no tiene reglas de composición y no puede ser una contraseña filtrada conocida. | Las reglas de composición no aportan seguridad real (la gente pone «Password1!»; NIST SP 800-63B las desaconseja). La longitud y el rechazo de contraseñas filtradas sí la aportan. |
| D9 | Los emails no distinguen mayúsculas de minúsculas y se ignoran los espacios al principio y al final; los alias no se unifican. | Evita cuentas duplicadas y fallos de inicio de sesión. Unificar alias depende de cada proveedor y confunde a quien los usa a propósito. |
| D10 | Al registrarse se pide un nombre visible obligatorio. Editarlo y borrar la cuenta van a la spec 004. | Los miembros de un hogar se verán entre sí y el email no debe exponerse. El borrado depende de qué pase con los datos compartidos (hogares, gastos), que aún no existen. |
| D11 | Registro en dos pasos con el email primero: 1) se indica el email y se recibe un código, sin crear cuenta; 2) se introducen código, nombre y contraseña, y se crea la cuenta. | Cierra el **secuestro por pre-registro**: con el flujo anterior, un atacante podía registrar el email de la víctima con su propia contraseña, y cuando la víctima verificaba el código activaba una cuenta que el atacante podía usar. Ahora nadie puede fijar una contraseña sobre un email que no controla. Elimina además las cuentas pendientes. |
| D12 | No existe rol de plataforma (superadministrador). | Rompería el aislamiento entre hogares (ADR-0006) y sería el objetivo más valioso para un atacante. Si hace falta soporte, tendrá su propia spec y su ADR. |
| D13 | El nombre visible tiene entre 2 y 30 caracteres, contados sin los espacios del principio y del final. | Evita nombres vacíos o de solo espacios, y textos que rompan la interfaz de los demás miembros. |
| D14 | Cómo dividir el trabajo se decide al planificar: si el plan sale con más de 10 tareas, se elige entonces. | El autor prefiere decidirlo con el número real de tareas delante. |

## Usuarios

- **Persona sin cuenta:** quiere registrarse.
- **Usuario:** tiene una cuenta y quiere usar AppCasa desde uno o varios dispositivos.

## Definiciones

- **Credenciales:** el email y la contraseña de una cuenta.
- **Código de verificación:** código que el sistema envía al email indicado al solicitar el registro, para demostrar que quien se registra controla ese email.
- **Registro en curso:** solicitud de registro para un email sin cuenta cuyo código de verificación sigue siendo válido.
- **Sesión:** acceso autenticado de un usuario desde un dispositivo concreto, desde que se inicia hasta que se cierra o caduca.
- **Email de autenticación:** cualquier email que el sistema envía como parte de esta spec (código de verificación o aviso de intento de registro).
- **Nombre visible:** nombre con el que los demás miembros de un hogar identifican al usuario.

## Historias de usuario

- **HU-1.** Como persona sin cuenta, quiero registrarme con mi email, mi nombre y una contraseña para usar AppCasa.
- **HU-2.** Como persona que se registra, quiero confirmar con un código que el email es mío, para que nadie pueda crear una cuenta con él.
- **HU-3.** Como usuario, quiero iniciar y cerrar sesión en mis dispositivos para usar AppCasa y proteger mi cuenta si pierdo uno.

## Requisitos funcionales

> Los ids son estables: si un requisito se elimina, su id no se reutiliza (ver «Requisitos eliminados»).

### Registro

- **RF-1** (HU-1). CUANDO alguien solicita registrarse con un email que no tiene cuenta, EL SISTEMA le envía un código de verificación a ese email, sin crear ninguna cuenta.
- **RF-6** (HU-1). SI alguien solicita registrarse con un email que ya tiene cuenta, ENTONCES EL SISTEMA responde exactamente igual que con un email sin cuenta.
- **RF-7** (HU-1). CUANDO alguien solicita registrarse con el email de una cuenta existente, EL SISTEMA envía al dueño de ese email un aviso de intento de registro en lugar de un código.
- **RF-4** (HU-1, HU-2). CUANDO alguien introduce el código de verificación correcto junto con un nombre visible y una contraseña válidos, EL SISTEMA crea la cuenta con esos datos.
- **RF-5** (HU-1). CUANDO EL SISTEMA crea una cuenta al completar un registro, EL SISTEMA inicia la sesión del usuario.
- **RF-23** (HU-1). SI al completar el registro la contraseña tiene menos de 12 o más de 128 caracteres, ENTONCES EL SISTEMA no crea la cuenta e indica los requisitos de la contraseña.
- **RF-24** (HU-1). SI al completar el registro la contraseña figura en una lista de contraseñas filtradas conocidas, ENTONCES EL SISTEMA no crea la cuenta e indica que la contraseña no es segura.
- **RF-25** (HU-1). EL SISTEMA admite en la contraseña cualquier carácter, incluidos los espacios, sin exigir combinaciones de tipos de caracteres.
- **RF-27** (HU-1). SI al completar el registro el nombre visible, sin los espacios del principio y del final, tiene menos de 2 o más de 30 caracteres, ENTONCES EL SISTEMA no crea la cuenta e indica los requisitos del nombre.
- **RF-28** (HU-1). SI al completar el registro con un código correcto se rechaza la contraseña o el nombre visible, ENTONCES EL SISTEMA mantiene válido el código y no cuenta el intento como fallido.

### Verificación del código

- **RF-9** (HU-2). SI se introduce un código de verificación emitido hace más de 15 minutos, ENTONCES EL SISTEMA lo rechaza.
- **RF-10** (HU-2). SI se producen 5 intentos fallidos con un mismo código de verificación, ENTONCES EL SISTEMA invalida ese código.
- **RF-11** (HU-2). CUANDO EL SISTEMA emite un código de verificación nuevo para un email, EL SISTEMA invalida el anterior para ese email.
- **RF-15** (HU-2). SI se acumulan 10 intentos fallidos de verificación para un mismo email en 24 horas, ENTONCES EL SISTEMA rechaza todo código para ese email, incluido el correcto, durante las 24 horas siguientes al décimo fallo.
- **RF-16** (HU-2). SI un código es incorrecto, ha caducado o ha sido invalidado, o el email ha alcanzado el tope de RF-15, ENTONCES EL SISTEMA responde con el mismo mensaje genérico, también si no hay ningún registro en curso para ese email.

### Límite de emails

- **RF-12** (HU-1, HU-2). SI un email de autenticación a una dirección superaría el límite de 1 por minuto o 5 por hora, ENTONCES EL SISTEMA no lo envía y responde igual que si lo hubiera enviado.

### Formato del email

- **RF-26** (HU-1, HU-3). EL SISTEMA trata como el mismo email dos direcciones que solo se diferencian en mayúsculas y minúsculas o en espacios al principio o al final.

### Inicio y cierre de sesión

- **RF-17** (HU-3). CUANDO un usuario inicia sesión con credenciales correctas, EL SISTEMA inicia una sesión para ese dispositivo.
- **RF-13** (HU-3). SI alguien intenta iniciar sesión con credenciales incorrectas, ENTONCES EL SISTEMA responde con el mismo mensaje genérico tanto si el email no existe como si la contraseña es errónea.
- **RF-22** (HU-3). SI se producen 5 intentos fallidos de inicio de sesión con un mismo email en 15 minutos, ENTONCES EL SISTEMA rechaza todo intento de inicio de sesión con ese email durante los 15 minutos siguientes, con el mismo mensaje genérico de RF-13, incluso con la contraseña correcta y aunque el email no tenga cuenta.
- **RF-18** (HU-3). CUANDO un usuario cierra sesión, EL SISTEMA finaliza la sesión del dispositivo actual sin afectar a sus demás sesiones.
- **RF-19** (HU-3). CUANDO un usuario cierra sesión en todos los dispositivos, EL SISTEMA finaliza todas sus sesiones.
- **RF-20** (HU-3). SI una sesión lleva 30 días sin usarse, ENTONCES EL SISTEMA la finaliza.
- **RF-21** (HU-3). SI han pasado 90 días desde que se inició una sesión, ENTONCES EL SISTEMA la finaliza aunque se haya seguido usando.

### Requisitos eliminados

| Id | Motivo |
|---|---|
| RF-2 | Inicio de sesión con una cuenta pendiente: con D11 ya no existen cuentas pendientes. |
| RF-3 | Solicitar un código nuevo: es volver a solicitar el registro (RF-1, RF-6, RF-11). |
| RF-8 | Reenviar el código al registrarse con un email pendiente: cubierto por RF-1 y RF-11. |
| RF-14 | Respuesta idéntica a la solicitud de código: cubierto por RF-6. |

## Requisitos no funcionales

- **RNF-1.** EL SISTEMA exige una sesión válida en toda operación salvo las marcadas explícitamente como públicas: solicitar el registro, completar el registro e iniciar sesión.
- **RNF-2.** EL SISTEMA responde a la solicitud de registro, a completar el registro y al inicio de sesión en un tiempo que no permite distinguir si el email tiene cuenta: la diferencia entre los tiempos medios de ambos casos no supera 50 ms, medida sobre 100 peticiones de cada tipo.

## Casos límite

- Pre-registro malicioso con el email de otra persona: imposible, porque la cuenta solo se crea con el código enviado a ese email (D11; RF-1, RF-4).
- Solicitud de registro con un email que ya tiene cuenta: RF-6, RF-7.
- Solicitudes de registro repetidas para saltarse el límite de envíos o para llenar de avisos un buzón ajeno: RF-12.
- Código caducado, agotado por intentos fallidos o sustituido por uno nuevo: RF-9, RF-10, RF-11.
- Fuerza bruta acumulada pidiendo códigos nuevos una y otra vez: RF-15, RF-16.
- Código correcto con una contraseña o un nombre no válidos: RF-28.
- Fuerza bruta en el inicio de sesión, y bloqueo malicioso de la cuenta de otra persona: RF-22 (como mucho 15 minutos seguidos).
- El mismo email escrito con distintas mayúsculas o con espacios: RF-26.
- Dispositivo perdido o robado: RF-19.

## Fuera de alcance

- Pertenencia a hogares, membresías y roles: spec 002.
- Invitaciones a hogares: spec 003.
- Recuperación y cambio de contraseña, edición del nombre visible y borrado de cuenta: spec 004 (gestión de cuenta), antes de desplegar.
- Rol de plataforma o superadministrador (D12).
- Interfaz de usuario (pantallas, navegación, redirecciones): la decide cada cliente; esta spec define el comportamiento de la API.

## Criterios de finalización

- Todos los RF y RNF tienen al menos un test que los referencia por su id (`RF-n`) y está en verde.
- `pnpm check` y `pnpm test:e2e` en verde.
- El reviewer da `VEREDICTO: APROBADO`.

## Dudas abiertas

Ninguna.

> Nota para el plan (D14): si salen más de 10 tareas, decidir entonces cómo dividir el trabajo.

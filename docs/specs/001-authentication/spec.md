# Spec 001: Autenticación

- **Estado:** aprobada <!-- borrador | aprobada | implementada -->
- **Fecha:** 2026-11-23
- **ADRs relacionados:** [0005](../../adr/0005-autenticacion-propia.md), [0006](../../adr/0006-hogar-como-tenant.md)
- **Entrevista:** 4 rondas. **Revisiones de `/sdd-clarify`:** 4 (12 → 7 → 3 → 1 problemas). **Aprobada por el autor** el 2026-11-23 aplicando la regla 8 de `sdd`. Siguiente paso: plan.
- **Cambios tras la aprobación:** 2026-11-24, D19–D21 (aclaraciones surgidas en `/sdd-clarify` del plan; aprobadas por el autor).

<!--
Solo QUÉ y POR QUÉ. Nada de tecnología, tablas, endpoints ni nombres de ficheros: eso va en plan.md.
Cada requisito funcional en formato EARS y verificable (debe poder convertirse en un test).
-->

## Contexto y objetivo

Una persona crea **una única cuenta** en AppCasa y la usa desde web y móvil. Se identifica con su email y una contraseña.

El registro tiene **dos pasos**: primero la persona indica su email y recibe un código; después introduce de nuevo su email junto con ese código, su nombre y su contraseña, y entonces se crea la cuenta. Hasta completar el segundo paso no existe ninguna cuenta.

La cuenta es **global e independiente de los hogares**: existe aunque no pertenezca a ninguno. La pertenencia a uno o varios hogares, y los roles dentro de cada uno, son autorización y se especifican en la spec 002 (el rol pertenece a la membresía, no al usuario: ADR-0006).

El sistema **deniega por defecto**: toda operación requiere una sesión válida salvo las marcadas explícitamente como públicas.

**Principio de no enumeración:** ninguna operación pública (solicitar el registro, completarlo, iniciar sesión) permite averiguar en la práctica si un email tiene cuenta a quien no conoce su contraseña: ni por el mensaje ni por el tiempo de respuesta (umbral medible en RNF-2).

**Regla de precedencia:** cuando se aplica un límite o un bloqueo (RF-12, RF-15, RF-22) o un rechazo por datos no válidos (RF-23, RF-24, RF-27, RF-35), prevalece sobre los requisitos del flujo normal (RF-1, RF-4, RF-7, RF-17) en las operaciones a las que se aplica: el bloqueo de RF-22 afecta solo al inicio de sesión, no a completar el registro (D20). Por ejemplo, durante el bloqueo de RF-15 una solicitud de registro se responde igual, pero no se emite ni se envía ningún código (RF-42) y ningún código permite completar el registro.

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
| D4 | Cada inicio de sesión tiene su propia sesión; cerrar sesión afecta solo a esa, y existe «cerrar sesión en todos los dispositivos». | El caso de uso es web y móvil a la vez, y quien pierde el móvil debe poder echar a ese dispositivo sin tenerlo. |
| D5 | Una sesión caduca tras 30 días sin uso y, en cualquier caso, a los 90 días de iniciarse. | Equilibrio entre comodidad en móvil (unos 4 inicios de sesión al año para un uso diario) y la vida máxima de una sesión robada. |
| D6 | Tras 5 intentos fallidos de inicio de sesión con un mismo email en 15 minutos, se rechazan los intentos con ese email durante 15 minutos, también con la contraseña correcta, con el mismo mensaje genérico y aunque el email no exista. Un inicio de sesión correcto reinicia la cuenta de fallos. | Frena la fuerza bruta (≈480 intentos al día como máximo). Bloquear hasta que el dueño desbloquee permitiría dejar sin acceso a cualquiera con muy poco esfuerzo; limitar solo por IP no frena ataques distribuidos. |
| D7 | La recuperación y el cambio de contraseña quedan fuera de esta spec y van a la spec 004 (gestión de cuenta), antes de desplegar. | Son flujos propios y esta spec ya tiene un tamaño considerable. |
| D8 | La contraseña tiene entre 12 y 128 caracteres, admite cualquier carácter, no tiene reglas de composición y no puede ser una contraseña filtrada conocida. | Las reglas de composición no aportan seguridad real (la gente pone «Password1!»; NIST SP 800-63B las desaconseja). La longitud y el rechazo de contraseñas filtradas sí la aportan. |
| D9 | Los emails no distinguen mayúsculas de minúsculas y se ignoran los espacios al principio y al final; los alias no se unifican. | Evita cuentas duplicadas y fallos de inicio de sesión. Unificar alias depende de cada proveedor y confunde a quien los usa a propósito. |
| D10 | Al registrarse se pide un nombre visible obligatorio. Editarlo y borrar la cuenta van a la spec 004. | Los miembros de un hogar se verán entre sí y el email no debe exponerse. El borrado depende de qué pase con los datos compartidos (hogares, gastos), que aún no existen. |
| D11 | Registro en dos pasos con el email primero: 1) se indica el email y se recibe un código, sin crear cuenta; 2) se introducen código, nombre y contraseña, y se crea la cuenta. | Cierra el **secuestro por pre-registro**: con el flujo anterior, un atacante podía registrar el email de la víctima con su propia contraseña, y cuando la víctima verificaba el código activaba una cuenta que el atacante podía usar. Ahora nadie puede fijar una contraseña sobre un email que no controla. Elimina además las cuentas pendientes. |
| D12 | No existe rol de plataforma (superadministrador). | Rompería el aislamiento entre hogares (ADR-0006) y sería el objetivo más valioso para un atacante. Si hace falta soporte, tendrá su propia spec y su ADR. |
| D13 | El nombre visible tiene entre 2 y 30 caracteres, contados sin los espacios del principio y del final. | Evita nombres vacíos o de solo espacios, y textos que rompan la interfaz de los demás miembros. |
| D14 | Cómo dividir el trabajo se decide al planificar: si el plan sale con más de 10 tareas, se elige entonces. | El autor prefiere decidirlo con el número real de tareas delante. |
| D15 | Se acepta que un atacante persistente pueda encadenar bloqueos de RF-22 e impedir indefinidamente nuevos inicios de sesión con un email. | No obtiene acceso ni afecta a las sesiones ya abiertas; es asumible en una app de hogar. La spec 004 podrá ofrecer otra vía de entrada. |
| D16 | Solo cuenta como intento fallido de verificación un código erróneo para un email con registro en curso, fuera del bloqueo de RF-15. Se acepta que un tercero pueda retrasar el registro de otra persona (bloquearlo 24 h o invalidar su código). | Contar todos los intentos permitiría bloquear el registro de cualquier email sin pedir siquiera un código, y que el bloqueo se alargara solo. La interferencia no da acceso a nada y D2 la limita. |
| D17 | Una sesión finalizada deja de permitir cualquier operación en 5 minutos como máximo. | Encaja con el diseño de ADR-0005. Un dispositivo perdido conserva acceso como mucho 5 minutos después de «cerrar sesión en todos los dispositivos». |
| D18 | Si el sistema detecta que una sesión ha sido copiada, finaliza esa sesión sin afectar a las demás. | Es la respuesta estándar ante el robo de una sesión: el atacante pierde el acceso y no tiene la contraseña para volver a entrar. Finalizarlas todas convertiría un fallo de red en un cierre de sesión en todos los dispositivos. |
| D19 | Los envíos en curso, también los de resultado incierto, cuentan para el límite de RF-12. _(2026-11-24)_ | Garantiza que el límite nunca se supera (RNF-3) aunque el sistema falle a mitad de un envío. A cambio, mientras dura un envío que acaba fallando (unos segundos), una nueva solicitud puede quedarse sin envío. |
| D20 | Completar el registro no se ve afectado por el bloqueo de inicio de sesión de RF-22. _(2026-11-24)_ | El bloqueo frena la adivinación de contraseñas; al completar el registro no hay contraseña que adivinar, porque el código ya demuestra que se controla el email. Aplicarlo daría a un tercero otra forma de retrasar registros ajenos. |
| D21 | RNF-1 cubre las operaciones sobre datos de usuarios. Renovar y cerrar una sesión se acreditan con la propia sesión aunque su acceso de corta duración haya caducado. _(2026-11-24)_ | Sin eso, un dispositivo que lleva más de unos minutos sin usarse no podría renovar ni cerrar su sesión, y la comprobación de estado que usa la infraestructura exigiría una cuenta. |

## Usuarios

- **Persona sin cuenta:** quiere registrarse.
- **Usuario:** tiene una cuenta y quiere usar AppCasa desde uno o varios dispositivos.

## Definiciones

- **Carácter:** cada punto de código Unicode, contado tras normalizar el texto a su forma compuesta estándar. Una letra con tilde cuenta como un carácter; algunos emojis cuentan como varios.
- **Credenciales:** el email y la contraseña de una cuenta.
- **Código de verificación:** código de 6 dígitos que el sistema envía al email indicado al solicitar el registro, para demostrar que quien se registra controla ese email.
- **Registro en curso:** solicitud de registro para un email sin cuenta cuyo código de verificación sigue siendo válido.
- **Intento fallido de verificación:** código erróneo introducido para un email con registro en curso, mientras ese email no está bloqueado por RF-15. Los intentos sobre emails sin registro en curso no son intentos fallidos.
- **Intento fallido de inicio de sesión:** inicio de sesión con credenciales incorrectas y un email de formato válido. No lo son los rechazos por RF-35 ni los intentos rechazados durante el bloqueo de RF-22.
- **Contraseña filtrada:** contraseña que figura en la lista de contraseñas filtradas que usa el sistema (qué lista se usa se fija en el plan).
- **Nombre visible:** nombre con el que los demás miembros de un hogar identifican al usuario. Se guarda sin los espacios en blanco de cualquier tipo del principio y del final. Qué longitud y qué caracteres admite lo fija RF-27.
- **Sesión:** acceso autenticado de un usuario. Cada inicio de sesión, y cada registro completado, crea una sesión nueva, aunque sea desde el mismo dispositivo. Dura hasta que se cierra, caduca o el sistema la finaliza por haberse copiado (RF-36). Su tiempo sin uso cuenta desde que se crea.
- **Sesión copiada:** sesión de la que el sistema detecta que existe una copia en otras manos (cómo se detecta se fija en el plan).
- **Uso de una sesión:** cualquier operación realizada con una sesión válida, aunque después se rechace por otro motivo.
- **Sesión válida:** sesión que no ha finalizado. Como excepción tolerada, durante los 5 minutos siguientes a su finalización el sistema puede tratarla todavía como válida (RNF-4).
- **Email de autenticación:** cualquier email que el sistema envía como parte de esta spec (código de verificación o aviso de intento de registro).
- **Envío realizado:** email de autenticación aceptado por el servicio de correo.
- **Envío en curso:** email de autenticación cuyo envío se ha iniciado y del que el sistema aún no sabe si el servicio de correo lo ha aceptado, incluido el que nunca llega a saberlo (resultado incierto).

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
- **RF-35** (HU-1, HU-2, HU-3). SI en cualquier operación el email no tiene formato de dirección de email o supera 254 caracteres (contados sin los espacios del principio y del final), ENTONCES EL SISTEMA rechaza la petición e indica que el email no es válido.
- **RF-4** (HU-1, HU-2). CUANDO alguien introduce su email, el código de verificación correcto para ese email, un nombre visible y una contraseña válidos, EL SISTEMA crea la cuenta con esos datos.
- **RF-5** (HU-1). CUANDO EL SISTEMA crea una cuenta al completar un registro, EL SISTEMA crea una sesión nueva para el usuario.
- **RF-30** (HU-1). SI llegan a la vez varias peticiones para completar el registro de un mismo email, ENTONCES EL SISTEMA crea como mucho una cuenta; las peticiones que no la crean reciben el mensaje genérico de RF-16.
- **RF-40** (HU-1). EL SISTEMA nunca tiene más de una cuenta para un mismo email (según RF-26).
- **RF-41** (HU-1, HU-2). SI alguien completa el registro con un código vigente para un email que ya tiene cuenta, ENTONCES EL SISTEMA no crea ninguna cuenta, responde con el mensaje genérico de RF-16 y el intento no cuenta como fallido.
- **RF-23** (HU-1). SI al completar el registro la contraseña tiene menos de 12 o más de 128 caracteres, ENTONCES EL SISTEMA no crea la cuenta e indica los requisitos de la contraseña.
- **RF-24** (HU-1). SI al completar el registro la contraseña es una contraseña filtrada, ENTONCES EL SISTEMA no crea la cuenta e indica que la contraseña no es segura.
- **RF-25** (HU-1). EL SISTEMA admite en la contraseña cualquier carácter, incluidos los espacios, sin exigir combinaciones de tipos de caracteres.
- **RF-39** (HU-1, HU-3). EL SISTEMA trata como la misma contraseña dos textos canónicamente equivalentes en Unicode (que solo difieren en la forma de codificar los mismos caracteres). Las variantes de compatibilidad, como las letras de ancho completo, son contraseñas distintas.
- **RF-27** (HU-1). SI al completar el registro el nombre visible, sin los espacios del principio y del final, tiene menos de 2 o más de 30 caracteres, o contiene caracteres de control, de formato (como el espacio de ancho cero), separadores de línea o de párrafo, o caracteres de uso privado o sin asignar en Unicode, ENTONCES EL SISTEMA no crea la cuenta e indica los requisitos del nombre.
- **RF-28** (HU-1). SI al completar el registro la contraseña o el nombre visible no son válidos, ENTONCES EL SISTEMA rechaza la petición sin evaluar el código: el código sigue siendo válido y el intento no cuenta como fallido.
- **RF-37** (HU-1). CUANDO alguien completa el registro, EL SISTEMA valida primero el formato del email (RF-35), después el nombre visible y la contraseña (RF-28) y por último el código.

### Verificación del código

- **RF-34** (HU-2). EL SISTEMA genera códigos de verificación de 6 dígitos.
- **RF-9** (HU-2). SI se introduce un código de verificación emitido hace más de 15 minutos, ENTONCES EL SISTEMA lo rechaza.
- **RF-10** (HU-2). SI se producen 5 intentos fallidos de verificación mientras un mismo código está vigente, ENTONCES EL SISTEMA invalida ese código.
- **RF-11** (HU-2). CUANDO EL SISTEMA emite un código de verificación nuevo para un email, EL SISTEMA invalida el anterior para ese email.
- **RF-29** (HU-2). CUANDO EL SISTEMA crea una cuenta, EL SISTEMA invalida todo código de verificación vigente para ese email.
- **RF-15** (HU-2). SI se acumulan 10 intentos fallidos de verificación para un mismo email en 24 horas, ENTONCES EL SISTEMA rechaza todo código para ese email, incluido el correcto, durante las 24 horas siguientes al décimo fallo.
- **RF-16** (HU-2). SI un código es incorrecto, ha caducado o ha sido invalidado, o el email ha alcanzado el tope de RF-15, ENTONCES EL SISTEMA responde con el mismo mensaje genérico, también si no hay ningún registro en curso para ese email.
- **RF-42** (HU-2). MIENTRAS el registro de un email está bloqueado por RF-15, EL SISTEMA no emite ni envía códigos para ese email: responde igual que siempre, no consume el cupo de RF-12 y no invalida el código anterior.

### Límite de emails

- **RF-12** (HU-1, HU-2). SI enviar un email de autenticación a una dirección supondría más de 1 envío en el último minuto o más de 5 en la última hora, ENTONCES EL SISTEMA no lo envía y responde igual que si lo hubiera enviado. Cuentan los envíos realizados y los envíos en curso; los que fallan no cuentan (RF-38, D19).
- **RF-32** (HU-2). SI RF-12 impide enviar un código de verificación, ENTONCES EL SISTEMA no emite un código nuevo y el anterior sigue siendo válido.
- **RF-38** (HU-1, HU-2). SI falla el envío de un email de autenticación, ENTONCES EL SISTEMA responde igual que si se hubiera enviado, no emite el código nuevo (el anterior sigue siendo válido) y ese envío no cuenta para RF-12.

### Formato del email

- **RF-26** (HU-1, HU-3). EL SISTEMA trata como el mismo email dos direcciones que solo se diferencian en mayúsculas y minúsculas o en espacios en blanco de cualquier tipo al principio o al final.

### Inicio y cierre de sesión

- **RF-17** (HU-3). CUANDO un usuario inicia sesión con credenciales correctas, EL SISTEMA crea una sesión nueva.
- **RF-13** (HU-3). SI alguien intenta iniciar sesión con credenciales incorrectas, ENTONCES EL SISTEMA responde con el mismo mensaje genérico tanto si el email no existe como si la contraseña es errónea.
- **RF-22** (HU-3). SI se producen 5 intentos fallidos de inicio de sesión con un mismo email en 15 minutos sin ningún inicio de sesión correcto entre ellos, ENTONCES EL SISTEMA rechaza todo intento de inicio de sesión con ese email durante los 15 minutos siguientes al quinto fallo, con el mismo mensaje genérico de RF-13, incluso con la contraseña correcta y aunque el email no tenga cuenta.
- **RF-31** (HU-3). MIENTRAS un email está bloqueado por RF-22, EL SISTEMA no cuenta como fallidos los intentos que rechaza.
- **RF-18** (HU-3). CUANDO un usuario cierra sesión, EL SISTEMA finaliza la sesión con la que se hace la petición sin afectar a sus demás sesiones.
- **RF-19** (HU-3). CUANDO un usuario cierra sesión en todos los dispositivos, EL SISTEMA finaliza todas las sesiones que tenga en ese momento; las que se creen después no se ven afectadas.
- **RF-20** (HU-3). SI una sesión lleva 30 días sin usarse, ENTONCES EL SISTEMA la finaliza.
- **RF-21** (HU-3). SI han pasado 90 días desde que se creó una sesión, ENTONCES EL SISTEMA la finaliza aunque se haya seguido usando.
- **RF-33** (HU-3). SI se intenta una operación que requiere sesión sin sesión, con una sesión inexistente o con una finalizada hace más de 5 minutos, ENTONCES EL SISTEMA la rechaza e indica que hay que iniciar sesión.
- **RF-36** (HU-3). SI EL SISTEMA detecta que una sesión ha sido copiada, ENTONCES EL SISTEMA la finaliza sin afectar a las demás sesiones del usuario.

### Requisitos eliminados

| Id | Motivo |
|---|---|
| RF-2 | Inicio de sesión con una cuenta pendiente: con D11 ya no existen cuentas pendientes. |
| RF-3 | Solicitar un código nuevo: es volver a solicitar el registro (RF-1, RF-6, RF-11). |
| RF-8 | Reenviar el código al registrarse con un email pendiente: cubierto por RF-1 y RF-11. |
| RF-14 | Respuesta idéntica a la solicitud de código: cubierto por RF-6. |

## Requisitos no funcionales

- **RNF-1.** EL SISTEMA exige una sesión válida en toda operación salvo las marcadas explícitamente como públicas: solicitar el registro, completar el registro e iniciar sesión. Renovar una sesión y cerrarla se acreditan con la propia sesión, aunque el acceso de corta duración que lleva asociado haya caducado (D21).
- **RNF-2.** EL SISTEMA responde en un tiempo que no permite distinguir si un email tiene cuenta: en cada operación, la diferencia entre los tiempos medios de cualquier par de los casos indicados no supera 50 ms, medida sobre 100 peticiones por caso, cada una con un email distinto para que no se aplique ningún límite.
  - Solicitar el registro: email sin cuenta, email con cuenta.
  - Completar el registro: email con cuenta, email sin registro en curso, email con registro en curso y código erróneo.
  - Iniciar sesión: email sin cuenta, email con cuenta y contraseña errónea.
  - El umbral se cumple también cuando se aplica un límite o un bloqueo (RF-12, RF-15, RF-42): que se envíe o no un email no puede alterar el tiempo de respuesta.
  - El autor asume que un atacante con muchas más muestras podría detectar diferencias menores («en la práctica», principio de no enumeración).
- **RNF-3.** Los límites de RF-10, RF-12, RF-15 y RF-22 se cumplen con exactitud aunque lleguen peticiones simultáneas: en ningún caso se aceptan más intentos ni se envían más emails de los indicados.
- **RNF-4.** Una sesión finalizada (RF-18 a RF-21 y RF-36) deja de permitir cualquier operación en un plazo máximo de 5 minutos.
- **RNF-5.** EL SISTEMA comprueba si una contraseña es una contraseña filtrada sin depender de servicios externos, de modo que la comprobación siempre está disponible.

## Casos límite

- Pre-registro malicioso con el email de otra persona: imposible, porque la cuenta solo se crea con el código enviado a ese email (D11; RF-1, RF-4).
- Solicitud de registro con un email que ya tiene cuenta: RF-6, RF-7.
- Email mal formado o demasiado largo: RF-35.
- Solicitudes de registro repetidas para saltarse el límite de envíos o para llenar de avisos un buzón ajeno: RF-12, RF-32.
- Un tercero que retrasa el registro de otra persona (bloqueo de 24 h o invalidación de su código): riesgo aceptado (D16); limitado por RF-12.
- Código caducado, agotado por intentos fallidos, sustituido por uno nuevo o ya usado: RF-9, RF-10, RF-11, RF-29.
- Fuerza bruta acumulada pidiendo códigos nuevos una y otra vez: RF-15, RF-16.
- Código correcto con una contraseña o un nombre no válidos: RF-28.
- Dos peticiones simultáneas para completar el mismo registro: RF-30.
- Una nueva solicitud de registro que se cruza con la finalización del registro: RF-29, RF-40, RF-41.
- Solicitudes de registro durante el bloqueo de RF-15: RF-42.
- Fuerza bruta en el inicio de sesión: RF-22, RF-31.
- Bloqueo malicioso encadenado del inicio de sesión de otra persona: riesgo aceptado (D15); no afecta a sus sesiones abiertas.
- Peticiones simultáneas para superar cualquier límite: RNF-3.
- El mismo email escrito con distintas mayúsculas o con espacios: RF-26.
- Dispositivo perdido o robado: RF-19, con un margen máximo de 5 minutos (RNF-4).
- Inicio de sesión simultáneo a «cerrar sesión en todos los dispositivos»: RF-19.
- Sesión robada y usada desde otro sitio: RF-36.
- Fallo del servicio de correo: RF-38.
- Fallo del sistema a mitad de un envío, o envío de resultado incierto: cuenta para RF-12 (D19).
- La misma contraseña escrita en dispositivos que codifican el texto de forma distinta: RF-39.

## Fuera de alcance

- Pertenencia a hogares, membresías y roles: spec 002.
- Invitaciones a hogares: spec 003.
- Recuperación y cambio de contraseña, edición del nombre visible, cambio de email y borrado de cuenta: spec 004 (gestión de cuenta), antes de desplegar.
- Rol de plataforma o superadministrador (D12).
- Máximo de sesiones simultáneas por usuario: no lo hay.
- Límite de peticiones por IP o global, y envío masivo de códigos a muchas direcciones distintas (cada una dentro de su límite de RF-12): fase 6.
- Interfaz de usuario (pantallas, navegación, redirecciones): la decide cada cliente; esta spec define el comportamiento de la API.
- Operaciones de infraestructura que no actúan sobre datos de usuarios, como comprobar el estado del servicio (D21).

## Criterios de finalización

- Todos los RF y RNF tienen al menos un test que los referencia por su id (`RF-n`) y está en verde.
- `pnpm check` y `pnpm test:e2e` en verde.
- El reviewer da `VEREDICTO: APROBADO` en `/sdd-validate`.

## Notas para el plan

Decisiones de *cómo* que salieron en la revisión y no pertenecen a la spec:

- Qué lista de contraseñas filtradas se usa (RF-24, RNF-5) y cómo se mantiene actualizada.
- Contenido del aviso de intento de registro (RF-7).
- Entorno y método de medición de RNF-2, incluidos los casos en que RF-12 impide el envío.
- Cómo se garantizan los límites bajo concurrencia (RNF-3) y la creación única de RF-30.
- Cómo se consigue el margen de RNF-4 con el diseño de ADR-0005 (vida de los accesos y bloqueo inmediato de su renovación).
- El ADR de diseño de la autenticación que anuncia ADR-0005.
- Cómo se detecta una sesión copiada (RF-36).
- Si se reintenta un envío fallido y cuántas veces (RF-38).
- Cómo se mide el último uso de una sesión con el diseño de ADR-0005 (RF-20).
- Comparación sin distinguir mayúsculas en emails con caracteres no ASCII (RF-26): reglas estándar de Unicode.
- Qué validación de formato de email se usa (RF-35) y cómo trata los casos frontera (direcciones sin punto en el dominio, comillas, dominios internacionalizados).
- Cómo se cumple RNF-2 en los estados de límite o bloqueo: el tiempo de respuesta no puede depender de si se envía un email (p. ej., envío asíncrono).

Observaciones de la revisión 4 que se resuelven al planificar (regla 8):

- Qué ocurre al completar el registro de un email bloqueado por RF-22 (¿se crea la cuenta y la sesión?), dado que RF-22 habla de inicios de sesión.
- Definir «emitir» un código (¿desde que se genera o desde que se acepta su envío?, relevante para los 15 minutos de RF-9 y para el envío de resultado incierto) y unificar «vigente» y «válido».
- Si el tabulador al principio o al final del nombre visible se elimina como espacio en blanco o se rechaza como carácter de control (RF-26, RF-27, RF-35 y D13 usan «espacios» de forma distinta).
- D14: si el plan sale con más de 10 tareas, decidir cómo dividir el trabajo.

## Dudas abiertas

Ninguna.

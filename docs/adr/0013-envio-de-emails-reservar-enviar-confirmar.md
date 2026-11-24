# ADR-0013: Envío de emails de autenticación: reservar, enviar y confirmar

- **Estado:** Aceptado
- **Fecha:** 2026-11-24
- **Sustituye en parte a:** [ADR-0009](0009-envio-de-emails-de-autenticacion.md) (cómo se ejecuta el trabajo de envío y qué pasa si falla el commit) y [ADR-0010](0010-limites-y-concurrencia-por-clave.md) (el bloqueo ya no cubre el envío SMTP).

## Contexto

Con ADR-0009 y ADR-0010, el trabajo de envío mantenía abiertos durante todo el envío SMTP (hasta 15 s) tres cosas: una transacción, una conexión de la base de datos y el bloqueo consultivo del email. La revisión del plan 001 (`/sdd-clarify`) encontró dos problemas:

1. **Agotamiento de conexiones.** La solicitud de registro es pública y responde sin tocar la base de datos. Una ráfaga con emails distintos llenaba el pool de conexiones, y entonces fallaban el inicio de sesión, completar el registro y `/health`. Además, la cola en memoria no tenía límite.
2. **Límite superado.** Si el correo aceptaba el envío pero fallaba el commit, o el SMTP agotaba su tiempo de espera sin saber el resultado, ese envío no contaba para RF-12. Así cabían dos emails en un minuto, y RNF-3 dice «en ningún caso».

## Opciones consideradas

1. **Mantener el bloqueo durante el SMTP**, limitando cuántos trabajos se ejecutan a la vez y acotando la cola. Cumple RF-12 al pie de la letra mientras no haya fallos de commit, pero deja abierto el hueco del commit fallido, y un SMTP lento frena todos los envíos.
2. **Reservar, enviar y confirmar.** El envío se reserva en una transacción corta, se envía sin conexión abierta y se confirma en otra transacción corta. Los envíos en curso cuentan para el límite.

## Decisión

Opción 2. El trabajo de cada solicitud tiene tres pasos:

1. **Reservar.** Transacción corta con el bloqueo del email (ADR-0010):
   - comprueba RF-15/RF-42 y si el email tiene cuenta;
   - comprueba el límite de RF-12, contando los envíos `PENDING` y `SENT`;
   - si procede, guarda el envío como `PENDING` y, si es un código, guarda el código como `PENDING` (todavía no vigente).
   - Commit.
2. **Enviar**, sin transacción y sin conexión de la base de datos.
3. **Confirmar.** Transacción corta con el bloqueo del email:
   - **Si el correo aceptó el envío:** el envío pasa a `SENT`. El código, si sigue procediendo (sin cuenta y sin bloqueo de RF-15), pasa a `ACTIVE`: se considera emitido en ese momento (`issuedAt`), lo que invalida el anterior (RF-11).
   - **Si el envío falló:** se borran la reserva y el código pendiente. No cuenta para RF-12, y el código anterior sigue vigente (RF-38).

Además:
- **Resultado incierto** (commit de confirmación fallido, tiempo de espera agotado o caída a mitad): la reserva queda `PENDING` y cuenta para RF-12, y el código no se emite. El límite nunca se supera (D19 de la spec 001).
- **Cola en memoria acotada:**
  - unos 4 envíos a la vez y unos 1.000 en espera;
  - si la cola está llena, el trabajo se descarta como si el envío hubiera fallado, y la respuesta ya había sido idéntica (RNF-2).
- Lo demás de ADR-0009 sigue igual: el trabajo se hace en segundo plano después de responder, va detrás de una interfaz, se usan `MailSender` y `nodemailer`, y no hay reintentos.

## Consecuencias

**Positivas**
- Ningún envío ocupa una conexión ni una transacción mientras habla con el servidor de correo: una ráfaga no deja sin servicio al resto de la API.
- RNF-3 se cumple también ante fallos parciales y resultados inciertos.

**Negativas**
- Mientras dura un envío que acaba fallando (unos segundos), una nueva solicitud para el mismo email lo cuenta y se queda sin envío. Es una desviación mínima de RF-12, recogida en la spec como D19.
- Si la confirmación falla después de que el correo aceptara el envío, la persona recibe un código que no funciona. Tiene que volver a solicitarlo cuando lo permita el límite.
- Se añaden estados (`PENDING`, `SENT`, `ACTIVE`, `INVALIDATED`) y un paso más en el flujo.
- Las reservas que se quedan en `PENDING` hay que limpiarlas junto con el resto de datos caducados (fase 2).

**Cuándo revisar**
- En la fase 5, al pasar a outbox o colas. La reserva se parece a un mensaje de outbox, y conviene unificarlos.

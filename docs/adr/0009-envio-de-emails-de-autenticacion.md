# ADR-0009: Envío de emails de autenticación: en segundo plano y detrás de una interfaz

- **Estado:** Aceptado; sustituido en parte por [ADR-0013](0013-envio-de-emails-reservar-enviar-confirmar.md) (cómo se ejecuta el trabajo de envío, la cola acotada y qué pasa si falla el commit)
- **Fecha:** 2026-11-24

## Contexto

La spec 001 envía dos tipos de email de autenticación: el código de verificación y el aviso de intento de registro. Varios requisitos condicionan cómo:

- **RNF-2:** el tiempo de respuesta no puede delatar si un email tiene cuenta, ni si se ha enviado un email por un límite o un bloqueo (RF-12, RF-15, RF-42). Un envío síncrono tarda cientos de milisegundos, y eso se notaría.
- **RF-38:** si el envío falla, la respuesta es la misma, el código nuevo no se emite (el anterior sigue siendo válido) y el envío no cuenta para RF-12.
- **RF-12:** solo cuentan los envíos realizados, es decir, los aceptados por el servicio de correo.

La fase 5 de la hoja de ruta introducirá eventos de dominio, outbox y colas (BullMQ). Hoy no hay ninguna pieza para trabajo en segundo plano, ni para enviar correo.

## Opciones consideradas

**Dónde vive el trabajo pendiente**
1. **En memoria, en el mismo proceso**, después de responder y detrás de una interfaz. No necesita infraestructura. Si el proceso se cae entre la respuesta y el envío, el email se pierde.
2. **Tabla de trabajos en Postgres**, procesada con `FOR UPDATE SKIP LOCKED`. Sobrevive a reinicios, pero hay que programar el sondeo, las concesiones (leases) y la limpieza, y adelanta lo que la fase 5 quiere aprender.
3. **`@nestjs/outbox` 0.1.4**: outbox duradero ya hecho. Está en 0.x y resuelve ahora lo que la fase 5 quiere construir.

**Cómo se envía el correo**
1. **`nodemailer` por SMTP, con Mailpit en local**: librería estable y sin dependencias propias. Mailpit captura los correos y los muestra en una web.
2. **Solo log en local y proveedor en la fase 6**: sin dependencias, pero no se prueba un envío real hasta desplegar.
3. **`@nestjs/mail` 0.0.2**: versión muy temprana, con reintentos propios que habría que ajustar a RF-38.

## Decisión

- **Trabajo en segundo plano:**
  - Las peticiones públicas que pueden enviar un email responden siempre igual, y el trabajo se hace después, en el mismo proceso.
  - Ese trabajo consiste en decidir si hay cuenta, aplicar los bloqueos y límites, generar el código y enviarlo.
  - Va detrás de una interfaz propia, que la fase 5 sustituirá por outbox o colas sin tocar el dominio.
- **«Emitir» un código** significa que el servicio de correo ha aceptado su envío:
  - los 15 minutos de RF-9 cuentan desde ese momento;
  - hasta entonces, el código anterior sigue vigente (RF-11, RF-32, RF-38).
- **Envío del correo:**
  - Interfaz propia `MailSender`.
  - Implementación real con `nodemailer` 10.x por SMTP.
  - Mailpit en `docker-compose.yml` para el desarrollo local.
  - Implementación en memoria para los tests. Se puede consultar (p. ej. para leer el código enviado) y simular fallos.
- **Sin reintentos:** un fallo es un envío no realizado (RF-38). La persona puede volver a solicitarlo.
- El proveedor de correo de producción se elige en la fase 6.

## Consecuencias

**Positivas**
- RNF-2 se cumple por construcción en las solicitudes de registro: la respuesta no depende de ningún envío ni de ninguna consulta que dependa de la cuenta.
- No hay infraestructura nueva salvo Mailpit en local. CI no lo necesita, porque los tests usan la implementación en memoria.
- La interfaz deja la fase 5 lista para cambiar la implementación.

**Negativas**
- Si el proceso se cae entre la respuesta y el envío, el email se pierde. Para la persona equivale a un fallo de correo, y puede pedirlo de nuevo.
- Si el correo acepta el envío pero falla el commit en la base de datos, la persona recibe un código que no funciona, y ese envío no cuenta para RF-12.
- Los tests e2e tienen que esperar a que termine el trabajo en segundo plano.
- Una dependencia nueva: `nodemailer`.

**Cuándo revisar**
- En la fase 5: sustituir la implementación en memoria por outbox o colas.
- En la fase 6: al elegir proveedor de producción, valorar su API HTTP frente a SMTP.

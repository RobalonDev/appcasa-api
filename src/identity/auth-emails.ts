import type { MailMessage } from '../mail/mail-sender.js';

/*
 * Authentication emails (plan 001, «Seguridad y autorización»). Spanish only for now;
 * translations come later. Never log these messages: they may carry a code.
 */

export function verificationCodeEmail(to: string, code: string): MailMessage {
  return {
    to,
    subject: 'Tu código de verificación de AppCasa',
    text: [
      `Tu código de verificación es ${code}.`,
      '',
      'Introdúcelo en AppCasa para terminar de crear tu cuenta. Caduca en 15 minutos.',
      '',
      'Si no has pedido este código, ignora este mensaje: no se creará ninguna cuenta.',
    ].join('\n'),
  };
}

/** RF-7: sent instead of a code when the email already has an account. */
export function registrationAttemptEmail(to: string): MailMessage {
  return {
    to,
    subject: 'Intento de registro en AppCasa con tu email',
    text: [
      'Alguien ha intentado crear una cuenta de AppCasa con esta dirección de email.',
      '',
      'Ya tienes una cuenta: si has sido tú, inicia sesión con tu contraseña.',
      '',
      'Si no has sido tú, puedes ignorar este mensaje. Tu cuenta no ha cambiado.',
    ].join('\n'),
  };
}

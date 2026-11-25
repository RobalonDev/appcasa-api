import { classifySmtpError } from './smtp-mail-sender.js';

/** Shape of the errors nodemailer rejects with. */
function smtpError(fields: {
  code?: string;
  responseCode?: number;
  syscall?: string;
  command?: string;
}) {
  return Object.assign(new Error('smtp error'), fields);
}

describe('classifySmtpError (ADR-0013)', () => {
  it('a server reply rejecting the message is a definite failure', () => {
    expect(classifySmtpError(smtpError({ responseCode: 550 }))).toBe('failed');
    expect(classifySmtpError(smtpError({ responseCode: 421 }))).toBe('failed');
  });

  it('errors before any message data is sent are definite failures', () => {
    for (const code of ['ECONNECTION', 'EDNS', 'EAUTH', 'ETLS', 'EENVELOPE']) {
      expect(classifySmtpError(smtpError({ code }))).toBe('failed');
    }
  });

  it('a connection that never opened is a definite failure (e.g. ECONNREFUSED)', () => {
    // What nodemailer reports when nothing listens on the SMTP port.
    expect(
      classifySmtpError(
        smtpError({ code: 'ESOCKET', syscall: 'connect', command: 'CONN' }),
      ),
    ).toBe('failed');
  });

  it('a timeout or a broken socket is uncertain: the server may have accepted it', () => {
    // nodemailer tags socket errors and idle timeouts with command "CONN" in any
    // phase, even after DATA, so the command alone cannot tell them apart.
    expect(
      classifySmtpError(smtpError({ code: 'ETIMEDOUT', command: 'CONN' })),
    ).toBe('uncertain');
    expect(
      classifySmtpError(smtpError({ code: 'ESOCKET', command: 'CONN' })),
    ).toBe('uncertain');
  });

  it('anything unknown is uncertain, so it still counts for the limit (spec D19)', () => {
    expect(classifySmtpError(new Error('boom'))).toBe('uncertain');
    expect(classifySmtpError('not even an error')).toBe('uncertain');
  });
});

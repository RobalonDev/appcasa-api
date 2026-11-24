import { InMemoryMailSender } from './in-memory-mail-sender.js';
import type { MailMessage } from './mail-sender.js';

const message = (to: string): MailMessage => ({
  to,
  subject: 'Tu código de AppCasa',
  text: 'Tu código es 012345',
});

describe('InMemoryMailSender (ADR-0009, ADR-0013)', () => {
  it('accepts by default and records what it sent', async () => {
    const mail = new InMemoryMailSender();

    await expect(mail.send(message('ana@example.test'))).resolves.toBe(
      'accepted',
    );
    expect(mail.sent).toEqual([message('ana@example.test')]);
    expect(mail.sentTo('ana@example.test')).toHaveLength(1);
    expect(mail.sentTo('other@example.test')).toHaveLength(0);
  });

  it('simulates a failure on the next send only, recording nothing', async () => {
    const mail = new InMemoryMailSender();
    mail.failNext();

    await expect(mail.send(message('a@example.test'))).resolves.toBe('failed');
    await expect(mail.send(message('a@example.test'))).resolves.toBe(
      'accepted',
    );
    expect(mail.sent).toHaveLength(1);
  });

  it('simulates an uncertain result: the mail may or may not have left', async () => {
    const mail = new InMemoryMailSender();
    mail.uncertainNext();

    await expect(mail.send(message('a@example.test'))).resolves.toBe(
      'uncertain',
    );
    expect(mail.sent).toHaveLength(0);
  });

  it('queues simulated outcomes in order', async () => {
    const mail = new InMemoryMailSender();
    mail.failNext();
    mail.uncertainNext();

    await expect(mail.send(message('a@example.test'))).resolves.toBe('failed');
    await expect(mail.send(message('a@example.test'))).resolves.toBe(
      'uncertain',
    );
    await expect(mail.send(message('a@example.test'))).resolves.toBe(
      'accepted',
    );
  });

  it('can take a fixed time per send, like a real mail server', async () => {
    const mail = new InMemoryMailSender({ delayMs: 50 });
    const start = performance.now();

    await mail.send(message('a@example.test'));
    expect(performance.now() - start).toBeGreaterThanOrEqual(45);
  });

  it('can be cleared between tests', async () => {
    const mail = new InMemoryMailSender();
    await mail.send(message('a@example.test'));
    mail.failNext();
    mail.clear();

    expect(mail.sent).toHaveLength(0);
    await expect(mail.send(message('a@example.test'))).resolves.toBe(
      'accepted',
    );
  });
});

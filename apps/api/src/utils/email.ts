import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

export function publicOrigin() {
  const value = process.env.PUBLIC_BASE_URL;
  if (!value) return undefined;

  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('PUBLIC_BASE_URL must be an HTTP or HTTPS URL');
  }
  return url.origin;
}

export function emailConfigured() {
  return Boolean(process.env.SMTP_URL && process.env.SMTP_FROM);
}

export async function sendEmail(to: string, subject: string, text: string) {
  const { SMTP_URL, SMTP_FROM } = process.env;
  if (!SMTP_URL || !SMTP_FROM) throw new Error('Email delivery is not configured');

  const url = new URL(SMTP_URL);
  if (url.protocol !== 'smtp:' && url.protocol !== 'smtps:') {
    throw new Error('SMTP_URL must use smtp or smtps');
  }

  transporter ??= nodemailer.createTransport({
    host: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'smtps:' ? 465 : 587,
    secure: url.protocol === 'smtps:',
    requireTLS: url.protocol === 'smtp:' && Boolean(url.username),
    auth: url.username ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) } : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true
  });

  await transporter.sendMail({ from: SMTP_FROM, to, subject, text });
}

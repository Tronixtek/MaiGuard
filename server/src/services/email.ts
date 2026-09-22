import nodemailer, { type Transporter } from "nodemailer";

/**
 * Real email delivery over SMTP (any provider: Gmail, Brevo, Mailgun, Zoho…).
 * Off unless SMTP_HOST is set; until then email alerts are only recorded in
 * the delivery log.
 *
 * Env: SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true for port 465),
 * SMTP_USER, SMTP_PASS, SMTP_FROM (e.g. "MaiGuard <alerts@example.com>"),
 * PUBLIC_APP_URL (for the "manage your roads" link).
 */
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return (transporter = null);
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export const emailEnabled = () => Boolean(process.env.SMTP_HOST);

function footer(): string {
  const app = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  return [
    "",
    "--",
    "You get these alerts because you signed up to MaiGuard for this road.",
    app ? `Change your roads or stop alerts: ${app}/account` : "Reply STOP to stop these alerts.",
  ].join("\n");
}

/** Send a plain-text email. Never throws: a failed email must not block other channels. */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: `${body}\n${footer()}`,
    });
    return true;
  } catch (err) {
    console.warn(`[email] send to ${to.replace(/(.).*@/, "$1•••@")} failed: ${(err as Error).message}`);
    return false;
  }
}

/** Check the SMTP settings at startup so a typo shows up in the logs straight away. */
export async function verifyEmail(): Promise<void> {
  const t = getTransporter();
  if (!t) return;
  try {
    await t.verify();
    console.log(`[email] SMTP ready (${process.env.SMTP_HOST})`);
  } catch (err) {
    console.warn(`[email] SMTP check failed: ${(err as Error).message}`);
  }
}

/** Test hook: forget the cached transporter after changing SMTP env vars. */
export function resetEmailTransport() {
  transporter = undefined;
}

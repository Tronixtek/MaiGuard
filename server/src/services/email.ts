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

const appUrl = () => process.env.PUBLIC_APP_URL?.replace(/\/$/, "");

function footer(): string {
  const app = appUrl();
  return [
    "",
    "--",
    "You get this because you signed up to MaiGuard for this road.",
    app ? `Change your roads or stop alerts: ${app}/account` : "Reply STOP to stop these alerts.",
  ].join("\n");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A plain, well-formed HTML version of the same message; mail filters distrust text-only bulk mail. */
function html(subject: string, body: string): string {
  const app = appUrl();
  const paragraphs = body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
    <p style="margin:0 0 16px;font-weight:600;color:#2563eb">MaiGuard</p>
    <h1 style="margin:0 0 16px;font-size:18px;line-height:1.3">${escapeHtml(subject)}</h1>
    ${paragraphs}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="margin:0;font-size:12px;color:#64748b">You get this because you signed up to MaiGuard for this road.${
      app ? ` <a href="${app}/account" style="color:#2563eb">Change your roads or stop alerts</a>.` : ""
    }</p>
  </div></body></html>`;
}

/** Subjects in capitals ("ALERT") read as shouting to spam filters. */
const tidySubject = (subject: string) =>
  subject.replace(/\b(ALERT|NOTICE|ALL CLEAR|UPDATE)\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase());

/** Send one message as text and HTML. Never throws: a failed email must not block other channels. */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const address = from.match(/<(.+)>/)?.[1] ?? from;
  const clean = tidySubject(subject);
  try {
    await t.sendMail({
      from,
      to,
      replyTo: address,
      subject: clean,
      text: `${body}\n${footer()}`,
      html: html(clean, body),
      headers: {
        // Standard one-click unsubscribe: filters treat mail without it as bulk.
        "List-Unsubscribe": [appUrl() ? `<${appUrl()}/account>` : "", `<mailto:${address}?subject=unsubscribe>`].filter(Boolean).join(", "),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "Auto-Submitted": "auto-generated",
      },
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

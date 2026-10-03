import { normalizePhone } from "../lib/text.js";

/**
 * Real SMS through one of the usual providers. Off unless SMS_PROVIDER and
 * SMS_API_KEY are set; until then text messages are only recorded in the
 * delivery log.
 *
 * Env:
 *   SMS_PROVIDER     bulksmslive | africastalking | termii | twilio
 *   SMS_API_KEY      the provider's API key (Twilio: the auth token)
 *   SMS_SENDER       sender id or from-number, as registered with the provider
 *   SMS_USERNAME     Africa's Talking username (use "sandbox" for testing)
 *   SMS_ACCOUNT_SID  Twilio account SID
 */
export type SmsProvider = "bulksmslive" | "africastalking" | "termii" | "twilio";

const config = () => ({
  provider: process.env.SMS_PROVIDER?.toLowerCase() as SmsProvider | undefined,
  apiKey: process.env.SMS_API_KEY,
  sender: process.env.SMS_SENDER,
  username: process.env.SMS_USERNAME,
  accountSid: process.env.SMS_ACCOUNT_SID,
});

export const smsEnabled = () => {
  const { provider, apiKey } = config();
  return Boolean(provider && apiKey);
};

/** Providers expect international format. */
const toE164 = (phone: string) => `+${normalizePhone(phone)}`;

type Request = { url: string; init: RequestInit };

function buildRequest(to: string, body: string): Request | undefined {
  const { provider, apiKey, sender, username, accountSid } = config();
  const number = toE164(to);

  if (provider === "bulksmslive") {
    // https://api.bulksmslive.com/v2/app/sendsms — key in the header, form fields in the body.
    const form = new URLSearchParams({ message: body, sender_name: sender || "MaiGuard", recipients: number, force_dnd: "1" });
    return {
      url: "https://api.bulksmslive.com/v2/app/sendsms",
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      },
    };
  }

  if (provider === "africastalking") {
    const form = new URLSearchParams({ username: username || "sandbox", to: number, message: body });
    if (sender) form.set("from", sender);
    const host = username && username !== "sandbox" ? "https://api.africastalking.com" : "https://api.sandbox.africastalking.com";
    return {
      url: `${host}/version1/messaging`,
      init: { method: "POST", headers: { apiKey: apiKey!, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: form },
    };
  }

  if (provider === "termii") {
    return {
      url: "https://api.ng.termii.com/api/sms/send",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: number, from: sender || "MaiGuard", sms: body, type: "plain", channel: "generic", api_key: apiKey }),
      },
    };
  }

  if (provider === "twilio") {
    const form = new URLSearchParams({ To: number, From: sender ?? "", Body: body });
    return {
      url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      init: {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    };
  }

  return undefined;
}

/** Some providers answer 200 with a failure in the body. */
function isRejected(body: string): boolean {
  try {
    const data = JSON.parse(body) as { status?: number | string; error?: unknown };
    return data.status !== undefined ? Number(data.status) !== 1 && String(data.status).toLowerCase() !== "success" : Boolean(data.error);
  } catch {
    return false;
  }
}

/** Send one text message. Never throws: a failed SMS must not block other channels. */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsEnabled()) return false;
  const request = buildRequest(to, body);
  if (!request) {
    console.warn(`[sms] unknown SMS_PROVIDER "${process.env.SMS_PROVIDER}"`);
    return false;
  }
  try {
    const res = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(15_000) });
    const text = await res.text();
    if (!res.ok || isRejected(text)) {
      console.warn(`[sms] send failed ${res.status}: ${text.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[sms] send failed: ${(err as Error).message}`);
    return false;
  }
}

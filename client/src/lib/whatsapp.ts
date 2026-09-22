/** MaiGuard's WhatsApp number, set at build time (VITE_WHATSAPP_NUMBER). */
export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) || undefined;

/** Opens WhatsApp (app or web) in a chat with MaiGuard, with "Hi" ready to send. */
export const whatsappLink = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent("Hi")}`
  : undefined;

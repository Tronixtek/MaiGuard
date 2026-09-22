import { MessageCircle, Phone } from "lucide-react";
import { useLocation } from "react-router";
import { whatsappLink } from "../lib/whatsapp";

/** Floating "chat with MaiGuard AI" button, bottom-right on the public pages. */
export function FloatingWhatsApp() {
  const { pathname } = useLocation();
  // Not on the trusted-voice console, where it would cover the publish controls.
  if (!whatsappLink || pathname.startsWith("/voice")) return null;

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with MaiGuard AI on WhatsApp"
      className="group fixed right-5 z-40 flex items-center gap-3 bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <span className="pointer-events-none hidden translate-x-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-ink opacity-0 shadow-lg ring-1 ring-line transition group-hover:translate-x-0 group-hover:opacity-100 md:block">
        Chat with MaiGuard AI
      </span>
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-white transition group-hover:scale-105 group-active:scale-95">
        <MessageCircle className="relative h-7 w-7" strokeWidth={2} />
        <Phone className="absolute h-3 w-3 fill-current" strokeWidth={0} />
      </span>
    </a>
  );
}

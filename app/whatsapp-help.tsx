import { getHelpWhatsAppHref } from "./course-data";

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 flex-none"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M20.5 3.5A11 11 0 0 0 2.1 16.7L1 22.3l5.7-1.1A11 11 0 0 0 20.5 3.5Zm-8.5 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-3.4.7.7-3.3-.2-.3A9.1 9.1 0 1 1 12 20.5Zm5-6.8c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5c0-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 12 12 0 0 0 4.5 4 15 15 0 0 0 1.5.5 3.6 3.6 0 0 0 1.7.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3Z" />
    </svg>
  );
}

export default function WhatsAppHelp() {
  return (
    <a
      className="fixed bottom-5 right-5 z-[60] inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-medium !text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-colors hover:bg-[#1ebe5d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cda45c]"
      href={getHelpWhatsAppHref()}
      rel="noopener noreferrer"
      target="_blank"
    >
      <WhatsAppIcon />
      Precisa de ajuda?
    </a>
  );
}

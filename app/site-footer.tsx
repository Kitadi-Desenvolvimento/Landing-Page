const socialLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/kitadifinancas/",
    icon: (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <rect
          height="17"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.7"
          width="17"
          x="3.5"
          y="3.5"
        />
        <circle
          cx="12"
          cy="12"
          r="4"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="17.5" cy="6.8" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/kitadi-finan%C3%A7as-neg%C3%B3cios/posts/?feedView=all",
    icon: (
      <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5.2 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM3.7 8.5h3v11.8h-3V8.5Zm5 0h2.9v1.6h.1c.4-.8 1.5-2 3.5-2 3.7 0 4.4 2.4 4.4 5.5v6.7h-3v-6c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1v6.1h-3V8.5Z" />
      </svg>
    ),
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#26070c] px-6 py-8 text-white">
      <div className="mx-auto flex w-full max-w-[1058px] flex-col items-center justify-between gap-5 sm:flex-row">
        <p className="text-sm text-white/70">
          © Kitadi — Escola de Finanças &amp; Negócios
        </p>

        <nav aria-label="Redes sociais" className="flex items-center gap-3">
          {socialLinks.map((link) => (
            <a
              aria-label={`Kitadi no ${link.label}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-sm text-white/85 transition-colors hover:border-[#cda45c] hover:text-[#cda45c]"
              href={link.href}
              key={link.label}
              rel="noopener noreferrer"
              target="_blank"
            >
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

import { Moon } from "lucide-react";

const NAV_LINKS = [
  { label: "Why Stellar Ramp?", href: "#features" },
  { label: "Process", href: "#process" },
  { label: "Live Rates", href: "#rates" },
  { label: "FAQ", href: "#faq" },
];

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

export const SiteHeader = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            Stellar<span className="text-blue-600">Ramp</span>
          </span>
          <span className="hidden items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 md:inline-flex">
            XLM & USDC / VND
          </span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <a
            href="#contact"
            className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 sm:block"
          >
            Contact Support
          </a>
          <button
            type="button"
            className="text-slate-500 transition-colors hover:text-blue-600"
            aria-label="Toggle Dark Mode"
          >
            <Moon className="h-5 w-5" />
          </button>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-transparent bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Buy/Sell
          </a>
        </div>
      </div>
    </header>
  );
};

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Why Stellar Ramp?', href: '#features' },
  { label: 'How It Works', href: '#workflow' },
  { label: 'Rates', href: '#rates' },
  { label: 'FAQ', href: '#faq' },
];

const BOT_URL = 'https://t.me/stellarrampbot';
const SUPPORT_URL = 'https://t.me/stellarampsupport';

export const SiteHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="inline-flex items-center gap-3 text-lg font-semibold text-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm">SR</div>
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Stellar<span className="text-blue-600">Ramp</span>
            </span>
            <span className="text-xs text-slate-500">XLM · USDC · VND</span>
          </div>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative transition-colors hover:text-blue-600"
            >
              <span className="absolute -bottom-2 left-0 h-0.5 w-full origin-left scale-x-0 rounded-full bg-blue-600 transition-transform duration-300 group-hover:scale-x-100" />
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
          >
            Support
          </a>
          <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
            🚀 Start Trading
          </a>
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((p) => !p)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
          aria-label="Toggle navigation"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="flex flex-col gap-2 px-4 py-4 text-sm font-medium text-slate-500">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-xl px-3 py-2 transition-colors hover:bg-slate-100 hover:text-blue-600"
              >
                {link.label}
              </a>
            ))}
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl px-3 py-2 transition-colors hover:bg-slate-100"
            >
              Support
            </a>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMenuOpen(false)}
              className="btn-primary mt-2 justify-center"
            >
              🚀 Start Trading
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

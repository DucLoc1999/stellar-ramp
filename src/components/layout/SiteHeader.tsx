import { Menu, X, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../LanguageSwitcher";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

export const SiteHeader = () => {
  const { t } = useTranslation();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const NAV_LINKS = [
    { label: t("nav.whyStellarRamp"), href: "#features" },
    { label: t("nav.process"), href: "#process" },
    { label: t("nav.liveRates"), href: "#rates" },
    { label: t("nav.faq"), href: "#faq" },
  ];

  const handleToggleMenu = () => setIsMenuOpen((open) => !open);
  const handleCloseMenu = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img
            src="/exchanges/stellarRamp.png"
            alt="StellarRamp"
            className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-600"
          />
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Stellar<span className="text-blue-600">Ramp</span>
          </span>
          <span className="hidden items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 md:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            USDC / VND
          </span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-blue-400"
            aria-label="Toggle Dark Mode"
          >
            {isDark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-transparent bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t("nav.buySell")}
          </a>
        </div>

        <button
          type="button"
          onClick={handleToggleMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
        >
          {isMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95 md:hidden">
          <nav className="flex flex-col gap-2 px-4 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={handleCloseMenu}
                className="rounded-xl px-3 py-2 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              >
                {link.label}
              </a>
            ))}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <LanguageSwitcher />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsDark((d) => !d);
                    handleCloseMenu();
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label={isDark ? t("nav.lightMode") : t("nav.darkMode")}
                >
                  {isDark ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>
                <a
                  href={BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleCloseMenu}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  {t("nav.buySell")}
                </a>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

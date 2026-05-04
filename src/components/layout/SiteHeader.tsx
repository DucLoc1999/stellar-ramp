import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../LanguageSwitcher";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

export const SiteHeader = () => {
  const { t } = useTranslation();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

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

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
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

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            className="text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            aria-label="Toggle Dark Mode"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
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
      </div>
    </header>
  );
};

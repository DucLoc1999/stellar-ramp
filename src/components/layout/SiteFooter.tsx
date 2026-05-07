import { useTranslation } from "react-i18next";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

export const SiteFooter = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pb-8 pt-16">
      <div className="mx-auto mb-12 flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-center md:items-start">
          <div className="mb-2 flex items-center gap-2">
            <img src="/exchanges/stellarRamp.png" alt="StellarRamp" className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-600" />
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Stellar<span className="text-blue-600">Ramp</span>
            </span>
          </div>
          <div className="flex gap-4">
            <a
              href="#"
              className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-blue-600"
            >
              {t("footer.termsOfService")}
            </a>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <a
              href="#"
              className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-blue-600"
            >
              {t("footer.privacyPolicy")}
            </a>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <a
              href="#"
              className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-blue-600"
            >
              {t("footer.apiPartners")}
            </a>
          </div>
        </div>
        <div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-6 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t("footer.joinCommunity")}
          </a>
        </div>
      </div>
      <div className="mx-auto border-t border-slate-200 dark:border-slate-700 px-4 pt-8 text-center sm:px-6 lg:px-8 max-w-7xl">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
};

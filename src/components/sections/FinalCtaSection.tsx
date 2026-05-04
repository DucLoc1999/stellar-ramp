import { useTranslation } from "react-i18next";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

export const FinalCtaSection = () => {
  const { t } = useTranslation();

  return (
    <section className="relative bg-white dark:bg-slate-900 py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-200 to-transparent" />
      <div className="section-container">
        <div
          id="contact"
          className="relative overflow-hidden rounded-3xl border border-slate-800 bg-linear-to-br from-slate-900 to-slate-950 p-10 text-center shadow-xl sm:p-16"
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvc3ZnPg==")`,
            }}
          />
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 to-indigo-500" />
          <div className="absolute -left-32 -top-10 h-48 w-48 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -right-28 bottom-0 h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative space-y-6">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
              {t("finalCta.title")}
            </h2>
            <p className="text-base text-slate-300 sm:text-lg max-w-2xl mx-auto">
              {t("finalCta.description")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg transition-transform hover:-translate-y-1"
              >
                <span className="mr-2 text-xl" aria-hidden="true">
                  ✈
                </span>
                {t("finalCta.openBot")}
              </a>
              <a
                href="#contact"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 hover:border-slate-500 rounded-xl transition-all"
              >
                {t("finalCta.contactSupport")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

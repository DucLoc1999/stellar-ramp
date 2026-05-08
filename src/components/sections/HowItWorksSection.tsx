import { useTranslation } from "react-i18next";
import { SectionHeading } from "./SectionHeading";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

export const HowItWorksSection = () => {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-slate-900 py-24 text-white">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvc3ZnPg==")`,
        }}
      />
      <div className="section-container relative z-10">
        <SectionHeading
          id="process"
          eyebrow={t("howItWorks.eyebrow")}
          title={t("howItWorks.title")}
          light
        />
        <div className="flex flex-col items-center justify-center gap-8 lg:gap-6 lg:flex-row lg:items-center">
          {/* Telegram Mockup 1 */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">{t("howItWorks.mockup.step1")}</p>
            <div className="relative z-10 w-full max-w-sm transform lg:-rotate-2 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-700 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                🤖
              </div>
              <div>
                <p className="text-sm font-bold text-white">{t("howItWorks.mockup.botName")}</p>
                <p className="text-xs text-blue-300">{t("howItWorks.mockup.botLabel")}</p>
              </div>
            </div>
            <div className="space-y-4 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-96 p-4">
              {/* User Msg */}
              <div className="flex justify-end">
                <div className="inline-block max-w-xs rounded-l-2xl rounded-tr-2xl bg-blue-600 px-4 py-2 text-sm text-white shadow-sm">
                  {t("howItWorks.mockup.start")}
                </div>
              </div>
              {/* Bot Msg */}
              <div className="flex justify-start">
                <div className="inline-block max-w-xs border border-slate-700 rounded-r-2xl rounded-tl-2xl bg-slate-800 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                  <span dangerouslySetInnerHTML={{ __html: t("howItWorks.mockup.welcome") }} />
                  <br />
                  <br />
                  {t("howItWorks.mockup.welcomeTagline")}
                  <br />
                  <br />
                  <span dangerouslySetInnerHTML={{ __html: t("howItWorks.mockup.liveRates") }} />
                  <br />
                  {t("howItWorks.mockup.liveRatesValue")}
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Arrow 1 (Desktop) */}
          <div className="hidden text-2xl text-blue-400 lg:block shrink-0">→</div>
          {/* Arrow 1 (Mobile) */}
          <div className="text-2xl text-blue-400 lg:hidden">↓</div>

          {/* Telegram Mockup 2 — KYC */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">{t("howItWorks.mockup.step2")}</p>
            <div className="relative z-10 w-full max-w-sm transform lg:rotate-1 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-700 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                🤖
              </div>
              <div>
                <p className="text-sm font-bold text-white">{t("howItWorks.mockup.botName")}</p>
                <p className="text-xs text-blue-300">{t("howItWorks.mockup.botLabel")}</p>
              </div>
            </div>
            <div className="flex flex-col justify-end space-y-3 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-96 p-4">
              {/* Bot KYC prompt */}
              <div className="flex justify-start">
                <div className="inline-block max-w-xs border border-slate-700 rounded-r-2xl rounded-tl-2xl bg-slate-800 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                  <span dangerouslySetInnerHTML={{ __html: t("howItWorks.mockup.kycTitle") }} />
                  <br />
                  <br />
                  {t("howItWorks.mockup.kycBody")}
                  <br />
                  <br />
                  {t("howItWorks.mockup.kycNeeds")}
                  <br />
                  • {t("howItWorks.mockup.kycItem1")}
                  <br />
                  • {t("howItWorks.mockup.kycItem2")}
                  <br />
                  • {t("howItWorks.mockup.kycItem3")}
                </div>
              </div>
              {/* KYC button */}
              <div className="flex flex-col gap-2 mt-2">
                <button className="w-full border border-blue-500 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500">
                  {t("howItWorks.mockup.kycButton")}
                </button>
                <div className="text-center text-xs text-slate-400">{t("howItWorks.mockup.kycSubtitle")}</div>
              </div>
            </div>
          </div>
          </div>

          {/* Arrow 2 (Desktop) */}
          <div className="hidden text-2xl text-blue-400 lg:block shrink-0">→</div>
          {/* Arrow 2 (Mobile) */}
          <div className="text-2xl text-blue-400 lg:hidden">↓</div>

          {/* Telegram Mockup 3 */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">{t("howItWorks.mockup.step3")}</p>
            <div className="relative z-10 w-full max-w-sm transform lg:rotate-2 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-700 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                🤖
              </div>
              <div>
                <p className="text-sm font-bold text-white">{t("howItWorks.mockup.botName")}</p>
                <p className="text-xs text-blue-300">{t("howItWorks.mockup.botLabel")}</p>
              </div>
            </div>
            <div className="flex flex-col justify-end space-y-4 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-96 p-4">
              {/* Bot Msg */}
              <div className="mb-2 flex justify-start">
                <div className="w-full border border-slate-700 rounded-r-2xl rounded-tl-2xl bg-slate-800 px-4 py-3 text-sm leading-relaxed text-white shadow-sm inline-block">
                  {t("howItWorks.mockup.menuPrompt")}
                </div>
              </div>
              {/* Inline Keyboard */}
              <div className="flex flex-col gap-2">
                <button className="w-full border border-slate-600 rounded-xl bg-slate-700 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-600">
                  {t("howItWorks.mockup.buyButton")}
                </button>
                <button className="w-full border border-slate-600 rounded-xl bg-slate-700 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-600">
                  {t("howItWorks.mockup.sellButton")}
                </button>
                <button className="flex w-full items-center justify-center gap-2 border border-slate-600 rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-600">
                  {t("howItWorks.mockup.bankButton")}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>

        <p className="relative z-20 mt-10 text-center text-xs text-slate-500">
          {t("howItWorks.illustrativeNote")}
        </p>

        <div className="relative z-20 mt-6 flex justify-center">
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-blue-500 bg-blue-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-500 hover:shadow-xl"
          >
            {t("howItWorks.cta")}
          </a>
        </div>
      </div>
    </section>
  );
};

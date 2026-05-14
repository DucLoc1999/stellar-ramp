import { useTranslation } from "react-i18next";
import { SectionHeading } from "./SectionHeading";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

const TelegramHeader = ({
  botName,
  botLabel,
}: {
  botName: string;
  botLabel: string;
}) => (
  <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-700 p-4">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2AABEE] text-white text-lg">
      ⬡
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-white truncate">{botName}</p>
      <p className="text-xs text-blue-300">{botLabel}</p>
    </div>
  </div>
);

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
        <div className="flex flex-col items-center justify-center gap-8 lg:gap-6 lg:flex-row lg:items-stretch">
          {/* Step 1 — Main Menu */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {t("howItWorks.mockup.step1")}
            </p>
            <div className="flex flex-1 items-center">
              <div className="relative z-10 w-full max-w-sm transform lg:-rotate-2 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
                <TelegramHeader
                  botName={t("howItWorks.mockup.botName")}
                  botLabel={t("howItWorks.mockup.botLabel")}
                />
                <div className="flex flex-col justify-end bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-144 p-4">
                  {/* User Msg */}
                  <div className="flex justify-end mb-3">
                    <div className="inline-block rounded-l-2xl rounded-tr-2xl bg-green-700 px-4 py-2 text-sm text-white shadow-sm">
                      {t("howItWorks.mockup.start")}
                    </div>
                  </div>
                  {/* Bot welcome */}
                  <div className="flex justify-start mb-3">
                    <div className="inline-block max-w-xs rounded-r-2xl rounded-tl-2xl bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: t("howItWorks.mockup.welcome"),
                        }}
                      />
                      <br />
                      <br />
                      {t("howItWorks.mockup.welcomeBody")}
                      <br />
                      <br />
                      {t("howItWorks.mockup.welcomeFeature1")}
                      <br />
                      {t("howItWorks.mockup.welcomeFeature2")}
                      <br />
                      {t("howItWorks.mockup.welcomeFeature3")}
                      <br />
                      <br />
                      {t("howItWorks.mockup.welcomeMenuPrompt")}
                    </div>
                  </div>
                  {/* Menu buttons grid */}
                  <div className="flex flex-col gap-1.5">
                    <button className="w-full rounded-lg bg-slate-700/80 px-3 py-2.5 text-center text-xs font-medium text-white">
                      {t("howItWorks.mockup.menuCheckRate")}
                    </button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.menuBuy")}
                      </button>
                      <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.menuSell")}
                      </button>
                      <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.menuKyc")}
                      </button>
                      <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.menuBank")}
                      </button>
                      <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.menuWallet")}
                      </button>
                      <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.menuAccount")}
                      </button>
                      <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.menuReferral")}
                      </button>
                      <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.menuSupport")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Arrow 1 */}
          <div className="hidden text-2xl text-blue-400 lg:flex lg:items-center shrink-0">
            →
          </div>
          <div className="text-2xl text-blue-400 lg:hidden">↓</div>

          {/* Step 2 — KYC */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {t("howItWorks.mockup.step2")}
            </p>
            <div className="flex flex-1 items-center">
              <div className="relative z-10 w-full max-w-sm transform lg:rotate-1 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
                <TelegramHeader
                  botName={t("howItWorks.mockup.botName")}
                  botLabel={t("howItWorks.mockup.botLabel")}
                />
                <div className="flex flex-col justify-end bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-144 p-4">
                  {/* Bot KYC message */}
                  <div className="flex justify-start mb-3">
                    <div className="inline-block max-w-xs rounded-r-2xl rounded-tl-2xl bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: t("howItWorks.mockup.kycTitle"),
                        }}
                      />
                      <br />
                      <br />
                      {t("howItWorks.mockup.kycBody")}
                      <br />
                      <br />
                      {t("howItWorks.mockup.kycBody2")}
                      <br />
                      <br />
                      <span
                        dangerouslySetInnerHTML={{
                          __html: t("howItWorks.mockup.kycNeeds"),
                        }}
                      />
                      <br />
                      <br />
                      {t("howItWorks.mockup.kycItem1")}
                      <br />
                      {t("howItWorks.mockup.kycItem2")}
                      <br />
                      <br />
                      {t("howItWorks.mockup.kycFooter")}
                    </div>
                  </div>
                  {/* KYC buttons */}
                  <div className="flex flex-col gap-1.5">
                    <button className="w-full rounded-lg bg-slate-700/80 px-4 py-3 text-center text-sm font-medium text-white">
                      {t("howItWorks.mockup.kycButton")}
                    </button>
                    <button className="w-full rounded-lg bg-slate-700/80 px-4 py-3 text-center text-sm font-medium text-white">
                      {t("howItWorks.mockup.kycBackButton")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Arrow 2 */}
          <div className="hidden text-2xl text-blue-400 lg:flex lg:items-center shrink-0">
            →
          </div>
          <div className="text-2xl text-blue-400 lg:hidden">↓</div>

          {/* Step 3 — Buy & Sell (two mockups) */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {t("howItWorks.mockup.step3")}
            </p>
            <div className="flex flex-1 items-center">
              <div className="flex flex-col gap-4">
                {/* Buy mockup */}
                <div className="relative z-10 w-full max-w-sm transform lg:rotate-2 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
                  <TelegramHeader
                    botName={t("howItWorks.mockup.botName")}
                    botLabel={t("howItWorks.mockup.botLabel")}
                  />
                  <div className="flex flex-col justify-end bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-72 p-4">
                    <div className="flex justify-start mb-3">
                      <div className="inline-block max-w-xs rounded-r-2xl rounded-tl-2xl bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm">
                        <span className="font-bold">
                          {t("howItWorks.mockup.buyTitle")}
                        </span>
                        <br />
                        <br />
                        {t("howItWorks.mockup.buyBody")}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                          {t("howItWorks.mockup.buyOption1")}
                        </button>
                        <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                          {t("howItWorks.mockup.buyOption2")}
                        </button>
                        <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                          {t("howItWorks.mockup.buyOption3")}
                        </button>
                        <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                          {t("howItWorks.mockup.buyCustom")}
                        </button>
                      </div>
                      <button className="w-full rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.backButton")}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Sell mockup */}
                <div className="relative z-10 w-full max-w-sm transform lg:-rotate-1 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
                  <TelegramHeader
                    botName={t("howItWorks.mockup.botName")}
                    botLabel={t("howItWorks.mockup.botLabel")}
                  />
                  <div className="flex flex-col justify-end bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-72 p-4">
                    <div className="flex justify-start mb-3">
                      <div className="inline-block max-w-xs rounded-r-2xl rounded-tl-2xl bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm">
                        <span className="font-bold">
                          {t("howItWorks.mockup.sellTitle")}
                        </span>
                        <br />
                        <br />
                        {t("howItWorks.mockup.sellBody")}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                          {t("howItWorks.mockup.sellOption1")}
                        </button>
                        <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                          {t("howItWorks.mockup.sellOption2")}
                        </button>
                        <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                          {t("howItWorks.mockup.sellOption3")}
                        </button>
                        <button className="rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                          {t("howItWorks.mockup.sellCustom")}
                        </button>
                      </div>
                      <button className="w-full rounded-lg bg-slate-700/80 px-3 py-2.5 text-xs font-medium text-white">
                        {t("howItWorks.mockup.backButton")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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

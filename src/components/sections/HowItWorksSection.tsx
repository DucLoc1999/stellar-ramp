import { ArrowRight } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

const STEPS = [
  {
    title: "📱 Open Telegram and find @StellarRampBot",
    description:
      '👉 Press "Start" to activate the bot and complete a quick KYC verification.',
  },
  {
    title: "💱 Choose Buy or Sell — confirm & receive",
    description:
      "Select XLM or USDC, enter the amount, confirm the rate, and funds settle in seconds.",
  },
];

export const HowItWorksSection = () => {
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
          eyebrow="HOW IT WORKS"
          title="From Crypto to VND in 2 Steps"
          light
        />
        <div className="flex flex-col items-center justify-center gap-12 relative lg:gap-24 lg:flex-row">
          {/* Arrow pointing between mockups (Desktop) */}
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-blue-500 lg:block">
            →
          </div>

          {/* Telegram Mockup 1 */}
          <div className="relative z-10 w-full max-w-sm transform lg:-rotate-2 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-700 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                🤖
              </div>
              <div>
                <p className="text-sm font-bold text-white">Stellar Ramp Bot</p>
                <p className="text-xs text-blue-300">bot</p>
              </div>
            </div>
            <div className="space-y-4 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-96 p-4">
              {/* User Msg */}
              <div className="flex justify-end">
                <div className="inline-block max-w-xs rounded-l-2xl rounded-tr-2xl bg-blue-600 px-4 py-2 text-sm text-white shadow-sm">
                  /start
                </div>
              </div>
              {/* Bot Msg */}
              <div className="flex justify-start">
                <div className="inline-block max-w-xs border border-slate-700 rounded-r-2xl rounded-tl-2xl bg-slate-800 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                  👋 Welcome to <b>Stellar Ramp</b>!
                  <br />
                  <br />
                  The fastest way to trade Crypto with VND.
                  <br />
                  <br />
                  📊 <b>Live Rates:</b>
                  <br />
                  USDC: 25,450 VND
                  <br />
                  XLM: 3,120 VND
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Mockup 2 */}
          <div className="relative z-10 w-full max-w-sm transform lg:rotate-2 transition-transform hover:rotate-0 overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-700 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                🤖
              </div>
              <div>
                <p className="text-sm font-bold text-white">Stellar Ramp Bot</p>
                <p className="text-xs text-blue-300">bot</p>
              </div>
            </div>
            <div className="flex flex-col justify-end space-y-4 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-slate-900/90 bg-blend-overlay h-96 p-4">
              {/* Bot Msg */}
              <div className="mb-2 flex justify-start">
                <div className="w-full border border-slate-700 rounded-r-2xl rounded-tl-2xl bg-slate-800 px-4 py-3 text-sm leading-relaxed text-white shadow-sm inline-block">
                  What would you like to do today? 👇
                </div>
              </div>
              {/* Inline Keyboard */}
              <div className="flex flex-col gap-2">
                <button className="w-full border border-slate-600 rounded-xl bg-slate-700 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-600">
                  🟢 Buy USDC with VND
                </button>
                <button className="w-full border border-slate-600 rounded-xl bg-slate-700 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-600">
                  🔴 Sell XLM to VND
                </button>
                <button className="flex w-full items-center justify-center gap-2 border border-slate-600 rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-600">
                  🔗 Check Bank Links
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-20 mt-16 flex justify-center">
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-blue-500 bg-blue-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-500 hover:shadow-xl"
          >
            📊 Buy/Sell Now
          </a>
        </div>
      </div>
    </section>
  );
};

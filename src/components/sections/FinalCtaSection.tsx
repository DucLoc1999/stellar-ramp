import { ArrowUpRight, MessageCircle } from 'lucide-react';

const BOT_URL = 'https://t.me/stellarrampbot';
const SUPPORT_URL = 'https://t.me/stellarampsupport';

export const FinalCtaSection = () => {
  return (
    <section className="relative bg-white py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="section-container">
        <div
          id="contact"
          className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-10 text-center shadow-xl sm:p-16"
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvc3ZnPg==")`,
            }}
          />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div className="absolute -left-32 -top-10 h-48 w-48 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -right-28 bottom-0 h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative space-y-6">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
              Ready to trade XLM and USDC safely and instantly?
            </h2>
            <p className="text-base text-slate-300 sm:text-lg max-w-2xl mx-auto">
              Join StellarRamp and experience automated crypto-to-VND trading in seconds. No app download. No hidden fees.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-primary-lg group rounded-xl"
              >
                🚀 Open StellarRamp on Telegram
                <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/50 px-6 py-3 text-base font-bold text-slate-300 transition-all hover:border-slate-500 hover:bg-slate-700/50"
              >
                💬 Contact 24/7 Support
                <MessageCircle className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

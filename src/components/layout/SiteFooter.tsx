const BOT_URL = 'https://t.me/stellarrampbot';
const SUPPORT_URL = 'https://t.me/stellarampsupport';

export const SiteFooter = () => {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 pt-16 pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between mb-12">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">SR</div>
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Stellar<span className="text-blue-600">Ramp</span>
              </span>
              <span className="text-sm text-slate-500">Fast · Secure · Best Rates</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 max-w-md mt-2">
            StellarRamp is an automated XLM and USDC on/off-ramp for Vietnamese users. Trade 24/7 via Telegram bot with transparent rates and instant settlement.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
            <a href="mailto:support@stellarramp.io" className="transition-colors hover:text-blue-600">
              📩 support@stellarramp.io
            </a>
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-blue-600">
              💬 @stellarampsupport
            </a>
          </div>
        </div>
        <div>
          <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary btn-primary-lg">
            🚀 Start Trading on Telegram
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 border-t border-slate-200 pt-8 text-center">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} Orbit Labs. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

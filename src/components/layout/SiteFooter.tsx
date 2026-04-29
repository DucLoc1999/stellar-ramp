const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/USDT247_bot";

export const SiteFooter = () => {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 pb-8 pt-16">
      <div className="mx-auto mb-12 flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-center md:items-start">
          <span className="mb-2 text-2xl font-bold tracking-tight text-slate-900">
            Stellar<span className="text-blue-600">Ramp</span>
          </span>
          <div className="flex gap-4">
            <a
              href="#"
              className="text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              Terms of Service
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="#"
              className="text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              Privacy Policy
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="#"
              className="text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              API Partners
            </a>
          </div>
        </div>
        <div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50"
          >
            📱 Join Community
          </a>
        </div>
      </div>
      <div className="mx-auto border-t border-slate-200 px-4 pt-8 text-center sm:px-6 lg:px-8 max-w-7xl">
        <p className="text-sm font-medium text-slate-500">
          © 2026 Orbit Labs. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

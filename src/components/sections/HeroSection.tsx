import { ArrowUpRight, Headset, Lock, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ExchangeRatesResponse } from '@shared/api';

const BOT_URL = 'https://t.me/stellarrampbot';

// Module-level 1-minute client cache — persists across re-renders, cleared on page reload
const CACHE_TTL = 60_000;
const clientCache = new Map<string, { data: ExchangeRatesResponse; expiresAt: number }>();

async function fetchRate(url: string): Promise<ExchangeRatesResponse | null> {
  const cached = clientCache.get(url);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: ExchangeRatesResponse = await res.json();
    clientCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

function RatePair({ label, data, loading }: { label: string; data: ExchangeRatesResponse | null; loading: boolean }) {
  const fmt = (n: number) => n.toLocaleString('vi-VN');
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
          <p className="mb-1 text-xs font-medium text-slate-500">Buy rate</p>
          <p className="text-lg font-bold text-emerald-600">
            {loading ? '...' : data ? `${fmt(data.buy)} ₫` : 'N/A'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
          <p className="mb-1 text-xs font-medium text-slate-500">Sell rate</p>
          <p className="text-lg font-bold text-red-500">
            {loading ? '...' : data ? `${fmt(data.sell)} ₫` : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}

export const HeroSection = () => {
  const [xlmRates, setXlmRates] = useState<ExchangeRatesResponse | null>(null);
  const [usdcRates, setUsdcRates] = useState<ExchangeRatesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [xlm, usdc] = await Promise.all([
        fetchRate('/api/exchange-rate/xlm'),
        fetchRate('/api/exchange-rate'),
      ]);
      if (!cancelled) {
        setXlmRates(xlm);
        setUsdcRates(usdc);
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, CACHE_TTL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="relative overflow-hidden pt-8 pb-20">
      <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)' }} />
      <div className="section-container lg:flex-row lg:items-center lg:gap-16">
        <div className="flex-1 space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/10 px-4 py-1 text-xs font-extrabold uppercase tracking-[0.28em] text-blue-600">
            Telegram Bot 24/7
          </span>
          <div className="space-y-6">
            <h1 className="text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Buy & Sell XLM and USDC — Fast, Safe & Best Rates 24/7
            </h1>
            <p className="max-w-2xl text-lg text-slate-500 sm:text-xl">
              Trade XLM and USDC anytime via Telegram Bot. Receive VND in minutes — supports all major Vietnamese banks and Stellar network.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary btn-primary-lg group"
            >
              🚀 Start Trading on Telegram
              <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <li className="inline-flex items-center gap-2 font-medium text-slate-700">
              <Headset className="h-4 w-4 text-blue-600" />
              ✅ 24/7 Support
            </li>
            <li className="inline-flex items-center gap-2 font-medium text-slate-700">
              <Zap className="h-4 w-4 text-blue-600" />
              ⚡ Settlement in 3–30s
            </li>
            <li className="inline-flex items-center gap-2 font-medium text-slate-700">
              <Lock className="h-4 w-4 text-blue-600" />
              🔒 Non-custodial & Transparent
            </li>
          </ul>
        </div>

        <div className="relative flex-1">
          <div className="absolute -inset-1 rounded-3xl bg-linear-to-r from-blue-400 to-indigo-500 blur opacity-20" />
          <div className="relative rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Bot status</p>
                  <p className="text-lg font-bold text-blue-600">Active 24/7</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Automated
                </span>
              </div>
              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Supported networks</span>
                  <span className="text-base font-bold text-slate-900">Stellar · BSC</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Vietnamese banks</span>
                  <span className="text-base font-bold text-slate-900">30+</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Avg. settlement time</span>
                  <span className="text-base font-bold text-blue-600">3–30s</span>
                </div>
                <div className="border-t border-slate-200 pt-4 flex flex-col gap-4">
                  <RatePair label="Live Rates (XLM/VND)" data={xlmRates} loading={loading} />
                  <RatePair label="Live Rates (USDC/VND)" data={usdcRates} loading={loading} />
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm">
                <p className="font-bold text-slate-900">🛡️ Non-Custodial Security</p>
                <p className="mt-2 text-slate-500">
                  Your funds never leave your wallet until trade confirmation. All transactions are on-chain and verifiable.
                </p>
              </div>
            </div>
            <div className="pointer-events-none absolute -left-12 top-1/3 h-32 w-32 rounded-full bg-blue-600/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-indigo-500/15 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
};

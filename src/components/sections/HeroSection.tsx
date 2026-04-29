import { CheckCircle2, Shield, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { ExchangeRatesResponse } from "@shared/api";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/usdt247shopbot";

// Module-level 1-minute client cache — persists across re-renders, cleared on page reload
const CACHE_TTL = 60_000;
const clientCache = new Map<
  string,
  { data: ExchangeRatesResponse; expiresAt: number }
>();

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

function RatePair({
  label,
  data,
  loading,
}: {
  label: string;
  data: ExchangeRatesResponse | null;
  loading: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString("vi-VN");
  return (
    <div>
      <p className="text-xs font-bold text-slate-500 tracking-wider mb-2">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-sm text-center">
          <span className="block text-xs text-slate-500 mb-1 font-medium">
            Buy
          </span>
          <span className="block font-bold text-emerald-600 text-sm">
            {loading ? "..." : data ? `${fmt(data.buy)} ₫` : "N/A"}
          </span>
        </div>
        <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-sm text-center">
          <span className="block text-xs text-slate-500 mb-1 font-medium">
            Sell
          </span>
          <span className="block font-bold text-red-500 text-sm">
            {loading ? "..." : data ? `${fmt(data.sell)} ₫` : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}

export const HeroSection = () => {
  const [xlmRates, setXlmRates] = useState<ExchangeRatesResponse | null>(null);
  const [usdcRates, setUsdcRates] = useState<ExchangeRatesResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [xlm, usdc] = await Promise.all([
        fetchRate("/api/exchange-rate/xlm"),
        fetchRate("/api/exchange-rate"),
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
    <section
      id="hero"
      className="relative pt-20 pb-32 overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Column */}
          <div className="max-w-2xl">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase bg-blue-100 text-blue-700 mb-6 border border-blue-200">
              24/7 TELEGRAM BOT
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
              The fastest way to <br className="hidden sm:block" />
              Buy & Sell <span className="text-blue-600">XLM & USDC</span>{" "}
              <br className="hidden sm:block" />
              with VND
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-xl">
              Instantly on-ramp and off-ramp via our non-custodial Telegram Bot.
              Receive VND directly to your local bank account in minutes.{" "}
              <span className="font-semibold text-slate-800">
                Zero hidden fees.
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-1"
              >
                Buy/Sell on Telegram
              </a>
            </div>
            <ul className="space-y-4 text-sm font-medium text-slate-700">
              <li className="flex items-center">
                <CheckCircle2 className="text-indigo-600 mr-3 w-5 h-5 flex-shrink-0" />
                24/7 Bank Transfers
              </li>
              <li className="flex items-center">
                <CheckCircle2 className="text-indigo-600 mr-3 w-5 h-5 flex-shrink-0" />
                3-30s Processing
              </li>
              <li className="flex items-center">
                <CheckCircle2 className="text-indigo-600 mr-3 w-5 h-5 flex-shrink-0" />
                Secure & Transparent
              </li>
            </ul>
          </div>

          {/* Right Column - Card */}
          <div className="relative w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl blur opacity-25"></div>
            <div className="bg-white/85 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden relative border border-slate-200">
              {/* Card Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  System Overview
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Bot Status: Active 24/7
                </span>
              </div>

              {/* Card Content */}
              <div className="p-6 space-y-5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">
                    Supported VN Banks
                  </span>
                  <span className="font-bold text-slate-900">50+</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">
                    Supported Assets
                  </span>
                  <span className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                      XLM
                    </span>
                    <span className="bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200 text-blue-700">
                      USDC
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">
                    Avg Processing
                  </span>
                  <span className="font-bold text-indigo-600">3-30s</span>
                </div>
              </div>

              {/* Live Rates Section */}
              <div className="bg-slate-100/80 p-6 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-500 tracking-wider mb-4 uppercase">
                  Live VND Rates
                </p>
                <div className="space-y-4">
                  <RatePair
                    label="USDC/VND"
                    data={usdcRates}
                    loading={loading}
                  />
                  <RatePair label="XLM/VND" data={xlmRates} loading={loading} />
                </div>
              </div>

              {/* Security Section */}
              <div className="bg-blue-50 px-6 py-4 border-t border-blue-100 text-center">
                <p className="text-xs font-semibold text-blue-700 flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" /> Zero-Knowledge Security.
                  End-to-end encrypted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

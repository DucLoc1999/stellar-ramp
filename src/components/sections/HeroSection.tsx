import { CheckCircle2, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AllRatesResponse, OurRate } from "@shared/api";

const BOT_URL =
  import.meta.env.VITE_TELEGRAM_LINK || "https://t.me/usdt247shopbot";

const CACHE_TTL = 60_000;
const clientCache = new Map<
  string,
  { data: AllRatesResponse; expiresAt: number }
>();

const API_BASE = import.meta.env.VITE_BASE_URL || "http://localhost:3001";

async function fetchRates(): Promise<AllRatesResponse | null> {
  const url = `${API_BASE}/landing/p2p-rates`;
  const cached = clientCache.get(url);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: AllRatesResponse = await res.json();
    clientCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

export const HeroSection = () => {
  const { t } = useTranslation();
  const [usdcRates, setUsdcRates] = useState<OurRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [payInput, setPayInput] = useState("");
  const [receiveInput, setReceiveInput] = useState("");
  const [inputSide, setInputSide] = useState<"pay" | "receive">("pay");
  const [progress, setProgress] = useState(100);
  const lastFetchRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await fetchRates();
      if (!cancelled) {
        setUsdcRates(data?.our ?? null);
        setLoading(false);
        lastFetchRef.current = Date.now();
        setProgress(100);
      }
    }

    load();
    const interval = setInterval(load, CACHE_TTL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - lastFetchRef.current;
      setProgress(Math.max(0, (1 - elapsed / CACHE_TTL) * 100));
    }, 250);
    return () => clearInterval(tick);
  }, []);

  const secondsLeft = Math.ceil((progress / 100) * 60);
  const fmt4 = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const parse = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const fmtVnd = (n: number) => n.toLocaleString("vi-VN");

  const feeRateBuy = usdcRates?.fee_rate_buy ?? 0.008;
  const feeRateSell = usdcRates?.fee_rate_sell ?? 0.008;
  const minFeeVnd = usdcRates?.min_fee_vnd ?? 0;
  const feeRate = mode === "buy" ? feeRateBuy : feeRateSell;

  const calcFee = (vnd: number, rate: number) =>
    vnd > 0 ? Math.max(vnd * rate, minFeeVnd) : 0;

  let displayPay = "";
  let displayReceive = "";
  let appliedFee = 0;

  if (usdcRates) {
    if (inputSide === "pay") {
      const payNum = parse(payInput);
      if (payNum > 0) {
        if (mode === "buy") {
          appliedFee = calcFee(payNum, feeRateBuy);
          displayReceive = fmt4((payNum - appliedFee) / usdcRates.buy);
        } else {
          const vnd = payNum * usdcRates.sell;
          appliedFee = calcFee(vnd, feeRateSell);
          displayReceive = (vnd - appliedFee).toLocaleString("vi-VN");
        }
      }
    } else {
      const receiveNum = parse(receiveInput);
      if (receiveNum > 0) {
        if (mode === "buy") {
          // reverse: given desired USDC out, find VND to pay
          const vndCase1 = (receiveNum * usdcRates.buy) / (1 - feeRateBuy);
          const vndToPay = vndCase1 * feeRateBuy >= minFeeVnd
            ? vndCase1
            : receiveNum * usdcRates.buy + minFeeVnd;
          appliedFee = calcFee(vndToPay, feeRateBuy);
          displayPay = fmtVnd(Math.round(vndToPay));
        } else {
          // reverse: given desired VND out, find USDC to sell
          const usdcCase1 = receiveNum / (usdcRates.sell * (1 - feeRateSell));
          const usdcToSell = usdcCase1 * usdcRates.sell * feeRateSell >= minFeeVnd
            ? usdcCase1
            : (receiveNum + minFeeVnd) / usdcRates.sell;
          appliedFee = calcFee(usdcToSell * usdcRates.sell, feeRateSell);
          displayPay = fmt4(usdcToSell);
        }
      }
    }
  }

  const usdcFee = appliedFee > 0 ? fmtVnd(Math.round(appliedFee)) : "";

  return (
    <section
      id="hero"
      className="relative pt-20 pb-32 overflow-hidden bg-linear-to-b from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Column */}
          <div className="max-w-2xl">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase bg-blue-100 text-blue-700 mb-6 border border-blue-200">
              {t("hero.badge")}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight mb-6">
              {t("hero.title1")} <br className="hidden sm:block" />
              {t("hero.title2")} <span className="text-blue-600">USDC</span>{" "}
              <br className="hidden sm:block" />
              {t("hero.title3")}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed max-w-xl">
              {t("hero.description")}{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {t("hero.zeroFees")}
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-1"
              >
                {t("hero.cta")}
              </a>
            </div>
            <ul className="space-y-4 text-sm font-medium text-slate-700 dark:text-slate-300">
              <li className="flex items-center">
                <CheckCircle2 className="text-indigo-600 mr-3 w-5 h-5 shrink-0" />
                {t("hero.feature1")}
              </li>
              <li className="flex items-center">
                <CheckCircle2 className="text-indigo-600 mr-3 w-5 h-5 shrink-0" />
                {t("hero.feature2")}
              </li>
              <li className="flex items-center">
                <CheckCircle2 className="text-indigo-600 mr-3 w-5 h-5 shrink-0" />
                {t("hero.feature3")}
              </li>
            </ul>
          </div>

          {/* Right Column - Card */}
          <div className="relative w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div className="absolute -inset-1 bg-linear-to-r from-blue-400 to-indigo-500 rounded-2xl blur opacity-25"></div>
            <div className="bg-white/85 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden relative border border-slate-200 dark:bg-slate-800/90 dark:border-slate-700">
              {/* Card Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t("hero.systemOverview")}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {t("hero.botStatus")}
                </span>
              </div>

              {/* Card Content */}
              <div className="p-6 space-y-5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">
                    {t("hero.supportedBanks")}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">50+</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">
                    {t("hero.supportedAssets")}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200 text-blue-700">
                      USDC
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">
                    {t("hero.avgProcessing")}
                  </span>
                  <span className="font-bold text-indigo-600">3-30s</span>
                </div>
              </div>

              {/* Live Rate Converter */}
              <div className="bg-slate-100/80 dark:bg-slate-900/60 p-6 border-t border-slate-200 dark:border-slate-700">
                {/* Header row with pill toggle */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                    {t("hero.liveRates")}
                  </p>
                  <div className="relative flex rounded-full bg-slate-200 dark:bg-slate-700 p-0.5 text-xs font-semibold">
                    <div
                      className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full transition-all duration-200 ${
                        mode === "buy"
                          ? "left-0.5 bg-emerald-500"
                          : "left-[calc(50%+2px)] bg-red-500"
                      }`}
                    />
                    <button
                      onClick={() => { setMode("buy"); setPayInput(""); setReceiveInput(""); setInputSide("pay"); }}
                      className={`relative z-10 px-3 py-1 rounded-full transition-colors ${
                        mode === "buy" ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {t("hero.buy")}
                    </button>
                    <button
                      onClick={() => { setMode("sell"); setPayInput(""); setReceiveInput(""); setInputSide("pay"); }}
                      className={`relative z-10 px-3 py-1 rounded-full transition-colors ${
                        mode === "sell" ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {t("hero.sell")}
                    </button>
                  </div>
                </div>

                {/* Input / Output rows */}
                <div className="space-y-2 mb-3">
                  {/* Column labels */}
                  <div className="grid grid-cols-2 gap-3">
                    <span className="text-xs text-slate-400 font-medium px-1">{t("hero.youPay")}</span>
                    <span className="text-xs text-slate-400 font-medium px-1">{t("hero.youReceive")}</span>
                  </div>

                  {/* USDC row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={inputSide === "pay" ? payInput : displayPay}
                        onChange={(e) => { setPayInput(e.target.value); setInputSide("pay"); }}
                        placeholder="0"
                        className="w-full px-3 pt-2 pb-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none bg-transparent"
                      />
                      <span className="block px-3 pb-2 text-xs font-bold text-blue-600">
                        {mode === "buy" ? "VND" : "USDC"}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={inputSide === "receive" ? receiveInput : displayReceive}
                        onChange={(e) => { setReceiveInput(e.target.value); setInputSide("receive"); }}
                        placeholder={loading ? "…" : "0"}
                        disabled={loading}
                        className="w-full px-3 pt-2 pb-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none bg-transparent disabled:opacity-50"
                      />
                      <span className="block px-3 pb-2 text-xs font-bold text-blue-600">
                        {mode === "buy" ? "USDC" : "VND"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
                    {t("hero.fee")}: <span className="font-semibold text-slate-500">{usdcFee || "0"} ₫</span> ({((feeRate) * 100).toFixed(1)}%{minFeeVnd > 0 ? `, min ${fmtVnd(minFeeVnd)} ₫` : ""})
                  </p>
                </div>

                {/* Rate hint */}
                <div className="mb-4 text-xs text-slate-400 dark:text-slate-500 flex gap-3 flex-wrap">
                  {usdcRates && (
                    <span>
                      1 USDC ={" "}
                      <span className={`font-semibold ${mode === "buy" ? "text-emerald-600" : "text-red-500"}`}>
                        {(mode === "buy" ? usdcRates.buy : usdcRates.sell).toLocaleString("vi-VN")} ₫
                      </span>
                    </span>
                  )}
                </div>

                {/* Refresh progress bar */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500">{t("hero.nextRefresh")}</span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {secondsLeft}s
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Security Section */}
              <div className="bg-blue-50 dark:bg-blue-950/40 px-6 py-4 border-t border-blue-100 dark:border-blue-900 text-center">
                <p className="text-xs font-semibold text-blue-700 flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" /> {t("hero.zeroKnowledge")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

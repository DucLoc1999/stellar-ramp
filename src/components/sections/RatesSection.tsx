import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
} from "../ui/chart";
import { AllRatesResponse, AllHistoryResponse, P2PHistoryPoint } from "@shared/api";
import { SectionHeading } from "./SectionHeading";

const CACHE_TTL = 60_000;
const clientCache = new Map<string, { data: unknown; expiresAt: number }>();

async function fetchCached<T>(url: string): Promise<T | null> {
  const hit = clientCache.get(url);
  if (hit && Date.now() < hit.expiresAt) return hit.data as T;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: T = await res.json();
    clientCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

interface RateRow {
  asset: string;
  network: string;
  subLabel: string;
  logo: string;
  buy: number | null;
  sell: number | null;
  isFeatured?: boolean;
  isCompetitor?: boolean;
}

function fmt(n: number | null) {
  if (n === null) return null;
  return n.toLocaleString("vi-VN");
}

function SkeletonCell({ right = false }: { right?: boolean }) {
  return (
    <td className={`px-5 py-4 ${right ? "text-right" : ""}`}>
      <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700 inline-block" />
    </td>
  );
}

const EXCHANGE_CHART_CONFIG = {
  buy: { label: "Mua (Buy)", color: "rgb(74 222 128)" },
  sell: { label: "Bán (Sell)", color: "rgb(251 146 60)" },
};

const COMPARISON_CONFIG = {
  ours: { label: "Stellar Ramp", color: "rgb(74 222 128)" },
  binance: { label: "Binance P2P", color: "rgb(251 191 36)" },
  okx: { label: "OKX P2P", color: "rgb(99 102 241)" },
  bybit: { label: "Bybit P2P", color: "rgb(236 72 153)" },
};

type AnyConfig = Record<string, { label: string; color: string }>;

function makeTooltip(config: AnyConfig) {
  return function TooltipContent({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: any[];
    label?: string;
  }) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-background/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm min-w-[11rem]">
        <p className="mb-2 font-semibold text-foreground/60 tracking-wide">
          {label}
        </p>
        {payload.map((entry: any) => {
          const cfg = config[entry.dataKey as string];
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">
                {cfg?.label ?? entry.dataKey}
              </span>
              <span
                className="ml-auto pl-4 font-mono font-semibold tabular-nums"
                style={{ color: entry.color }}
              >
                {Number(entry.value).toLocaleString("vi-VN")} ₫
              </span>
            </div>
          );
        })}
      </div>
    );
  };
}

const ExchangeTooltip = makeTooltip(EXCHANGE_CHART_CONFIG);
const ComparisonTooltip = makeTooltip(COMPARISON_CONFIG);

function formatLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface ExchangeChartProps {
  title: string;
  history: P2PHistoryPoint[];
  tall?: boolean;
  config: AnyConfig;
  tooltipContent: React.ReactElement;
  dataKeys: { key: string; color: string }[];
}

function ExchangeChart({
  title,
  history,
  tall,
  config,
  tooltipContent,
  dataKeys,
}: ExchangeChartProps) {
  const chartData = history.map((row) => ({
    date: formatLabel(row.created_at),
    buy: row.buy,
    sell: row.sell,
  }));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-xl transition hover:border-primary/40">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="p-8">
        <p className="mb-6 text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
          {title}
        </p>
        {chartData.length === 0 ? (
          <p
            className={`${tall ? "h-96" : "h-64"} flex items-center justify-center text-sm text-muted-foreground`}
          >
            Chưa có dữ liệu lịch sử
          </p>
        ) : (
          <ChartContainer
            config={config}
            className={`${tall ? "h-96" : "h-64"} w-full`}
          >
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/30"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                domain={["auto", "auto"]}
                width={40}
              />
              <ChartTooltip content={tooltipContent} />
              {dataKeys.map(({ key, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}

interface ComparisonChartProps {
  title: string;
  side: "buy" | "sell";
  historyData: AllHistoryResponse | null;
}

function ComparisonChart({ title, side, historyData }: ComparisonChartProps) {
  const ours = historyData?.our ?? [];
  const binance = historyData?.binance ?? [];
  const okx = historyData?.okx ?? [];
  const bybit = historyData?.bybit ?? [];

  const merged = new Map<
    number,
    {
      ts: number;
      date: string;
      ours?: number;
      binance?: number;
      okx?: number;
      bybit?: number;
    }
  >();
  for (const row of ours)
    merged.set(row.created_at, {
      ...merged.get(row.created_at),
      ts: row.created_at,
      date: formatLabel(row.created_at),
      ours: row[side] ?? undefined,
    });
  for (const row of binance)
    merged.set(row.created_at, {
      ...merged.get(row.created_at),
      ts: row.created_at,
      date: formatLabel(row.created_at),
      binance: row[side] ?? undefined,
    });
  for (const row of okx)
    merged.set(row.created_at, {
      ...merged.get(row.created_at),
      ts: row.created_at,
      date: formatLabel(row.created_at),
      okx: row[side] ?? undefined,
    });
  for (const row of bybit)
    merged.set(row.created_at, {
      ...merged.get(row.created_at),
      ts: row.created_at,
      date: formatLabel(row.created_at),
      bybit: row[side] ?? undefined,
    });
  const chartData = Array.from(merged.values()).sort((a, b) => a.ts - b.ts);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-xl transition hover:border-primary/40">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="p-8">
        <p className="mb-6 text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
          {title}
        </p>
        {chartData.length === 0 ? (
          <p className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Chưa có dữ liệu lịch sử
          </p>
        ) : (
          <ChartContainer config={COMPARISON_CONFIG} className="h-64 w-full">
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/30"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                domain={["auto", "auto"]}
                width={40}
              />
              <ChartTooltip content={<ComparisonTooltip />} />
              <Line
                type="monotone"
                dataKey="ours"
                stroke="var(--color-ours)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="binance"
                stroke="var(--color-binance)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="okx"
                stroke="var(--color-okx)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="bybit"
                stroke="var(--color-bybit)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}

function LiveCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(CACHE_TTL / 1000);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const remaining = CACHE_TTL / 1000 - (elapsed % (CACHE_TTL / 1000));
      setSecondsLeft(remaining);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span>Refreshing in {secondsLeft}s</span>
    </span>
  );
}

export const RatesSection = () => {
  const [rows, setRows] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<7 | 30>(7);
  const [historyData, setHistoryData] = useState<AllHistoryResponse | null>(null);
  const isFirstLoad = useRef(true);

  async function load() {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
    } else {
      setRefreshing(true);
      await new Promise((r) => setTimeout(r, 150));
    }

    const rates = await fetchCached<AllRatesResponse>("/api/p2p-rates");

    setRows([
      {
        asset: "USDC",
        network: "Stellar Ramp",
        subLabel: "Stellar",
        logo: "/exchanges/stellarRamp.png",
        buy: rates?.our.buy ?? null,
        sell: rates?.our.sell ?? null,
        isFeatured: true,
      },
      {
        asset: "USDC",
        network: "Binance P2P",
        subLabel: "BSC (BEP20)",
        logo: "/exchanges/binance.png",
        buy: rates?.binance.bestBuyPrice ?? null,
        sell: rates?.binance.bestSellPrice ?? null,
        isCompetitor: true,
      },
      {
        asset: "USDC",
        network: "OKX P2P",
        subLabel: "OKX",
        logo: "/exchanges/okx.png",
        buy: rates?.okx.bestBuyPrice ?? null,
        sell: rates?.okx.bestSellPrice ?? null,
        isCompetitor: true,
      },
      {
        asset: "USDC",
        network: "Bybit P2P",
        subLabel: "Bybit",
        logo: "/exchanges/bybit.png",
        buy: rates?.bybit.bestBuyPrice ?? null,
        sell: rates?.bybit.bestSellPrice ?? null,
        isCompetitor: true,
      },
    ]);
    setLoading(false);
    setRefreshing(false);
  }

  async function loadHistory() {
    const data = await fetchCached<AllHistoryResponse>(`/api/p2p-history?days=${range}`);
    if (data) setHistoryData(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, CACHE_TTL);
    return () => clearInterval(interval);
  }, [range]);

  const ROWS_COUNT = 4;

  const bestBuy =
    rows.length > 0 ? Math.max(...rows.map((r) => r.buy ?? -Infinity)) : null;
  const bestSell =
    rows.length > 0 ? Math.min(...rows.map((r) => r.sell ?? Infinity)) : null;

  const competitorRows = rows.filter((r) => r.isCompetitor);
  const ourRow = rows.find((r) => r.isFeatured);

  return (
    <section className="relative bg-slate-50 dark:bg-slate-900 py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-200 to-transparent" />
      <div className="section-container space-y-6">
        <SectionHeading
          id="rates"
          eyebrow="Live Rates"
          title="Transparent, real-time exchange rates"
          description={
            <>Live prices from the most popular P2P platforms in Vietnam.</>
          }
        />

        {/* Rate table — desktop */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="pb-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pl-2">
                  Asset
                </th>
                <th className="pb-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Buy (VND)
                </th>
                <th className="pb-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Sell (VND)
                </th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: ROWS_COUNT }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <SkeletonCell />
                    <SkeletonCell right />
                    <SkeletonCell right />
                    <td className="px-5 py-4 w-36" />
                  </tr>
                ))
              ) : (
                <>
                  {/* Our featured row */}
                  {ourRow && (
                    <tr className="border-b border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20">
                      <td className="pl-2 pr-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-800 overflow-hidden shrink-0 ring-2 ring-slate-200 dark:ring-slate-600">
                              <img src={ourRow.logo} alt={ourRow.network} className="h-full w-full object-contain" />
                            </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {ourRow.asset}
                              </span>
                              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white leading-none">
                                Stellar Ramp
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {ourRow.subLabel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className={`inline-flex flex-col items-end transition-opacity duration-300 ${refreshing ? "opacity-0" : "opacity-100"}`}>
                          <span className="font-bold text-emerald-600 text-base tabular-nums">
                            {ourRow.buy !== null ? (
                              `${fmt(ourRow.buy)} ₫`
                            ) : (
                              <span className="text-slate-400 text-sm font-medium">
                                N/A
                              </span>
                            )}
                          </span>
                          {ourRow.buy !== null &&
                            bestBuy !== null &&
                            ourRow.buy === bestBuy && (
                              <span className="mt-0.5 text-[10px] font-bold text-emerald-500 uppercase tracking-wide">
                                Best Rate
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className={`inline-flex flex-col items-end transition-opacity duration-300 ${refreshing ? "opacity-0" : "opacity-100"}`}>
                          <span className="font-bold text-red-500 text-base tabular-nums">
                            {ourRow.sell !== null ? (
                              `${fmt(ourRow.sell)} ₫`
                            ) : (
                              <span className="text-slate-400 text-sm font-medium">
                                N/A
                              </span>
                            )}
                          </span>
                          {ourRow.sell !== null &&
                            bestSell !== null &&
                            ourRow.sell === bestSell && (
                              <span className="mt-0.5 text-[10px] font-bold text-emerald-500 uppercase tracking-wide">
                                Lowest Fee
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-5 py-4 w-36 text-right">
                        <a
                          href={import.meta.env.VITE_TELEGRAM_LINK}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors shadow-sm shadow-emerald-200 dark:shadow-emerald-900/40"
                        >
                          Buy Now
                        </a>
                      </td>
                    </tr>
                  )}

                  {/* Competitor group header */}
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 pt-5 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500"
                    >
                      Market Comparison
                    </td>
                  </tr>

                  {competitorRows.map((row, i) => (
                    <tr
                      key={`${row.asset}-${row.network}`}
                      className={`border-b border-slate-100 dark:border-slate-800 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${i === competitorRows.length - 1 ? "border-b-0" : ""}`}
                    >
                      <td className="pl-2 pr-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-800 overflow-hidden shrink-0 ring-2 ring-slate-200 dark:ring-slate-600">
                              <img src={row.logo} alt={row.network} className="h-full w-full object-contain" />
                            </div>
                          <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {row.network}
                            </span>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {row.subLabel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-right font-semibold text-slate-600 dark:text-slate-400 tabular-nums transition-opacity duration-300 ${refreshing ? "opacity-0" : "opacity-100"}`}>
                        {row.buy !== null ? (
                          `${fmt(row.buy)} ₫`
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 text-xs font-medium">
                            N/A
                          </span>
                        )}
                      </td>
                      <td className={`px-5 py-4 text-right font-semibold text-slate-600 dark:text-slate-400 tabular-nums transition-opacity duration-300 ${refreshing ? "opacity-0" : "opacity-100"}`}>
                        {row.sell !== null ? (
                          `${fmt(row.sell)} ₫`
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 text-xs font-medium">
                            N/A
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 w-36" />
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <LiveCountdown />
            <span className="mx-1">·</span>
            <span>Final rate confirmed at trade execution.</span>
          </div>
        </div>

        {/* Rate cards — mobile */}
        <div className="flex flex-col gap-3 sm:hidden">
          {loading
            ? Array.from({ length: ROWS_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3"
                >
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              ))
            : rows.map((row) => (
                <div
                  key={`${row.asset}-${row.network}`}
                  className={`rounded-2xl border p-5 ${
                    row.isFeatured
                      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full overflow-hidden ring-2 ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-800`}
                      >
                        <img src={row.logo} alt={row.network} className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${row.isFeatured ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}
                          >
                            {row.isFeatured ? "Stellar Ramp" : row.network}
                          </span>
                          {row.isFeatured && (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white leading-none">
                              Our Rate
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {row.subLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70 mb-1">
                        Buy
                      </p>
                      <p className={`font-bold text-emerald-600 tabular-nums text-sm transition-opacity duration-300 ${refreshing ? "opacity-0" : "opacity-100"}`}>
                        {row.buy !== null ? (
                          `${fmt(row.buy)} ₫`
                        ) : (
                          <span className="text-slate-400 font-medium">
                            N/A
                          </span>
                        )}
                      </p>
                      {row.buy !== null &&
                        bestBuy !== null &&
                        row.buy === bestBuy && (
                          <p className="text-[10px] font-bold text-emerald-500 mt-0.5 uppercase">
                            Best Rate
                          </p>
                        )}
                    </div>
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/20 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-500/70 mb-1">
                        Sell
                      </p>
                      <p className={`font-bold text-red-500 tabular-nums text-sm transition-opacity duration-300 ${refreshing ? "opacity-0" : "opacity-100"}`}>
                        {row.sell !== null ? (
                          `${fmt(row.sell)} ₫`
                        ) : (
                          <span className="text-slate-400 font-medium">
                            N/A
                          </span>
                        )}
                      </p>
                      {row.sell !== null &&
                        bestSell !== null &&
                        row.sell === bestSell && (
                          <p className="text-[10px] font-bold text-emerald-500 mt-0.5 uppercase">
                            Lowest Fee
                          </p>
                        )}
                    </div>
                  </div>
                  {row.isFeatured && (
                    <a
                      href={import.meta.env.VITE_TELEGRAM_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition-colors"
                    >
                      Buy Now
                    </a>
                  )}
                </div>
              ))}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 px-1">
            <LiveCountdown />
            <span className="mx-1">·</span>
            <span>Final rate confirmed at trade execution.</span>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex justify-end gap-2">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-150 ${
                range === r
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                  : "border border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
              }`}
            >
              {r} ngày
            </button>
          ))}
        </div>

        {/* USDC our price chart */}
        <ExchangeChart
          title="USDC / VND — Stellar Ramp (Mua / Bán)"
          history={historyData?.our ?? []}
          config={EXCHANGE_CHART_CONFIG}
          tooltipContent={<ExchangeTooltip />}
          dataKeys={[
            { key: "buy", color: "var(--color-buy)" },
            { key: "sell", color: "var(--color-sell)" },
          ]}
        />

        {/* USDC P2P comparison charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ComparisonChart
            title="So sánh giá Mua USDC P2P (Buy)"
            side="buy"
            historyData={historyData}
          />
          <ComparisonChart
            title="So sánh giá Bán USDC P2P (Sell)"
            side="sell"
            historyData={historyData}
          />
        </div>

        {/* Linked with over */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className="relative z-10">
            <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-bold text-slate-900 dark:text-slate-100 leading-[1.15] tracking-tight mb-8 lg:mb-0">
              Linked with over
              <br />
              <span className="text-emerald-500">50+ banks,</span>
              <br />
              <span className="text-emerald-500">7+ e-wallets</span>
            </h2>
          </div>

          <div className="relative w-full flex justify-center lg:justify-end">
            <div className="relative bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-4 sm:p-8 rounded-[2rem] border border-slate-200/60 dark:border-slate-700/60 shadow-inner w-full max-w-[600px]">
              <div className="absolute inset-0 rounded-[2rem] shadow-[inset_0_0_20px_rgba(0,0,0,0.02)] border border-white/80" />
              <img
                src="/payment_methods_logos.png"
                alt="50+ Vietnamese Banks and E-wallets"
                className="w-full h-auto object-contain drop-shadow-xl relative z-10 rounded-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

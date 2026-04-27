import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartLegend, ChartLegendContent } from '../ui/chart';
import { ExchangeRatesResponse, P2PRate, P2PHistoryPoint } from '@shared/api';
import { SectionHeading } from './SectionHeading';

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
  buy: number | null;
  sell: number | null;
}

function fmt(n: number | null) {
  if (n === null) return 'N/A';
  return n.toLocaleString('vi-VN');
}

function SkeletonCell({ right = false }: { right?: boolean }) {
  return (
    <td className={`px-6 py-5 ${right ? 'text-right' : ''}`}>
      <div className="h-4 w-20 animate-pulse rounded bg-slate-200 inline-block" />
    </td>
  );
}

const EXCHANGE_CHART_CONFIG = {
  buy:  { label: 'Mua (Buy)',  color: 'rgb(74 222 128)' },
  sell: { label: 'Bán (Sell)', color: 'rgb(251 146 60)' },
};

const COMPARISON_CONFIG = {
  ours:    { label: 'Stellar Ramp', color: 'rgb(74 222 128)' },
  binance: { label: 'Binance P2P',  color: 'rgb(251 191 36)' },
  okx:     { label: 'OKX P2P',      color: 'rgb(99 102 241)' },
  bybit:   { label: 'Bybit P2P',    color: 'rgb(236 72 153)' },
};

const XLM_CHART_CONFIG = {
  buy:  { label: 'XLM Mua', color: 'rgb(56 189 248)' },
  sell: { label: 'XLM Bán', color: 'rgb(168 85 247)' },
};

type AnyConfig = Record<string, { label: string; color: string }>;

function makeTooltip(config: AnyConfig) {
  return function TooltipContent({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-background/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm min-w-[11rem]">
        <p className="mb-2 font-semibold text-foreground/60 tracking-wide">{label}</p>
        {payload.map((entry: any) => {
          const cfg = config[entry.dataKey as string];
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{cfg?.label ?? entry.dataKey}</span>
              <span className="ml-auto pl-4 font-mono font-semibold tabular-nums" style={{ color: entry.color }}>
                {Number(entry.value).toLocaleString('vi-VN')} ₫
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
const XlmTooltip = makeTooltip(XLM_CHART_CONFIG);

function formatLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface ExchangeChartProps {
  title: string;
  historyEndpoint: string;
  range: 7 | 30;
  tall?: boolean;
  config: AnyConfig;
  tooltipContent: React.ReactElement;
  dataKeys: { key: string; color: string }[];
}

function ExchangeChart({ title, historyEndpoint, range, tall, config, tooltipContent, dataKeys }: ExchangeChartProps) {
  const [history, setHistory] = useState<P2PHistoryPoint[]>([]);

  useEffect(() => {
    fetch(`${historyEndpoint}?days=${range}`)
      .then((r) => r.json())
      .then(setHistory)
      .catch(console.error);
  }, [historyEndpoint, range]);

  const chartData = history.map((row) => ({
    date: formatLabel(row.created_at),
    buy: row.buy,
    sell: row.sell,
  }));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-xl transition hover:border-primary/40">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="p-8">
        <p className="mb-6 text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">{title}</p>
        {chartData.length === 0 ? (
          <p className={`${tall ? 'h-96' : 'h-64'} flex items-center justify-center text-sm text-muted-foreground`}>
            Chưa có dữ liệu lịch sử
          </p>
        ) : (
          <ChartContainer config={config} className={`${tall ? 'h-96' : 'h-64'} w-full`}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} domain={['auto', 'auto']} width={40} />
              <ChartTooltip content={tooltipContent} />
              {dataKeys.map(({ key, color }) => (
                <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
  side: 'buy' | 'sell';
  range: 7 | 30;
}

function ComparisonChart({ title, side, range }: ComparisonChartProps) {
  const [ours, setOurs]       = useState<P2PHistoryPoint[]>([]);
  const [binance, setBinance] = useState<P2PHistoryPoint[]>([]);
  const [okx, setOkx]         = useState<P2PHistoryPoint[]>([]);
  const [bybit, setBybit]     = useState<P2PHistoryPoint[]>([]);

  useEffect(() => {
    fetch(`/api/our-price-history?days=${range}`).then((r) => r.json()).then(setOurs).catch(console.error);
    fetch(`/api/binance-p2p-history?days=${range}`).then((r) => r.json()).then(setBinance).catch(console.error);
    fetch(`/api/okx-p2p-history?days=${range}`).then((r) => r.json()).then(setOkx).catch(console.error);
    fetch(`/api/bybit-p2p-history?days=${range}`).then((r) => r.json()).then(setBybit).catch(console.error);
  }, [range]);

  const merged = new Map<number, { ts: number; date: string; ours?: number; binance?: number; okx?: number; bybit?: number }>();
  for (const row of ours)    merged.set(row.created_at, { ...merged.get(row.created_at), ts: row.created_at, date: formatLabel(row.created_at), ours:    row[side] ?? undefined });
  for (const row of binance) merged.set(row.created_at, { ...merged.get(row.created_at), ts: row.created_at, date: formatLabel(row.created_at), binance: row[side] ?? undefined });
  for (const row of okx)     merged.set(row.created_at, { ...merged.get(row.created_at), ts: row.created_at, date: formatLabel(row.created_at), okx:     row[side] ?? undefined });
  for (const row of bybit)   merged.set(row.created_at, { ...merged.get(row.created_at), ts: row.created_at, date: formatLabel(row.created_at), bybit:   row[side] ?? undefined });
  const chartData = Array.from(merged.values()).sort((a, b) => a.ts - b.ts);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-xl transition hover:border-primary/40">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="p-8">
        <p className="mb-6 text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">{title}</p>
        {chartData.length === 0 ? (
          <p className="h-64 flex items-center justify-center text-sm text-muted-foreground">Chưa có dữ liệu lịch sử</p>
        ) : (
          <ChartContainer config={COMPARISON_CONFIG} className="h-64 w-full">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} domain={['auto', 'auto']} width={40} />
              <ChartTooltip content={<ComparisonTooltip />} />
              <Line type="monotone" dataKey="ours"    stroke="var(--color-ours)"    strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="binance" stroke="var(--color-binance)" strokeWidth={2}   dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="okx"     stroke="var(--color-okx)"     strokeWidth={2}   dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="bybit"   stroke="var(--color-bybit)"   strokeWidth={2}   dot={false} activeDot={{ r: 4 }} />
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}

export const RatesSection = () => {
  const [rows, setRows] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 30>(7);

  async function load() {
    const [xlm, usdc, binance, okx, bybit] = await Promise.all([
      fetchCached<ExchangeRatesResponse>('/api/exchange-rate/xlm'),
      fetchCached<ExchangeRatesResponse>('/api/exchange-rate'),
      fetchCached<P2PRate>('/api/binance-p2p-rate'),
      fetchCached<P2PRate>('/api/okx-p2p-rate'),
      fetchCached<P2PRate>('/api/bybit-p2p-rate'),
    ]);

    setRows([
      { asset: 'XLM',  network: 'Stellar',    buy: xlm?.buy     ?? null, sell: xlm?.sell          ?? null },
      { asset: 'USDC', network: 'Stellar',     buy: usdc?.buy    ?? null, sell: usdc?.sell         ?? null },
      { asset: 'USDC', network: 'BSC (BEP20)', buy: binance?.bestBuyPrice  ?? null, sell: binance?.bestSellPrice ?? null },
      { asset: 'USDC', network: 'OKX P2P',     buy: okx?.bestBuyPrice     ?? null, sell: okx?.bestSellPrice     ?? null },
      { asset: 'USDC', network: 'Bybit P2P',   buy: bybit?.bestBuyPrice   ?? null, sell: bybit?.bestSellPrice   ?? null },
    ]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  const ROWS_COUNT = 5;

  return (
    <section className="relative bg-slate-50 py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-200 to-transparent" />
      <div className="section-container space-y-6">
        <SectionHeading
          id="rates"
          eyebrow="Live Rates"
          title="Transparent, real-time exchange rates"
          description="Rates are updated continuously. No hidden spreads — what you see is what you get."
        />

        {/* Rate table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Asset</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Network</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Buy (VND)</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Sell (VND)</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: ROWS_COUNT }).map((_, i) => (
                      <tr key={i} className={`border-b border-slate-100 ${i === ROWS_COUNT - 1 ? 'border-b-0' : ''}`}>
                        <SkeletonCell /><SkeletonCell /><SkeletonCell right /><SkeletonCell right />
                      </tr>
                    ))
                  : rows.map((row, i) => (
                      <tr
                        key={`${row.asset}-${row.network}`}
                        className={`border-b border-slate-100 transition hover:bg-slate-50 ${i === rows.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                              {row.asset.slice(0, 2)}
                            </div>
                            <span className="font-bold text-slate-900">{row.asset}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-slate-500">{row.network}</td>
                        <td className="px-6 py-5 text-right font-bold text-emerald-600">
                          {row.buy !== null ? `${fmt(row.buy)} ₫` : '—'}
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-red-500">
                          {row.sell !== null ? `${fmt(row.sell)} ₫` : '—'}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-400">Rates refresh every 60 seconds. Final rate confirmed at trade execution.</p>
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
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                  : 'border border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-primary hover:shadow-sm'
              }`}
            >
              {r} ngày
            </button>
          ))}
        </div>

        {/* XLM/VND chart */}
        <ExchangeChart
          title="XLM / VND — Stellar Ramp (Mua / Bán)"
          historyEndpoint="/api/stellar-xlm-history"
          range={range}
          tall
          config={XLM_CHART_CONFIG}
          tooltipContent={<XlmTooltip />}
          dataKeys={[
            { key: 'buy',  color: 'var(--color-buy)' },
            { key: 'sell', color: 'var(--color-sell)' },
          ]}
        />

        {/* USDC our price chart */}
        <ExchangeChart
          title="USDC / VND — Stellar Ramp (Mua / Bán)"
          historyEndpoint="/api/our-price-history"
          range={range}
          config={EXCHANGE_CHART_CONFIG}
          tooltipContent={<ExchangeTooltip />}
          dataKeys={[
            { key: 'buy',  color: 'var(--color-buy)' },
            { key: 'sell', color: 'var(--color-sell)' },
          ]}
        />

        {/* USDC P2P comparison charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ComparisonChart title="So sánh giá Mua USDC P2P (Buy)"  side="buy"  range={range} />
          <ComparisonChart title="So sánh giá Bán USDC P2P (Sell)" side="sell" range={range} />
        </div>
      </div>
    </section>
  );
};

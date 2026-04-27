import { BadgeCheck, Lock, Zap, Timer } from 'lucide-react';
import { SectionHeading } from './SectionHeading';

const FEATURES = [
  {
    title: '⚡ Lightning Fast',
    description: 'Automated trades settle in 3–30 seconds via Telegram bot. No waiting, no manual steps.',
    icon: Zap,
    iconBg: 'bg-blue-100 text-blue-600 border border-blue-200',
  },
  {
    title: '💰 Best Rates',
    description: 'Rates updated in real-time, fully transparent with no hidden fees. Always competitive.',
    icon: BadgeCheck,
    iconBg: 'bg-indigo-100 text-indigo-600 border border-indigo-200',
  },
  {
    title: '🔒 Non-Custodial',
    description: 'Your keys, your coins. Trades are atomic swaps — funds only move on confirmed settlement. All TXIDs are public on Stellar Explorer.',
    icon: Lock,
    iconBg: 'bg-blue-100 text-blue-600 border border-blue-200',
  },
  {
    title: '🕐 24/7 Support',
    description: 'Live Telegram support team always on standby to resolve any issue immediately.',
    icon: Timer,
    iconBg: 'bg-indigo-100 text-indigo-600 border border-indigo-200',
  },
];

export const FeaturesSection = () => {
  return (
    <section className="relative overflow-hidden bg-white py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="section-container">
        <SectionHeading
          id="features"
          eyebrow="Why Stellar Ramp?"
          title="Why traders choose StellarRamp"
          description="Automated, secure, and rate-optimized — built specifically for Vietnamese users trading XLM and USDC."
        />
        <div className="grid gap-8 md:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-8 transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl shadow-sm ${feature.iconBg}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

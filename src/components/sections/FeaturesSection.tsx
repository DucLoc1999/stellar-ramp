import { Zap, TrendingUp, Shield, Headset } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const FEATURES = [
  {
    title: "Lightning Fast Execution",
    description:
      "Automated matching engine settles VND directly to your bank in seconds.",
    icon: Zap,
    iconBg: "bg-blue-100 text-blue-600 border border-blue-200",
  },
  {
    title: "Best VND Exchange Rates",
    description:
      "We aggregate liquidity to guarantee the tightest spreads for XLM and USDC.",
    icon: TrendingUp,
    iconBg: "bg-indigo-100 text-indigo-600 border border-indigo-200",
  },
  {
    title: "Absolute Security",
    description:
      "Non-custodial design. You hold your keys, we handle the fiat routing.",
    icon: Shield,
    iconBg: "bg-blue-100 text-blue-600 border border-blue-200",
  },
  {
    title: "24/7 Local Support",
    description:
      "Dedicated Vietnamese support team available directly within Telegram.",
    icon: Headset,
    iconBg: "bg-indigo-100 text-indigo-600 border border-indigo-200",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="relative overflow-hidden bg-white py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="section-container">
        <SectionHeading
          id="features"
          eyebrow="WHY CHOOSE STELLAR RAMP?"
          title="Built for Vietnamese Traders"
        />
        <div className="grid gap-8 md:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-8 transition-shadow duration-300 hover:shadow-md"
              >
                <div
                  className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl shadow-sm ${feature.iconBg}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

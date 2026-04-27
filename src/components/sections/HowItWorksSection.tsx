import { ArrowRight } from 'lucide-react';
import { SectionHeading } from './SectionHeading';

const BOT_URL = 'https://t.me/stellarrampbot';

const STEPS = [
  {
    title: '📱 Open Telegram and find @StellarRampBot',
    description: '👉 Press "Start" to activate the bot and complete a quick KYC verification.',
  },
  {
    title: '💱 Choose Buy or Sell — confirm & receive',
    description: 'Select XLM or USDC, enter the amount, confirm the rate, and funds settle in seconds.',
  },
];

export const HowItWorksSection = () => {
  return (
    <section className="relative bg-slate-900 py-24 text-white overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvc3ZnPg==")`,
        }}
      />
      <div className="section-container relative z-10">
        <SectionHeading
          id="workflow"
          eyebrow="How It Works"
          title="Complete a trade in just 2 simple steps"
          description="Minimal friction, maximum security — everything happens inside the Stellar Ramp Telegram bot."
          light
        />
        <div className="grid gap-6 md:grid-cols-2">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="relative overflow-hidden rounded-3xl border-8 border-slate-950 bg-slate-800 shadow-2xl transition hover:scale-[1.01]"
            >
              <div className="p-8">
                <div className="text-sm font-extrabold uppercase tracking-[0.24em] text-blue-400">
                  Step {index + 1}
                </div>
                <h3 className="mt-3 text-xl font-bold text-white">{step.title}</h3>
                <p className="mt-3 text-sm text-slate-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary btn-primary-lg group rounded-full"
          >
            👉 Start Trading on Telegram
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
};

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SectionHeading } from './SectionHeading';

const FAQ_ITEMS = [
  {
    question: 'Is StellarRamp safe?',
    answer: 'Yes. All trades are non-custodial atomic swaps on the Stellar network. Your funds never leave your wallet until the trade is fully confirmed. All transaction IDs are publicly verifiable on Stellar Explorer.',
  },
  {
    question: 'How long does a trade take?',
    answer: 'Typically 3–30 seconds for XLM and USDC on Stellar. Bank transfers to VND may take 1–5 minutes depending on your bank. The bot notifies you immediately when the trade completes.',
  },
  {
    question: 'Are there trading limits?',
    answer: 'No hard limits for standard trades. For amounts above 100M VND, contact support directly for priority processing and better rates.',
  },
  {
    question: 'Which banks are supported?',
    answer: 'We support 30+ Vietnamese banks including Vietcombank, Techcombank, MB Bank, VPBank, ACB, BIDV, VietinBank, and more. Full list available in the bot.',
  },
  {
    question: 'What networks are supported?',
    answer: 'Currently Stellar (XLM, USDC) and BSC (USDC BEP20). Ethereum and Tron support is coming soon.',
  },
];

export const FaqSection = () => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="relative bg-white py-24">
      <div className="section-container">
        <SectionHeading
          id="faq"
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Still have questions? Message us directly in the bot or contact our support team."
        />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {FAQ_ITEMS.map((item, index) => (
            <div
              key={item.question}
              className={`border-slate-100 ${index < FAQ_ITEMS.length - 1 ? 'border-b' : ''}`}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-6 py-5 text-left text-base font-semibold text-slate-900 transition hover:text-blue-600 sm:text-lg"
                onClick={() => setOpen(open === index ? null : index)}
                aria-expanded={open === index}
              >
                {item.question}
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${open === index ? 'rotate-180' : ''}`}
                />
              </button>
              {open === index && (
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-sm text-slate-500 sm:text-base">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

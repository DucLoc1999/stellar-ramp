import { ChevronDown, Rocket } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const FAQ_ITEMS = [
  {
    question:
      "Is Stellar Ramp safe for non-custodial crypto trading and secure fiat routing for your bank account?",
    answer:
      "Absolutely. Stellar Ramp operates on a non-custodial model. We never hold your crypto assets. Smart contracts and automated matching engines ensure that fiat is routed securely and directly to your provided bank account.",
  },
  {
    question:
      "How long does a VND withdrawal take from Stellar Ramp, once your transaction is confirmed on-chain?",
    answer:
      "Thanks to our direct NAPAS integration, 99% of VND withdrawals are processed and settled to your domestic Vietnam bank account within 3 to 30 seconds after the blockchain transaction is confirmed.",
  },
  {
    question:
      "Are there trading limits for USDC, and how do verified accounts increase per-transaction caps quickly today?",
    answer:
      "Unverified accounts can trade up to $500 per day. By completing a quick basic verification within the bot, you can increase your limits up to $100,000 per transaction for institutional scale needs.",
  },
  {
    question:
      "Is the Telegram bot active during Vietnamese holidays, so you can on-ramp and off-ramp without delays?",
    answer:
      "Yes! Our system is fully automated and runs 24/7/365. You can on-ramp and off-ramp during Tet holidays, weekends, and in the middle of the night without any delays.",
  },
];

export const FaqSection = () => {
  return (
    <section className="relative bg-white pt-16 pb-24">
      <div className="section-container">
        <SectionHeading
          id="faq"
          eyebrow="FAQ"
          title="Frequently Asked Questions"
        />

        <div className="flex flex-col gap-20">
          <div className="mx-auto max-w-3xl space-y-4">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <summary className="flex cursor-pointer items-center justify-between p-6 text-left font-semibold text-slate-800 transition hover:text-blue-600">
                  {item.question}
                  <ChevronDown className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-slate-600">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>

          <div className="mx-auto max-w-3xl text-center bg-slate-50 p-10 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute right-4 top-4 opacity-10">
              <Rocket className="h-28 w-28 text-indigo-500" />
            </div>

            <span className="mb-4 inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-slate-700">
              ABOUT US
            </span>

            <h2 className="mb-6 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Stellar Ramp – The bridge to Web3
            </h2>

            <p className="relative z-10 mb-0 text-base leading-relaxed text-slate-600">
              We connect Web3 to Vietnam&apos;s finance with secure,
              non-custodial gateways that move fiat fast at rates.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

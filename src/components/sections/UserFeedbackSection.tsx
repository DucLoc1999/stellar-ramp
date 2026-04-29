import { Star } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatarLetter: string;
  avatarBgClass: string;
  avatarTextClass: string;
  avatarBorderClass: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Fastest VND withdrawals I've ever experienced. Sold 5k USDC and it was in my Vietcombank account in 12 seconds.",
    name: "Tuan N.",
    role: "Pro Trader",
    avatarLetter: "T",
    avatarBgClass: "bg-blue-100",
    avatarTextClass: "text-blue-700",
    avatarBorderClass: "border-blue-200",
  },
  {
    quote:
      "Using a Telegram bot makes it so convenient. I don't have to log into clunky exchanges just to off-ramp some XLM.",
    name: "Minh P.",
    role: "Web3 Developer",
    avatarLetter: "M",
    avatarBgClass: "bg-indigo-100",
    avatarTextClass: "text-indigo-700",
    avatarBorderClass: "border-indigo-200",
  },
  {
    quote:
      "The spread is incredibly tight compared to local P2P markets. Stellar Ramp is now my go-to for moving fiat.",
    name: "Hoang V.",
    role: "Arbitrageur",
    avatarLetter: "H",
    avatarBgClass: "bg-blue-100",
    avatarTextClass: "text-blue-700",
    avatarBorderClass: "border-blue-200",
  },
];

export const UserFeedbackSection = () => {
  return (
    <section className="relative bg-white pt-24 pb-10">
      <div className="section-container">
        <SectionHeading
          id="testimonials"
          eyebrow="USER FEEDBACK"
          title="Trusted by the OTC community"
        />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.quote}
              className="relative rounded-2xl border border-slate-100 bg-slate-50 p-8 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-1 text-sm text-yellow-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    className="h-4 w-4"
                    fill="currentColor"
                    stroke="currentColor"
                  />
                ))}
              </div>

              <p className="mb-6 text-slate-700 italic">"{t.quote}"</p>

              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-full border",
                    t.avatarBgClass,
                    t.avatarTextClass,
                    t.avatarBorderClass,
                    "font-bold",
                  ].join(" ")}
                >
                  {t.avatarLetter}
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mb-0 mt-6 h-1 w-24 rounded-full bg-slate-200" />
      </div>
    </section>
  );
};


import { ChevronDown, Rocket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionHeading } from "./SectionHeading";

export const FaqSection = () => {
  const { t } = useTranslation();

  const items = t("faq.items", { returnObjects: true }) as { question: string; answer: string }[];

  return (
    <section className="relative bg-white dark:bg-slate-900 pt-16 pb-24">
      <div className="section-container">
        <SectionHeading
          id="faq"
          eyebrow={t("faq.eyebrow")}
          title={t("faq.title")}
        />

        <div className="flex flex-col gap-20">
          <div className="mx-auto max-w-3xl space-y-4">
            {items.map((item) => (
              <details
                key={item.question}
                className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <summary className="flex cursor-pointer items-center justify-between p-6 text-left font-semibold text-slate-800 dark:text-slate-200 transition hover:text-blue-600 dark:hover:text-blue-400">
                  {item.question}
                  <ChevronDown className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-6 py-4 text-slate-600 dark:text-slate-400">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>

          <div className="mx-auto max-w-3xl text-center bg-slate-50 dark:bg-slate-800 p-10 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
            <div className="absolute right-4 top-4 opacity-10">
              <Rocket className="h-28 w-28 text-indigo-500" />
            </div>

            <span className="mb-4 inline-flex items-center rounded-full border border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              {t("faq.aboutUs")}
            </span>

            <h2 className="mb-6 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
              {t("faq.aboutTitle")}
            </h2>

            <p className="relative z-10 mb-0 text-base leading-relaxed text-slate-600 dark:text-slate-400">
              {t("faq.aboutDescription")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

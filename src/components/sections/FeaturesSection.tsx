import { Zap, TrendingUp, Shield, Headset } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionHeading } from "./SectionHeading";

const ICONS = [Zap, TrendingUp, Shield, Headset];
const ICON_BG = [
  "bg-blue-100 text-blue-600 border border-blue-200",
  "bg-indigo-100 text-indigo-600 border border-indigo-200",
  "bg-blue-100 text-blue-600 border border-blue-200",
  "bg-indigo-100 text-indigo-600 border border-indigo-200",
];

export const FeaturesSection = () => {
  const { t } = useTranslation();

  const features = (t("features.items", { returnObjects: true }) as { title: string; description: string }[]);

  return (
    <section className="relative overflow-hidden bg-white dark:bg-slate-900 py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-200 to-transparent" />
      <div className="section-container">
        <SectionHeading
          id="features"
          eyebrow={t("features.eyebrow")}
          title={t("features.title")}
        />
        <div className="grid gap-8 md:grid-cols-2">
          {features.map((feature, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-8 transition-shadow duration-300 hover:shadow-md"
              >
                <div
                  className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl shadow-sm ${ICON_BG[i]}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
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

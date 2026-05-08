import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionHeading } from "./SectionHeading";

const INITIALS = ["T", "D", "H", "L", "H", "N"];
const COLORS = [
  "bg-blue-100 text-blue-700 border border-blue-200",
  "bg-indigo-100 text-indigo-700 border border-indigo-200",
  "bg-blue-100 text-blue-700 border border-blue-200",
  "bg-indigo-100 text-indigo-700 border border-indigo-200",
  "bg-blue-100 text-blue-700 border border-blue-200",
  "bg-indigo-100 text-indigo-700 border border-indigo-200",
];

export const UserFeedbackSection = () => {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const feedbacks = t("feedback.items", { returnObjects: true }) as { quote: string; name: string; role: string }[];

  useEffect(() => {
    if (!emblaApi) return;
    setCurrent(emblaApi.selectedScrollSnap());
    emblaApi.on("select", () => setCurrent(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || isHovered) return;
    const id = setInterval(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollTo(0);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [emblaApi, isHovered]);

  return (
    <section className="relative overflow-hidden bg-white dark:bg-slate-900 py-24">
      <div className="section-container">
        <SectionHeading
          id="feedback"
          eyebrow={t("feedback.eyebrow")}
          title={t("feedback.title")}
          description={t("feedback.description")}
        />

        <div
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex -ml-2 md:-ml-4">
              {feedbacks.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="pl-2 md:pl-4 min-w-0 shrink-0 grow-0 basis-full md:basis-1/2 lg:basis-1/3"
                >
                  <figure className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-8 shadow-sm">
                    <div className="mb-4 flex items-center gap-1 text-sm text-yellow-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4" fill="currentColor" stroke="currentColor" />
                      ))}
                    </div>
                    <blockquote className="mb-6 text-slate-700 dark:text-slate-300 italic">
                      "{item.quote}"
                    </blockquote>
                    <figcaption className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${COLORS[index]}`}>
                        {INITIALS[index]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.role}</p>
                      </div>
                    </figcaption>
                  </figure>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute -left-4 top-1/2 -translate-y-1/2 hidden lg:flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            aria-label="Previous slide"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="absolute -right-4 top-1/2 -translate-y-1/2 hidden lg:flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            aria-label="Next slide"
          >
            <ArrowRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>

          <div className="mt-8 flex justify-center gap-2">
            {feedbacks.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`h-2 rounded-full transition-all ${
                  index === current
                    ? "w-8 bg-blue-600"
                    : "w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                }`}
                aria-label={`Go to feedback ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

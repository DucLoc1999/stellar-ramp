import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const LANGUAGES = [
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "vi", label: "VI", flag: "🇻🇳" },
];

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    document.documentElement.lang = code;
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[7rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {LANGUAGES.map((lang) => (
            <li key={lang.code} role="option" aria-selected={lang.code === i18n.language}>
              <button
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 ${
                  lang.code === i18n.language
                    ? "text-blue-600 bg-blue-50"
                    : "text-slate-700"
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

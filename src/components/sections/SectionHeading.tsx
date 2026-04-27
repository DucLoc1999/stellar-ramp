import type { ReactNode } from 'react';

type SectionHeadingProps = {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  light?: boolean;
};

export const SectionHeading = ({
  id,
  eyebrow,
  title,
  description,
  align = 'center',
  light = false,
}: SectionHeadingProps) => {
  return (
    <div
      id={id}
      className={`mx-auto flex max-w-3xl flex-col gap-4 ${
        align === 'center' ? 'items-center text-center' : 'items-start text-left'
      }`}
    >
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">
          {eyebrow}
        </span>
      ) : null}
      <h2 className={`text-3xl font-extrabold sm:text-4xl ${light ? 'text-white' : 'text-slate-900'}`}>
        {title}
      </h2>
      {description ? (
        <p className={`text-base sm:text-lg ${light ? 'text-slate-300' : 'text-slate-500'}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
};

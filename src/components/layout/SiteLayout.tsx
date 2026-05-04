import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { ScrollToTopButton } from '../ui/ScrollToTopButton';

export const SiteLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <SiteHeader />
      <main className="relative isolate flex-1">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(circle at top, rgba(37,99,235,0.06), rgba(248,250,252,0))' }}
        />
        {children}
      </main>
      <SiteFooter />
      <ScrollToTopButton />
    </div>
  );
};

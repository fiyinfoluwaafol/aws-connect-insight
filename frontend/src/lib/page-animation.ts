import { cn } from '@/lib/utils';

/** Subtle entrance animation for main page content (tailwindcss-animate) */
export const pageEnterClassName =
  'animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both';

export function pageShellClassName(className?: string) {
  return cn('container mx-auto px-6 py-8', pageEnterClassName, className);
}

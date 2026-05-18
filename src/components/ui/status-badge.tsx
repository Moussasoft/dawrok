import { cn } from '@/lib/utils';

const variants: Record<string, string> = {
  waiting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  called: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  in_progress: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  no_show: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

const labels: Record<string, string> = {
  waiting: 'En attente',
  called: 'Appelé',
  in_progress: 'En cours',
  done: 'Terminé',
  no_show: 'Absent',
  cancelled: 'Annulé',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[status] ?? 'bg-muted text-muted-foreground',
        className
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

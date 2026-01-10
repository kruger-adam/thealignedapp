import { cn } from '@/lib/utils';

interface StatBoxProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  className?: string;
  tooltip?: string;
}

export function StatBox({ label, value, icon: Icon, className, tooltip }: StatBoxProps) {
  return (
    <div className="text-center" title={tooltip}>
      <div className={cn('mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800', className)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}


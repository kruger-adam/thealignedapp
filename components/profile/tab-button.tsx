import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

export function TabButton({ active, onClick, icon: Icon, label }: TabButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={label}
      className={cn(
        'flex-1',
        active
          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

interface TabDescriptionProps {
  title: string;
  description: string;
}

export function TabDescription({ title, description }: TabDescriptionProps) {
  return (
    <div className="mb-4 text-center">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="text-xs text-zinc-500">{description}</p>
    </div>
  );
}


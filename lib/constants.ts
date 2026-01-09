import { Check, X as XIcon, HelpCircle } from 'lucide-react';
import { VoteType } from './types';

export const PAGE_SIZE = 5;

export const voteConfig: Record<VoteType, {
  icon: typeof Check;
  color: string;
  bg: string;
  label: string;
}> = {
  YES: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Yes' },
  NO: { icon: XIcon, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30', label: 'No' },
  UNSURE: { icon: HelpCircle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Not Sure' },
};


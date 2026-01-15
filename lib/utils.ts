import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// AI Model display configuration
export type AIModel = 
  | 'gemini-3-flash-preview'
  | 'gpt-4.1-mini'
  | 'gpt-4o-mini'
  | string; // Allow for future models

export interface ModelDisplayInfo {
  displayName: string;
  shortName: string;
  bgColor: string;
  textColor: string;
  borderColor?: string;
}

export function getModelDisplayInfo(model: AIModel | null | undefined): ModelDisplayInfo {
  if (!model) {
    // Default for unknown/legacy models
    return {
      displayName: 'AI',
      shortName: 'AI',
      bgColor: 'bg-zinc-100 dark:bg-zinc-800',
      textColor: 'text-zinc-700 dark:text-zinc-300',
    };
  }

  const modelLower = model.toLowerCase();

  // Gemini models
  if (modelLower.includes('gemini')) {
    if (modelLower.includes('3') && modelLower.includes('flash')) {
      return {
        displayName: 'Gemini 3 Flash',
        shortName: 'Gemini 3 Flash',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-400',
        borderColor: 'border-blue-200 dark:border-blue-800',
      };
    }
    // Generic Gemini
    return {
      displayName: 'Gemini',
      shortName: 'Gemini',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-700 dark:text-blue-400',
    };
  }

  // Claude/Anthropic models
  if (modelLower.includes('claude')) {
    if (modelLower.includes('opus') && modelLower.includes('4-5')) {
      return {
        displayName: 'Claude Opus 4.5',
        shortName: 'Opus 4.5',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        textColor: 'text-orange-700 dark:text-orange-400',
        borderColor: 'border-orange-200 dark:border-orange-800',
      };
    }
    if (modelLower.includes('opus')) {
      return {
        displayName: 'Claude Opus',
        shortName: 'Opus',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        textColor: 'text-orange-700 dark:text-orange-400',
      };
    }
    if (modelLower.includes('sonnet')) {
      return {
        displayName: 'Claude Sonnet',
        shortName: 'Sonnet',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        textColor: 'text-amber-700 dark:text-amber-400',
      };
    }
    if (modelLower.includes('haiku')) {
      return {
        displayName: 'Claude Haiku',
        shortName: 'Haiku',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        textColor: 'text-yellow-700 dark:text-yellow-400',
      };
    }
    // Generic Claude
    return {
      displayName: 'Claude',
      shortName: 'Claude',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      textColor: 'text-orange-700 dark:text-orange-400',
    };
  }

  // GPT models
  if (modelLower.includes('gpt')) {
    if (modelLower.includes('4.1') || modelLower.includes('4o')) {
      return {
        displayName: 'GPT-4.1 mini',
        shortName: 'GPT-4.1 mini',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400',
        borderColor: 'border-green-200 dark:border-green-800',
      };
    }
    if (modelLower.includes('4')) {
      return {
        displayName: 'GPT-4',
        shortName: 'GPT-4',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400',
      };
    }
    // Generic GPT
    return {
      displayName: 'GPT',
      shortName: 'GPT',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      textColor: 'text-green-700 dark:text-green-400',
    };
  }

  // Default for unknown models
  return {
    displayName: model,
    shortName: model.split('-')[0] || 'AI',
    bgColor: 'bg-zinc-100 dark:bg-zinc-800',
    textColor: 'text-zinc-700 dark:text-zinc-300',
  };
}



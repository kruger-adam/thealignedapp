'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductHuntBadgeProps {
  url?: string;
  variant?: 'badge' | 'banner' | 'compact';
  className?: string;
}

interface ProductHuntEmbedProps {
  productId?: string;
  className?: string;
}

export function ProductHuntBadge({ 
  url = 'https://www.producthunt.com/posts/aligned', 
  variant = 'badge',
  className 
}: ProductHuntBadgeProps) {
  const baseStyles = 'inline-flex items-center gap-2 font-medium transition-all hover:scale-105';
  
  if (variant === 'banner') {
    return (
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          baseStyles,
          'bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-full shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50',
          className
        )}
      >
        <span className="text-sm font-semibold">🚀 We&apos;re live on Product Hunt!</span>
        <ExternalLink className="h-4 w-4" />
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          baseStyles,
          'bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600',
          className
        )}
      >
        <span>PH</span>
        <ExternalLink className="h-3 w-3" />
      </Link>
    );
  }

  // Default badge variant
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        baseStyles,
        'bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg',
        className
      )}
    >
      <span className="text-sm font-semibold">🚀 Live on Product Hunt</span>
      <ExternalLink className="h-4 w-4" />
    </Link>
  );
}

/**
 * Product Hunt Embed Component
 * Use this to embed Product Hunt's official widget
 * Replace productId with your actual Product Hunt product ID
 */
export function ProductHuntEmbed({ 
  productId = 'aligned',
  className 
}: ProductHuntEmbedProps) {
  return (
    <div className={cn('w-full', className)}>
      <a
        href={`https://www.producthunt.com/posts/${productId}?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-${productId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=${productId}&theme=dark`}
          alt={`Aligned - Product Hunt`}
          width="250"
          height="54"
          className="mx-auto"
        />
      </a>
    </div>
  );
}


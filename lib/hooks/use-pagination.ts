import { useState, useMemo } from 'react';
import { PAGE_SIZE } from '@/lib/constants';

export function usePagination<T>(items: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(0);

  const { pageItems, startIdx, endIdx, totalPages, hasMore, hasPrev } = useMemo(() => {
    const start = page * pageSize;
    const end = Math.min(start + pageSize, items.length);
    const total = Math.ceil(items.length / pageSize);
    
    return {
      pageItems: items.slice(start, end),
      startIdx: start,
      endIdx: end,
      totalPages: total,
      hasMore: page < total - 1,
      hasPrev: page > 0,
    };
  }, [items, page, pageSize]);

  const nextPage = () => setPage(p => Math.min(p + 1, totalPages - 1));
  const prevPage = () => setPage(p => Math.max(p - 1, 0));
  const resetPage = () => setPage(0);

  return {
    page,
    pageItems,
    startIdx,
    endIdx,
    totalPages,
    totalItems: items.length,
    hasMore,
    hasPrev,
    nextPage,
    prevPage,
    resetPage,
    showPagination: items.length > pageSize,
  };
}


'use client';

import React from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { EmptyState, SkeletonTable } from './ui';

/**
 * DataTable
 * ---------
 * One table implementation for the whole console: client-side sorting,
 * pagination, an empty state and a loading skeleton.
 *
 * It is generic over the row type, and each column declares how to sort
 * itself (`sortValue`) separately from how to render itself (`render`).
 * That separation matters — sorting a "₹12.4 L" string lexically would
 * put ₹9 K above ₹12 L, so columns sort on the underlying number while
 * displaying the formatted text.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Rendered cell content. */
  render: (row: T) => React.ReactNode;
  /** Sort key; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  /** Hidden below the `md` breakpoint to keep narrow screens readable. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  initialSort?: { key: string; direction: 'asc' | 'desc' };
  /** Highlights the active row (e.g. the case open in a side panel). */
  activeKey?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 10,
  loading,
  onRowClick,
  emptyTitle = 'No records',
  emptyMessage,
  initialSort,
  activeKey,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState(initialSort ?? null);
  const [page, setPage] = React.useState(0);

  // Any change to the underlying rows (a filter, a new search term) must
  // reset pagination, otherwise the operator lands on an empty page 4.
  React.useEffect(() => setPage(0), [rows]);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;

    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'desc' };
      if (current.direction === 'desc') return { key, direction: 'asc' };
      return null; // third click clears the sort
    });
  };

  if (loading) return <SkeletonTable rows={pageSize} cols={Math.min(columns.length, 6)} />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} />;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    className={clsx(column.headerClassName, column.hideOnMobile && 'hidden md:table-cell')}
                    aria-sort={active ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {column.sortValue ? (
                      <button
                        onClick={() => toggleSort(column.key)}
                        className={clsx(
                          'inline-flex items-center gap-1 transition-colors hover:text-navy-900',
                          active && 'text-saffron-700',
                        )}
                      >
                        {column.header}
                        {active ? (
                          sort!.direction === 'asc' ? (
                            <ArrowUp size={11} />
                          ) : (
                            <ArrowDown size={11} />
                          )
                        ) : (
                          <ChevronsUpDown size={11} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    onRowClick && 'cursor-pointer',
                    activeKey === key && 'bg-saffron-500/10 hover:bg-saffron-500/15',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={clsx(column.className, column.hideOnMobile && 'hidden md:table-cell')}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5">
        <p className="text-[11px] text-slate-500">
          Showing {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy-900 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="px-2 font-mono text-[11px] text-slate-400">
            {safePage + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy-900 disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

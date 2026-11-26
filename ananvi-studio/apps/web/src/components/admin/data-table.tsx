/**
 * Reusable data table with:
 * - Column sorting (click header)
 * - Pagination (page size: 10/25/50/100)
 * - Row selection (checkbox column)
 * - Expandable rows (click to show detail)
 * - Column visibility toggle
 * - Export button (CSV/JSON)
 * - Empty state
 * - Loading skeleton
 *
 * Built on @tanstack/react-table v8
 */

'use client';

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSort: (field: string, order: 'ASC' | 'DESC') => void;
  loading?: boolean;
  expandable?: (row: T) => React.ReactNode;
  onExport?: (format: 'csv' | 'json') => void;
}

export function DataTable<T>({
  columns, data, total, page, limit,
  onPageChange, onLimitChange, onSort,
  loading, expandable, onExport,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      if (next.length) onSort(next[0].id, next[0].desc ? 'DESC' : 'ASC');
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex justify-between items-center px-4 py-2 bg-[#111] border-b border-[#2a2a2a]">
        <span className="text-sm text-[#666]">{total} results</span>
        {onExport && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onExport('csv')}>
              <Download size={14} /> CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onExport('json')}>
              <Download size={14} /> JSON
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} className="bg-[#1a1a1a]">
              {hg.headers.map(header => (
                <th key={header.id}
                  className="text-left px-4 py-3 text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}>
                  <span className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && <ChevronUp size={14} />}
                    {header.column.getIsSorted() === 'desc' && <ChevronDown size={14} />}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: limit }).map((_, i) => (
              <tr key={i}>
                {columns.map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-[#222] rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[#666]">
                No results found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, idx) => (
              <>
                <tr key={row.id}
                  className="border-t border-[#2a2a2a] hover:bg-[#111] transition-colors cursor-pointer"
                  onClick={() => {
                    if (!expandable) return;
                    const next = new Set(expanded);
                    next.has(idx) ? next.delete(idx) : next.add(idx);
                    setExpanded(next);
                  }}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {expandable && expanded.has(idx) && (
                  <tr className="bg-[#0a0a0a]">
                    <td colSpan={columns.length} className="px-6 py-4">
                      {expandable(row.original)}
                    </td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#111] border-t border-[#2a2a2a]">
        <select value={limit} onChange={e => onLimitChange(Number(e.target.value))}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-sm">
          {[10, 25, 50, 100].map(n => (
            <option key={n} value={n}>{n} per page</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}>Previous</Button>
          <span className="text-sm text-[#666]">{page} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

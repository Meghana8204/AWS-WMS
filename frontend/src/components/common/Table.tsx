import React from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
}

export function Table<T extends { id: string }>({ columns, data, isLoading, onRowClick }: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Syncing registry...</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                No records found in this partition.
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50/80' : ''}`}
              >
                {columns.map((col, idx) => (
                  <td key={idx} className="px-6 py-5 text-sm text-slate-600 font-medium">
                    {typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

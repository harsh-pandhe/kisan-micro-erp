import type { ReactNode } from 'react';
import './ReportTable.css';

interface ReportTableProps {
  caption: string;
  /** Column headers; first column is treated as the row label (left-aligned). */
  columns: string[];
  children: ReactNode;
}

/** Accessible, horizontally-scrollable table wrapper shared by every report view. */
export function ReportTable({ caption, columns, children }: ReportTableProps) {
  return (
    <div className="report-table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="report-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

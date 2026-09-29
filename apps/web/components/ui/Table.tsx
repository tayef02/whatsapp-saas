import { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

// আসল টেবিল ডাটা (কলাম/রো) দেখানোর জন্য — এই ৫টা একসাথে ব্যবহার হয়:
// <Table><TableHead><TableRow><TableHeaderCell>...</TableRow></TableHead>
// <TableBody><TableRow><TableCell>...</TableRow></TableBody></Table>
export function Table({ className = "", children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className={`w-full text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className = "", children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`border-b border-border bg-gray-50 ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className = "", children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-border ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className = "", children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-gray-50 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({ className = "", children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-text-muted uppercase ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className = "", children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-text ${className}`} {...props}>
      {children}
    </td>
  );
}

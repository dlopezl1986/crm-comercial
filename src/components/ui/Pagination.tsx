import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  return (
    <div className="pagination">
      <span className="muted small">{from.toLocaleString('es-ES')}–{to.toLocaleString('es-ES')} de {total.toLocaleString('es-ES')}</span>
      <button className="icon-btn" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
      <span className="small">{page + 1} / {pages}</span>
      <button className="icon-btn" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
    </div>
  );
}

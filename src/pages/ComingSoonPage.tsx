import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { NAV_ITEMS } from '@/app/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

/** Sección todavía no construida: indica en qué fase llegará (sin simular funcionalidad). */
export function ComingSoonPage() {
  const { pathname } = useLocation();
  const item = NAV_ITEMS.find((i) => i.path === pathname);
  return (
    <>
      <PageHeader title={item?.label ?? 'Sección'} />
      <div className="card">
        <EmptyState icon={Construction} title={`Disponible en la Fase ${item?.phase ?? '?'}`}>
          Esta sección se construirá en su fase correspondiente del plan de desarrollo.
        </EmptyState>
      </div>
    </>
  );
}

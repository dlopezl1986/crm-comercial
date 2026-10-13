import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/data/DataProvider';
import { num } from '@/lib/format';
import { ImportWizard } from './ImportWizard';
import { downloadExport, EXPORT_LABELS, type ExportEntity } from './exportData';

export function ImportExportPage() {
  const d = useData();
  const toast = useToast();
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const exp = async (e: ExportEntity, f: 'csv' | 'xlsx') => {
    try { await downloadExport(d, e, f); } catch (err) { console.error(err); toast('No se pudo exportar', 'error'); }
  };
  return (
    <>
      <PageHeader title="Importar / Exportar" />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'import', label: 'Importar' }, { id: 'export', label: 'Exportar' }]} />
      {tab === 'import' ? <ImportWizard /> : (
        <Card title="Exportar datos" icon={Download}>
          <table className="table">
            <tbody>
              {(Object.keys(EXPORT_LABELS) as ExportEntity[]).map((e) => (
                <tr key={e}>
                  <td className="strong">{EXPORT_LABELS[e]}</td>
                  <td className="muted">{num((d[e] as unknown[]).length)} registros</td>
                  <td style={{ textAlign: 'right' }} className="nowrap">
                    <button className="btn btn--secondary btn--sm" onClick={() => exp(e, 'csv')}>CSV</button>{' '}
                    <button className="btn btn--secondary btn--sm" onClick={() => exp(e, 'xlsx')}>Excel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

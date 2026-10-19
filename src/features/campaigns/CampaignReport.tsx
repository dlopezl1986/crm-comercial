import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { Card } from '@/components/ui/Card';
import { EMAIL_STATUS, emailStatusOf, type EmailStatusOrNone } from '@/domain/emailStatus';
import { formatDate } from '@/lib/dates';
import { num } from '@/lib/format';
import type { Campaign } from '@/types/models';

const ORDER: EmailStatusOrNone[] = ['sent', 'delivered', 'replied', 'bounced', 'error', 'optout'];

/** Resultado de una campaña: empresas enviadas desglosadas por estado del email. */
export function CampaignReport({ campaign: c }: { campaign: Campaign }) {
  const { companies } = useData();
  const sent = useMemo(() => companies.filter((co) => co.campaignIds?.includes(c.id)), [companies, c.id]);
  const by = useMemo(() => {
    const m = new Map<EmailStatusOrNone, number>();
    sent.forEach((co) => { const s = emailStatusOf(co); m.set(s, (m.get(s) ?? 0) + 1); });
    return m;
  }, [sent]);
  if (!sent.length) return null;
  const pct = (n: number) => `${Math.round((n / sent.length) * 100)} %`;

  const download = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(sent.map((co) => ({
      Empresa: co.name, Email: co.email ?? '', Estado: EMAIL_STATUS[emailStatusOf(co)].label, Comentario: co.emailNote ?? '',
      'Fecha envío': co.emailSentAt ? formatDate(co.emailSentAt) : '', Sector: co.sector ?? '', Subsector: co.subsector ?? '', Teléfono: co.phone ?? '', Ciudad: co.city ?? '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultado');
    XLSX.writeFile(wb, `Resultado_${c.name.replace(/\W+/g, '_')}.xlsx`);
  };

  return (
    <Card title={`Resultado de la campaña · ${num(sent.length)} enviados`} actions={<button className="btn btn--ghost btn--sm" onClick={download}><Download size={14} /> Excel</button>}>
      <div className="result-bars">
        {ORDER.filter((s) => by.get(s)).map((s) => (
          <div key={s} className="result-bar">
            <span className="result-bar__label"><span className="dot" style={{ background: EMAIL_STATUS[s].color }} />{EMAIL_STATUS[s].label}</span>
            <span className="result-bar__track"><span style={{ width: pct(by.get(s)!), background: EMAIL_STATUS[s].color }} /></span>
            <span className="result-bar__value">{num(by.get(s)!)} · {pct(by.get(s)!)}</span>
          </div>
        ))}
      </div>
      <p className="muted small">"Pendiente de confirmar" pasa a "Recibido, sin respuesta" a los 3 días del envío si no ha llegado un rebote.</p>
    </Card>
  );
}

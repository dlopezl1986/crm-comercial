import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, ClipboardCopy, Download, Mail, Pencil, Plus, Send } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FullScreenLoader, Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { usePersistentState } from '@/hooks/usePersistentState';
import { formatDateTime } from '@/lib/dates';
import { num } from '@/lib/format';
import type { Campaign } from '@/types/models';
import { batchEmails, campaignStatus, emailHtml, markBatchSent, markOptOuts } from './campaignLogic';
import { CampaignForm } from './CampaignForm';

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function CampaignsPage() {
  const d = useData();
  const [selectedId, setSelectedId] = usePersistentState<string>('campaigns.selected', '');
  const [creating, setCreating] = useState(false);
  if (!d.ready) return <FullScreenLoader />;
  const campaign = d.campaigns.find((c) => c.id === selectedId) ?? d.campaigns[0];

  return (
    <>
      <PageHeader title="Campañas de email" subtitle="Envío por lotes desde tu Outlook con Power Automate"
        actions={<button className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva campaña</button>} />
      {d.campaigns.length > 1 && (
        <div className="toolbar">
          <select className="filter-select filter-select--on" value={campaign?.id} onChange={(e) => setSelectedId(e.target.value)}>
            {d.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {campaign ? <CampaignDetail campaign={campaign} /> : (
        <div className="card"><EmptyState icon={Mail} title="Aún no hay campañas">Crea una campaña, elige a quién va y envíala por lotes.</EmptyState></div>
      )}
      {creating && <CampaignForm onClose={() => setCreating(false)} onSaved={setSelectedId} />}
    </>
  );
}

function CampaignDetail({ campaign: c }: { campaign: Campaign }) {
  const d = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [optOutText, setOptOutText] = useState('');
  const [busy, setBusy] = useState(false);
  const st = useMemo(() => campaignStatus(d, c), [d, c]);
  const emails = batchEmails(st.nextBatch);
  const html = emailHtml(c);
  const pct = st.eligible ? Math.round((st.sent.length / st.eligible) * 100) : 0;

  const download = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(st.nextBatch.map((co) => ({ Email: co.email, Empresa: co.name, Sector: co.sector ?? '', Ciudad: co.city ?? '' })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lote');
    XLSX.writeFile(wb, `Lote_${c.name.replace(/\W+/g, '_')}_${c.sentCount + 1}.xlsx`);
  };

  const optOut = async () => {
    setBusy(true);
    try {
      const r = await markOptOuts(orgId, d, optOutText);
      toast(`${num(r.companies)} empresas dadas de baja`);
      if (r.notFound.length) toast(`No encontrados en el CRM: ${r.notFound.slice(0, 5).join(', ')}${r.notFound.length > 5 ? '…' : ''}`, 'error');
      setOptOutText('');
    } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <div className="kpis kpis--4">
        <div className="kpi"><div className="kpi__label">Destinatarios del segmento</div><div className="kpi__value">{num(st.eligible)}</div><div className="kpi__sub">{c.segmentTags.join(', ') || 'Todas las empresas'}{c.segmentSector ? ` · ${c.segmentSector}` : ''}</div></div>
        <div className="kpi"><div className="kpi__label">Enviados</div><div className="kpi__value">{num(st.sent.length)}</div><div className="kpi__sub">{pct} % · último lote {c.lastBatchAt ? formatDateTime(c.lastBatchAt) : '—'}</div></div>
        <div className="kpi"><div className="kpi__label">Pendientes</div><div className="kpi__value">{num(st.pending.length)}</div><div className="kpi__sub">≈ {Math.ceil(st.pending.length / c.batchSize)} lotes de {c.batchSize}</div></div>
        <div className="kpi"><div className="kpi__label">Bajas</div><div className="kpi__value">{num(st.optOuts)}</div><div className="kpi__sub">nunca reciben campañas</div></div>
      </div>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>

      <div className="detail-grid">
        <div className="detail-main">
          <Card title={`Siguiente lote · ${num(emails.length)} emails`} icon={Send} subtitle={st.nextBatch.length !== emails.length ? `${num(st.nextBatch.length)} empresas (algunas comparten email)` : undefined}>
            {emails.length === 0 ? <p className="muted">No quedan destinatarios pendientes en esta campaña.</p> : (
              <>
                <ol className="steps">
                  <li><strong>Copia los emails del lote</strong> y pégalos en el campo "Emails" de tu flujo de Power Automate "Enviar campaña".
                    <div className="inline" style={{ marginTop: 6 }}>
                      <button className="btn btn--primary btn--sm" onClick={async () => toast(await copy(emails.join(';')) ? `${emails.length} emails copiados` : 'No se pudo copiar', 'success')}><ClipboardCopy size={14} /> Copiar {emails.length} emails</button>
                      <button className="btn btn--secondary btn--sm" onClick={download}><Download size={14} /> Descargar lote (Excel)</button>
                    </div>
                  </li>
                  <li><strong>Ejecuta el flujo</strong> y espera a que termine (≈ {Math.ceil((emails.length * 5) / 60)} min con 5 s entre emails).</li>
                  <li><strong>Marca el lote como enviado</strong> para que no se repita:
                    <div style={{ marginTop: 6 }}><button className="btn btn--success btn--sm" onClick={() => setConfirming(true)}><CheckCircle2 size={14} /> Marcar {num(st.nextBatch.length)} como enviadas</button></div>
                  </li>
                </ol>
                <details className="batch-list"><summary className="small">Ver empresas del lote</summary>
                  <ul>{st.nextBatch.map((co) => <li key={co.id}>{co.name} <span className="muted">· {co.email}</span></li>)}</ul>
                </details>
              </>
            )}
          </Card>

          <Card title="Vista previa del email" icon={Mail} actions={<button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}><Pencil size={14} /> Editar</button>}>
            <div className="small"><strong>Asunto:</strong> {c.subject}</div>
            <div className="email-preview" dangerouslySetInnerHTML={{ __html: html }} />
            <button className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={async () => toast(await copy(html) ? 'HTML copiado' : 'No se pudo copiar')}><ClipboardCopy size={14} /> Copiar HTML del email</button>
          </Card>
        </div>

        <div className="detail-side">
          <Card title="Bajas" icon={Ban}>
            <p className="muted small">Pega aquí los emails de quienes respondan BAJA (uno por línea o separados por ;). No volverán a recibir campañas.</p>
            <textarea className="textarea" rows={4} value={optOutText} onChange={(e) => setOptOutText(e.target.value)} placeholder="info@empresa.com" />
            <button className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} disabled={busy || !optOutText.trim()} onClick={optOut}>{busy ? <Spinner size={14} /> : 'Dar de baja'}</button>
          </Card>
          <Card title="Configurar Power Automate (una vez)">
            <ol className="steps small">
              <li>Entra en <a href="https://make.powerautomate.com" target="_blank" rel="noreferrer">make.powerautomate.com</a> con serviciosprofesionales@syscomputers.com → <strong>Crear → Flujo de nube instantáneo</strong> → "Desencadenar un flujo manualmente". Nombre: <em>Enviar campaña</em>.</li>
              <li>En el desencadenador, <strong>Agregar una entrada → Texto</strong> y llámala <em>Emails</em>.</li>
              <li>Añade <strong>Aplicar a cada uno</strong> (Control). En "Seleccionar una salida" pon la expresión: <code>split(triggerBody()?['text'], ';')</code></li>
              <li>Dentro, añade <strong>Office 365 Outlook → Enviar un correo electrónico (V2)</strong>: Para = expresión <code>item()</code>; Asunto = el de la campaña; en Cuerpo pulsa <strong>&lt;/&gt;</strong> y pega el HTML copiado. Importancia: Normal.</li>
              <li>Dentro del bucle, debajo del correo, añade <strong>Retraso</strong> de 5 segundos (Outlook admite unos 30 emails por minuto).</li>
              <li>En la configuración de "Aplicar a cada uno", deja la <strong>simultaneidad desactivada</strong>. Guarda.</li>
              <li>Antes del primer lote, prueba el flujo con tu propio email.</li>
            </ol>
          </Card>
        </div>
      </div>

      {editing && <CampaignForm campaign={c} onClose={() => setEditing(false)} />}
      {confirming && (
        <ConfirmDialog title="Marcar lote como enviado" confirmLabel="Marcar como enviadas" onClose={() => setConfirming(false)}
          onConfirm={async () => { const n = await markBatchSent(orgId, uid, d, c, st.nextBatch); toast(`${num(n)} empresas marcadas como enviadas`); }}>
          ¿Ya has enviado el lote con Power Automate? Se registrará un email en el historial de {num(st.nextBatch.length)} empresas y no volverán a salir en esta campaña.
        </ConfirmDialog>
      )}
    </div>
  );
}

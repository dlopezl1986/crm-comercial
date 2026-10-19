import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, ClipboardCopy, Download, Mail, MailX, Pencil, Plus, Send, Trash2 } from 'lucide-react';
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
import { deleteItem, updateItem } from '@/services/repository';
import { num } from '@/lib/format';
import type { Campaign } from '@/types/models';
import { batchEmails, campaignStatus, emailHtml, markBatchSent, markOptOuts, segmentLabel } from './campaignLogic';
import { CampaignForm } from './CampaignForm';
import { RegroupBanner } from '@/features/settings/RegroupSectors';

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
      <PageHeader title="Campañas de email" subtitle="Envío por lotes desde servicios.profesionales@syscomputers.es con Power Automate"
        actions={<button className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva campaña</button>} />
      <RegroupBanner />
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
  const [removing, setRemoving] = useState(false);
  const [optOutText, setOptOutText] = useState('');
  const [bounceText, setBounceText] = useState('');
  const [busy, setBusy] = useState(false);
  const st = useMemo(() => campaignStatus(d, c), [d, c]);
  const emails = batchEmails(st.nextBatch);
  const html = emailHtml(c);
  const pct = st.eligible ? Math.round((st.sent.length / st.eligible) * 100) : 0;

  const download = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(st.nextBatch.map((co) => ({ Email: co.email, Empresa: co.name, Sector: co.sector ?? '', Subsector: co.subsector ?? '', Ciudad: co.city ?? '' })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lote');
    XLSX.writeFile(wb, `Lote_${c.name.replace(/\W+/g, '_')}_${c.sentCount + 1}.xlsx`);
  };

  const mark = async (status: 'optout' | 'bounced') => {
    setBusy(true);
    try {
      const r = await markOptOuts(orgId, d, status === 'optout' ? optOutText : bounceText, status);
      toast(`${num(r.companies)} empresas marcadas como ${status === 'optout' ? 'baja' : 'email incorrecto'}`);
      if (r.notFound.length) toast(`No encontrados en el CRM: ${r.notFound.slice(0, 5).join(', ')}${r.notFound.length > 5 ? '…' : ''}`, 'error');
      if (status === 'optout') setOptOutText(''); else setBounceText('');
    } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <div className="campaign-head">
        <h2>{c.name}</h2>
        <button className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}><Pencil size={14} /> Editar</button>
        <button className="btn btn--ghost btn--sm danger" onClick={() => setRemoving(true)}><Trash2 size={14} /> Eliminar campaña</button>
      </div>
      <div className="kpis kpis--4">
        <div className="kpi"><div className="kpi__label">Destinatarios del segmento</div><div className="kpi__value">{num(st.eligible)}</div><div className="kpi__sub">{segmentLabel(c)}</div></div>
        <div className="kpi"><div className="kpi__label">Enviados</div><div className="kpi__value">{num(st.sent.length)}</div><div className="kpi__sub">{pct} % · último lote {c.lastBatchAt ? formatDateTime(c.lastBatchAt) : '—'}</div></div>
        <div className="kpi"><div className="kpi__label">Pendientes</div><div className="kpi__value">{num(st.pending.length)}</div><div className="kpi__sub">≈ {Math.ceil(st.pending.length / c.batchSize)} lotes de {c.batchSize}</div></div>
        <div className="kpi"><div className="kpi__label">Excluidas</div><div className="kpi__value">{num(st.optOuts)}</div><div className="kpi__sub">bajas, rebotes y errores</div></div>
      </div>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>

      <div className="detail-grid">
        <div className="detail-main">
          <Card title={`Siguiente lote · ${num(emails.length)} emails`} icon={Send} subtitle={st.nextBatch.length !== emails.length ? `${num(st.nextBatch.length)} empresas (algunas comparten email)` : undefined}>
            {st.pending.length > 0 && <BatchSizeControl campaign={c} />}
            {emails.length === 0 ? <p className="muted">No quedan destinatarios pendientes en esta campaña.</p> : (
              <>
                <ol className="steps">
                  <li><strong>Abre el flujo "Enviar campaña"</strong> en <a href="https://make.powerautomate.com" target="_blank" rel="noreferrer">Power Automate</a> → Ejecutar. Pega en cada campo:
                    <div className="inline" style={{ marginTop: 6 }}>
                      <button className="btn btn--primary btn--sm" onClick={async () => toast(await copy(emails.join(';')) ? `${emails.length} emails copiados → campo "Emails"` : 'No se pudo copiar', 'success')}><ClipboardCopy size={14} /> 1 · Emails ({emails.length})</button>
                      <button className="btn btn--primary btn--sm" onClick={async () => toast(await copy(c.subject) ? 'Asunto copiado → campo "Asunto"' : 'No se pudo copiar')}><ClipboardCopy size={14} /> 2 · Asunto</button>
                      <button className="btn btn--primary btn--sm" onClick={async () => toast(await copy(html) ? 'HTML copiado → campo "Cuerpo"' : 'No se pudo copiar')}><ClipboardCopy size={14} /> 3 · Cuerpo</button>
                      <button className="btn btn--secondary btn--sm" onClick={download}><Download size={14} /> Lote en Excel</button>
                    </div>
                  </li>
                  <li><strong>Ejecuta el flujo</strong> y espera a que termine (≈ {Math.ceil((emails.length * 5) / 60)} min con 5 s entre emails). Puedes ver el progreso en el historial de ejecuciones del flujo.</li>
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
          </Card>
        </div>

        <div className="detail-side">
          <Card title="Bajas" icon={Ban}>
            <p className="muted small">Pega aquí los emails de quienes respondan BAJA (uno por línea o separados por ;). No volverán a recibir campañas.</p>
            <textarea className="textarea" rows={4} value={optOutText} onChange={(e) => setOptOutText(e.target.value)} placeholder="info@empresa.com" />
            <button className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} disabled={busy || !optOutText.trim()} onClick={() => mark('optout')}>{busy ? <Spinner size={14} /> : 'Dar de baja'}</button>
          </Card>
          <Card title="Rebotes / emails incorrectos" icon={MailX}>
            <p className="muted small">Pega las direcciones de los avisos de "no se pudo entregar" (puedes pegar el texto del aviso entero: se detectan los emails). Quedan como <strong>Email incorrecto</strong> y salen de las campañas.</p>
            <textarea className="textarea" rows={4} value={bounceText} onChange={(e) => setBounceText(e.target.value)} placeholder="info@empresa-que-rebota.com" />
            <button className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} disabled={busy || !bounceText.trim()} onClick={() => mark('bounced')}>{busy ? <Spinner size={14} /> : 'Marcar como incorrectos'}</button>
          </Card>
          <Card title="Flujo de Power Automate">
            <p className="muted small">El flujo <strong>"Enviar campaña"</strong> ya está creado en tu cuenta (servicios.profesionales@syscomputers.es):
              recibe Emails, Asunto y Cuerpo, envía un correo individual a cada dirección y espera 5 s entre envíos.</p>
            <p className="muted small">Antes del primer lote, ejecútalo con tu propio email en el campo "Emails" para ver cómo llega.</p>
          </Card>
        </div>
      </div>

      {editing && <CampaignForm campaign={c} onClose={() => setEditing(false)} />}
      {removing && (
        <ConfirmDialog title="Eliminar campaña" danger confirmLabel="Eliminar" onClose={() => setRemoving(false)}
          onConfirm={async () => { await deleteItem(orgId, 'campaigns', c.id); toast('Campaña eliminada'); }}>
          ¿Eliminar <strong>{c.name}</strong>? Las {num(st.sent.length)} empresas a las que ya se envió siguen marcadas como contactadas
          (conservan su estado y el email en el historial), así que no volverán a recibir otra campaña por error.
        </ConfirmDialog>
      )}
      {confirming && (
        <ConfirmDialog title="Marcar lote como enviado" confirmLabel="Marcar como enviadas" onClose={() => setConfirming(false)}
          onConfirm={async () => { const n = await markBatchSent(orgId, uid, d, c, st.nextBatch); toast(`${num(n)} empresas marcadas como enviadas`); }}>
          ¿Ya has enviado el lote con Power Automate? Se registrará un email en el historial de {num(st.nextBatch.length)} empresas y no volverán a salir en esta campaña.
        </ConfirmDialog>
      )}
    </div>
  );
}

export const MAX_BATCH = 1000;
const PRESETS = [25, 50, 100, 200, 300, 500];

/** Tamaño del siguiente lote: se puede cambiar antes de cada envío (se guarda en la campaña). */
function BatchSizeControl({ campaign: c }: { campaign: Campaign }) {
  const { orgId } = useSession();
  const [custom, setCustom] = useState(String(c.batchSize));
  useEffect(() => setCustom(String(c.batchSize)), [c.batchSize]);
  const save = (n: number) => {
    const v = Math.max(1, Math.min(MAX_BATCH, Math.round(n) || c.batchSize));
    if (v !== c.batchSize) updateItem<Campaign>(orgId, 'campaigns', c.id, { batchSize: v });
    setCustom(String(v));
  };
  return (
    <div className="batch-size">
      <span className="small strong">Emails en este lote:</span>
      <div className="chips">
        {PRESETS.map((n) => (
          <button key={n} type="button" className={`chip ${c.batchSize === n ? 'chip--on' : ''}`} onClick={() => save(n)}>{n}</button>
        ))}
        <input className="batch-size__input" type="number" min={1} max={MAX_BATCH} value={custom} aria-label="Número de emails del lote"
          onChange={(e) => setCustom(e.target.value)} onBlur={(e) => save(Number(e.currentTarget.value))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      </div>
      <span className="muted small">≈ {Math.ceil((c.batchSize * 5) / 60)} min de envío</span>
    </div>
  );
}

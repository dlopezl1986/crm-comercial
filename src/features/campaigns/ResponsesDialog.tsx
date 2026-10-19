import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth, useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { num } from '@/lib/format';
import { applyMails, MAIL_KIND, matchMails, readMailFile, type MailKind, type MailMatch, type MailRow } from './responses';

/** Sube el Excel del flujo "Registrar respuestas", muestra la clasificación y la aplica. */
export function ResponsesDialog({ onClose }: { onClose: () => void }) {
  const d = useData();
  const { user } = useAuth();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [rows, setRows] = useState<MailRow[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, MailKind>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const own = useMemo(() => [user?.email ?? '', 'servicios.profesionales@syscomputers.es', 'serviciosprofesionales@syscomputers.com'], [user?.email]);
  const matches = useMemo<MailMatch[]>(() => {
    if (!rows) return [];
    return matchMails(d, rows, own).map((m) => (overrides[m.key] ? { ...m, kind: overrides[m.key] } : m));
  }, [rows, d, own, overrides]);
  const processed = useMemo(() => new Set(d.activities.map((a) => (a as { externalId?: string }).externalId).filter(Boolean)), [d.activities]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { bounce: 0, optout: 0, autoreply: 0, reply: 0, unmatched: 0, already: 0 };
    matches.forEach((m) => { if (!m.company) c.unmatched++; else if (processed.has(m.key)) c.already++; else c[m.kind]++; });
    return c;
  }, [matches, processed]);

  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy('Leyendo…');
    try { setRows(await readMailFile(f)); setFileName(f.name); }
    catch (e) { console.error(e); toast('No se pudo leer el archivo', 'error'); }
    finally { setBusy(null); }
  };
  const apply = async () => {
    setBusy('Aplicando…');
    try {
      const r = await applyMails(orgId, uid, d, matches);
      toast(`${num(r.companies)} empresas actualizadas`);
      onClose();
    } catch (e) { console.error(e); toast('No se pudo aplicar', 'error'); setBusy(null); }
  };
  const pending = matches.filter((m) => m.company && !processed.has(m.key)).length;

  return (
    <Modal title="Procesar respuestas del buzón" onClose={onClose} width={980} footer={rows && (
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={!!busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={apply} disabled={!!busy || !pending}>{busy ? <><Spinner size={16} /> {busy}</> : `Aplicar a ${num(pending)} correos`}</button>
      </>
    )}>
      {!rows ? (
        <label className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
          {busy ? <Spinner size={24} /> : null}
          <strong>Sube el Excel "Respuestas_campañas" de tu OneDrive</strong>
          <span className="muted small">Columnas: Fecha, De, Asunto, Texto. Puedes subir el mismo archivo cada día: lo ya procesado se omite.</span>
          <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      ) : (
        <div className="stack">
          <div className="muted small">{fileName} · {num(rows.length)} correos</div>
          <div className="kpis kpis--4">
            <div className="kpi"><div className="kpi__label">Rebotes / no existe</div><div className="kpi__value">{num(counts.bounce)}</div></div>
            <div className="kpi"><div className="kpi__label">Respuestas</div><div className="kpi__value">{num(counts.reply)}</div><div className="kpi__sub">{num(counts.optout)} bajas · {num(counts.autoreply)} automáticas</div></div>
            <div className="kpi"><div className="kpi__label">Sin empresa en el CRM</div><div className="kpi__value">{num(counts.unmatched)}</div></div>
            <div className="kpi"><div className="kpi__label">Ya procesados antes</div><div className="kpi__value">{num(counts.already)}</div></div>
          </div>
          <p className="muted small">Revisa el tipo detectado; puedes cambiarlo antes de aplicar.</p>
          <div className="table-scroll table-scroll--tall">
            <table className="table table--compact">
              <thead><tr><th>Fecha</th><th>De</th><th>Asunto</th><th>Tipo</th><th>Empresa</th></tr></thead>
              <tbody>
                {matches.slice(0, 500).map((m) => (
                  <tr key={m.key} className={!m.company || processed.has(m.key) ? 'row--muted' : ''}>
                    <td className="nowrap">{m.row.date}</td>
                    <td className="truncate">{m.row.from}</td>
                    <td className="truncate">{m.row.subject}</td>
                    <td>
                      <select className="email-status__select" value={m.kind} style={{ color: MAIL_KIND[m.kind].color }}
                        onChange={(e) => setOverrides((o) => ({ ...o, [m.key]: e.target.value as MailKind }))}>
                        {(Object.keys(MAIL_KIND) as MailKind[]).map((k) => <option key={k} value={k}>{MAIL_KIND[k].label}</option>)}
                      </select>
                    </td>
                    <td>{m.company
                      ? <><Link to={`/empresas/${m.company.id}`} target="_blank">{m.company.name}</Link><div className="muted small">{m.matchedEmail}{m.by === 'dominio' ? ' (por dominio)' : ''}{processed.has(m.key) ? ' · ya procesado' : ''}</div></>
                      : <span className="muted small">{m.kind === 'bounce' ? 'No se encontró la dirección en el CRM' : `${m.matchedEmail ?? '—'} no está en el CRM`}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

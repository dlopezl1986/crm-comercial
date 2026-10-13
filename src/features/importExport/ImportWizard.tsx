import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import type { WorkBook } from 'xlsx';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { TagInput } from '@/components/form/TagInput';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { num } from '@/lib/format';
import { FIELDS, guessMapping, isFormsExport, mapRows, planCompanies, readWorkbook, sheetRows, type DupAction, type Mapping, type PlannedCompany, type Row } from './importEngine';
import { executeImport, type ImportResult } from './executeImport';

type Step = 'file' | 'map' | 'review' | 'done';
const ACTIONS: Record<DupAction, string> = { merge: 'Fusionar', ignore: 'Ignorar', create: 'Crear igualmente' };

export function ImportWizard() {
  const d = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [step, setStep] = useState<Step>('file');
  const [file, setFile] = useState<File | null>(null);
  const [wb, setWb] = useState<WorkBook | null>(null);
  const [sheet, setSheet] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [plan, setPlan] = useState<PlannedCompany[]>([]);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [createLeads, setCreateLeads] = useState(false);
  const [formsMode, setFormsMode] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSheet = async (w: WorkBook, name: string) => {
    const { headers: h, rows: r } = await sheetRows(w, name);
    setSheet(name); setHeaders(h); setRows(r); setMapping(guessMapping(h));
    // Respuestas de Microsoft Forms: solicitudes entrantes → leads para llamar hoy.
    const forms = isFormsExport(h);
    setFormsMode(forms);
    if (forms) { setCreateLeads(true); setExtraTags((t) => (t.includes('Solicitud formulario') ? t : [...t, 'Solicitud formulario'])); setSource('Formulario web'); }
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null); setBusy('Analizando archivo…');
    try {
      const w = await readWorkbook(f);
      setFile(f); setWb(w); setSource(f.name.replace(/\.[^.]+$/, '')); setExtraTags([]); setCreateLeads(false);
      // Por defecto, la hoja con más filas.
      const XLSX = await import('xlsx');
      const best = w.SheetNames.map((n) => ({ n, c: XLSX.utils.decode_range(w.Sheets[n]['!ref'] ?? 'A1').e.r })).sort((a, b) => b.c - a.c)[0].n;
      await loadSheet(w, best);
      setStep('map');
    } catch (e) { console.error(e); setError('No se pudo leer el archivo. Usa CSV o Excel (.xlsx/.xls).'); }
    finally { setBusy(null); }
  };

  const records = useMemo(() => mapRows(rows, mapping), [rows, mapping]);
  const hasCompany = Object.values(mapping).includes('company.name');
  const hasContact = Object.values(mapping).some((v) => v === 'contact.fullName' || v === 'contact.firstName');

  const review = () => { setPlan(planCompanies(records, d.companies)); setStep('review'); };
  const dups = plan.filter((p) => p.existing);
  const setAction = (p: PlannedCompany, a: DupAction) => setPlan((xs) => xs.map((x) => (x === p ? { ...x, action: a } : x)));
  const setAllActions = (a: DupAction) => setPlan((xs) => xs.map((x) => (x.existing ? { ...x, action: a } : x)));
  const inFileRepeats = records.filter((r) => r.company.name).length - plan.length;
  const counts = {
    create: plan.filter((p) => !p.existing || p.action === 'create').length,
    merge: plan.filter((p) => p.existing && p.action === 'merge').length,
    ignore: plan.filter((p) => p.existing && p.action === 'ignore').length,
    contacts: plan.filter((p) => !(p.existing && p.action === 'ignore')).reduce((s, p) => s + p.rows.filter((r) => r.contact.firstName).length, 0),
  };

  const run = async () => {
    setBusy('Importando…');
    try {
      const r = await executeImport(orgId, uid, plan, d, {
        fileName: file?.name ?? 'archivo', source: source.trim() || 'Importación', extraTags, createLeads,
        leadsForExisting: formsMode, leadNextStep: formsMode ? 'Llamar al cliente' : undefined,
      }, setBusy);
      setResult(r); setStep('done'); toast('Importación completada');
    } catch (e) {
      console.error(e);
      setError('La importación se ha interrumpido. Lo ya importado se puede deshacer en Configuración › Datos.');
    } finally { setBusy(null); }
  };

  const reset = () => { setStep('file'); setFile(null); setWb(null); setRows([]); setPlan([]); setResult(null); setError(null); };

  return (
    <div className="stack">
      <ol className="wizard-steps">
        {(['file', 'map', 'review', 'done'] as Step[]).map((s, i) => (
          <li key={s} className={step === s ? 'active' : ''}>{i + 1}. {{ file: 'Archivo', map: 'Columnas', review: 'Revisión y duplicados', done: 'Resultado' }[s]}</li>
        ))}
      </ol>
      {error && <div className="alert alert--error">{error}</div>}

      {step === 'file' && (
        <Card title="Selecciona un archivo CSV o Excel" icon={FileSpreadsheet}>
          <label className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
            {busy ? <Spinner size={24} /> : <Upload size={24} />}
            <strong>{busy ?? 'Arrastra el archivo aquí o haz clic para elegirlo'}</strong>
            <span className="muted small">Columnas típicas: Empresa, Contacto, Cargo, Email, Teléfono, Sector, Ciudad, Web, Etiquetas</span>
            <input type="file" accept=".csv,.xlsx,.xls,.ods,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </Card>
      )}

      {step === 'map' && wb && (
        <Card title={`${file?.name} · ${num(rows.length)} filas`} icon={FileSpreadsheet} actions={
          wb.SheetNames.length > 1 && (
            <label className="inline small">Hoja:
              <select className="filter-select" value={sheet} onChange={(e) => loadSheet(wb, e.target.value)}>
                {wb.SheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}>
          {formsMode && <div className="alert alert--ok">Detectadas respuestas de Microsoft Forms: se ignoran sus columnas internas, cada solicitud crea un lead "Nuevo" con próximo paso "Llamar al cliente" hoy y el mensaje queda como nota. Las respuestas ya importadas antes no se repiten.</div>}
          <p className="muted small">Indica a qué campo del CRM corresponde cada columna. Las columnas sin asignar no se importan.</p>
          <div className="map-grid">
            {headers.map((h) => (
              <div key={h} className="map-row">
                <div className="map-row__col"><strong>{h}</strong><span className="muted small truncate">{String(rows.find((r) => r[h])?.[h] ?? '').slice(0, 60)}</span></div>
                <select className={`filter-select ${mapping[h] ? 'filter-select--on' : ''}`} value={mapping[h] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as Mapping[string] }))}>
                  <option value="">— No importar —</option>
                  {(['Empresa', 'Contacto', 'Otros'] as const).map((g) => (
                    <optgroup key={g} label={g}>{FIELDS.filter((f) => f.group === g).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {!hasCompany && !hasContact && <div className="alert alert--warn"><AlertTriangle size={16} /> Asigna al menos la columna del nombre de empresa o del contacto.</div>}
          <h3 className="h3">Vista previa ({num(records.length)} registros válidos)</h3>
          <div className="table-scroll">
            <table className="table table--compact">
              <thead><tr><th>Empresa</th><th>Sector</th><th>Ciudad</th><th>Email</th><th>Teléfono</th><th>Contacto</th><th>Etiquetas</th></tr></thead>
              <tbody>{records.slice(0, 10).map((r) => (
                <tr key={r.index}><td>{r.company.name}</td><td>{r.company.sector}</td><td>{r.company.city}</td><td>{r.company.email ?? r.contact.email}</td>
                  <td>{r.company.phone ?? r.contact.phone}</td><td>{[r.contact.firstName, r.contact.lastName].filter(Boolean).join(' ')}{r.contact.jobTitle ? ` (${r.contact.jobTitle})` : ''}</td><td>{r.tags.join(', ')}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="inline"><button className="btn btn--secondary" onClick={reset}>Atrás</button>
            <button className="btn btn--primary" disabled={!hasCompany || !records.length} onClick={review}>Revisar duplicados</button></div>
          {!hasCompany && hasContact && <p className="muted small">La importación crea empresas y sus contactos: asigna también la columna de empresa.</p>}
        </Card>
      )}

      {step === 'review' && (
        <>
          <div className="kpis kpis--4">
            <div className="kpi"><div className="kpi__label">Empresas nuevas</div><div className="kpi__value">{num(counts.create)}</div></div>
            <div className="kpi"><div className="kpi__label">Posibles duplicados</div><div className="kpi__value">{num(dups.length)}</div><div className="kpi__sub">{num(counts.merge)} fusionar · {num(counts.ignore)} ignorar</div></div>
            <div className="kpi"><div className="kpi__label">Contactos</div><div className="kpi__value">{num(counts.contacts)}</div></div>
            <div className="kpi"><div className="kpi__label">Filas repetidas en el archivo</div><div className="kpi__value">{num(Math.max(0, inFileRepeats))}</div><div className="kpi__sub">se agrupan en la misma empresa</div></div>
          </div>
          {dups.length > 0 && (
            <Card title="Posibles duplicados" icon={AlertTriangle} subtitle="Ya existen en el CRM" actions={
              <div className="inline small">Todos: {(Object.keys(ACTIONS) as DupAction[]).map((a) => <button key={a} className="btn btn--ghost btn--sm" onClick={() => setAllActions(a)}>{ACTIONS[a]}</button>)}</div>}>
              <div className="table-scroll table-scroll--tall">
                <table className="table table--compact">
                  <thead><tr><th>En el archivo</th><th>Ya en el CRM</th><th>Coincide por</th><th>Acción</th></tr></thead>
                  <tbody>{dups.slice(0, 300).map((p) => (
                    <tr key={p.key}><td>{p.data.name}<div className="muted small">{[p.data.email, p.data.phone].filter(Boolean).join(' · ')}</div></td>
                      <td>{p.existing!.name}<div className="muted small">{[p.existing!.email, p.existing!.phone].filter(Boolean).join(' · ')}</div></td>
                      <td><span className="badge badge--warn">{p.matchedBy}</span></td>
                      <td><div className="segmented segmented--sm">{(Object.keys(ACTIONS) as DupAction[]).map((a) => (
                        <button key={a} className={p.action === a ? 'active' : ''} onClick={() => setAction(p, a)}>{ACTIONS[a]}</button>))}</div></td></tr>
                  ))}</tbody>
                </table>
                {dups.length > 300 && <p className="muted small">Mostrando 300 de {num(dups.length)}. Usa "Todos" para decidir en bloque.</p>}
              </div>
              <p className="muted small">Fusionar: completa los campos vacíos de la empresa existente y añade las etiquetas (no sobrescribe nada).</p>
            </Card>
          )}
          <Card title="Opciones">
            <div className="form-grid">
              <label className="field"><span>Origen (se guarda en cada empresa)</span><input value={source} onChange={(e) => setSource(e.target.value)} /></label>
              <label className="field"><span>Etiquetas para todo el lote</span><TagInput value={extraTags} onChange={setExtraTags} suggestions={d.allTags} /></label>
              <label className="check field--wide"><input type="checkbox" checked={createLeads} onChange={(e) => setCreateLeads(e.target.checked)} />
                {formsMode ? 'Crear un lead "Nuevo" por solicitud (también si la empresa ya existía y no tiene lead activo)' : `Crear también un lead "Nuevo" por cada empresa nueva (${num(counts.create)}) para trabajarlas como lista de llamadas`}</label>
            </div>
            <p className="muted small">Se escribirán unos {num(counts.create + counts.merge + counts.contacts + (createLeads ? counts.create : 0))} registros. El plan gratuito de Firebase permite 20.000 escrituras al día.</p>
            <div className="inline">
              <button className="btn btn--secondary" onClick={() => setStep('map')} disabled={!!busy}>Atrás</button>
              <button className="btn btn--primary" onClick={run} disabled={!!busy || (!counts.create && !counts.merge && !counts.contacts)}>
                {busy ? <><Spinner size={16} /> {busy}</> : 'Confirmar importación'}
              </button>
            </div>
          </Card>
        </>
      )}

      {step === 'done' && result && (
        <Card title="Importación completada" icon={CheckCircle2}>
          <ul className="result-list">
            <li><strong>{num(result.companiesCreated)}</strong> empresas creadas</li>
            <li><strong>{num(result.companiesMerged)}</strong> empresas fusionadas</li>
            <li><strong>{num(result.contactsCreated)}</strong> contactos creados</li>
            <li><strong>{num(result.leadsCreated)}</strong> leads creados</li>
            {result.notesCreated > 0 && <li><strong>{num(result.notesCreated)}</strong> mensajes guardados como nota</li>}
            {result.skippedAlreadyImported > 0 && <li><strong>{num(result.skippedAlreadyImported)}</strong> respuestas ya importadas antes (omitidas)</li>}
          </ul>
          <p className="muted small">Puedes deshacerla desde Configuración › Datos (elimina lo creado; las fusiones se mantienen).</p>
          <button className="btn btn--secondary" onClick={reset}>Importar otro archivo</button>
        </Card>
      )}
    </div>
  );
}

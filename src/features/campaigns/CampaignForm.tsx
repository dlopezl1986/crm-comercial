import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { TagInput } from '@/components/form/TagInput';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { createItem, updateItem } from '@/services/repository';
import { num } from '@/lib/format';
import type { Campaign } from '@/types/models';
import { segment, segmentSectorsOf } from './campaignLogic';
import { SECTORS } from '@/domain/sectors';

const BASE = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
export const DEFAULTS = {
  subject: 'Publicidad · Digitaliza tu documentación de transporte en 2 días',
  linkUrl: 'https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=8l5HV7BFYkyJROT-MXvVJ5eaCAWM0CdHpLxifndLx8RUOUNPVUlXWEFBT1ZYV1I3MFRVRkZKQ1NWQi4u',
  imageUrl: `${BASE}campanas/digitaliza-transporte.jpg`,
  footer: 'Comunicación comercial enviada por [RAZÓN SOCIAL], [CIF], [DIRECCIÓN] — servicios.profesionales@syscomputers.es.\n'
    + 'Si no quieres recibir más comunicaciones comerciales, responde a este correo con la palabra BAJA y te daremos de baja inmediatamente.',
};

export function CampaignForm({ campaign, onClose, onSaved }: { campaign?: Campaign; onClose: () => void; onSaved?: (id: string) => void }) {
  const d = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [name, setName] = useState(campaign?.name ?? 'Transporte · Digitalización documental');
  const [subject, setSubject] = useState(campaign?.subject ?? DEFAULTS.subject);
  const [linkUrl, setLinkUrl] = useState(campaign?.linkUrl ?? DEFAULTS.linkUrl);
  const [imageUrl, setImageUrl] = useState(campaign?.imageUrl ?? DEFAULTS.imageUrl);
  const [footer, setFooter] = useState(campaign?.footer ?? DEFAULTS.footer);
  const [tags, setTags] = useState<string[]>(campaign?.segmentTags ?? []);
  const [sectors, setSectors] = useState<string[]>(campaign ? segmentSectorsOf(campaign) : []);
  const [subsectors, setSubsectors] = useState<string[]>(campaign?.segmentSubsectors ?? []);
  const [batchSize, setBatchSize] = useState(String(campaign?.batchSize ?? 200));
  const [busy, setBusy] = useState(false);
  // Empresas con email por sector/subsector, para mostrar cuántas hay en cada opción.
  const withEmail = useMemo(() => d.companies.filter((c) => c.email && !c.emailOptOut), [d.companies]);
  const sectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    withEmail.forEach((c) => c.sector && m.set(c.sector, (m.get(c.sector) ?? 0) + 1));
    return SECTORS.filter((s) => m.has(s)).map((s) => [s, m.get(s)!] as const);
  }, [withEmail]);
  const subsectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    withEmail.filter((c) => sectors.includes(c.sector ?? '')).forEach((c) => c.subsector && m.set(c.subsector, (m.get(c.subsector) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [withEmail, sectors]);
  const count = useMemo(() => segment(d, { segmentTags: tags, segmentSectors: sectors, segmentSubsectors: subsectors }).length, [d, tags, sectors, subsectors]);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const toggleSector = (s: string) => {
    toggle(sectors, setSectors, s);
    // Al quitar un sector, se quitan sus subsectores elegidos.
    if (sectors.includes(s)) setSubsectors((xs) => xs.filter((x) => d.companies.some((c) => c.subsector === x && c.sector !== s && sectors.includes(c.sector ?? ''))));
  };
  const footerIncomplete = /\[(RAZÓN SOCIAL|CIF|DIRECCIÓN)\]/.test(footer);

  const save = async () => {
    setBusy(true);
    const data = {
      name: name.trim(), subject: subject.trim(), linkUrl: linkUrl.trim(), imageUrl: imageUrl.trim(), footer: footer.trim(),
      segmentTags: tags, segmentSectors: sectors, segmentSubsectors: subsectors.filter((x) => subsectorCounts.some(([s]) => s === x)), segmentSector: undefined, batchSize: Math.max(1, Math.min(500, Number(batchSize) || 200)),
    };
    try {
      if (campaign) { await updateItem<Campaign>(orgId, 'campaigns', campaign.id, data); onSaved?.(campaign.id); }
      else { const id = await createItem<Campaign>(orgId, 'campaigns', uid, { ...data, sentCount: 0 }); onSaved?.(id); }
      toast('Campaña guardada');
      onClose();
    } catch (e) { console.error(e); toast('No se pudo guardar', 'error'); setBusy(false); }
  };

  return (
    <Modal title={campaign ? 'Editar campaña' : 'Nueva campaña de email'} onClose={onClose} width={760} footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={busy || !name.trim() || !subject.trim() || !linkUrl.trim()}>{busy ? <Spinner size={16} /> : 'Guardar'}</button>
      </>
    }>
      <div className="stack">
        <div className="form-grid">
          <label className="field field--wide"><span>Nombre interno</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field field--wide"><span>Asunto del email</span><input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
          <label className="field field--wide"><span>Enlace al hacer clic (formulario)</span><input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /></label>
          <label className="field field--wide"><span>Imagen (URL pública)</span><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></label>
          <label className="field field--wide"><span>Pie legal (remitente y baja)</span><textarea rows={3} value={footer} onChange={(e) => setFooter(e.target.value)} /></label>
        </div>
        {footerIncomplete && <div className="alert alert--warn">Completa en el pie la razón social, el CIF y la dirección de la empresa (obligatorio en comunicaciones comerciales).</div>}
        <div className="form-grid">
          <label className="field field--wide"><span>Destinatarios: empresas con alguna de estas etiquetas (vacío = todas)</span>
            <TagInput value={tags} onChange={setTags} suggestions={d.allTags} /></label>
          <div className="field field--wide"><span>Sectores (elige uno o varios; ninguno = todos)</span>
            <div className="chip-group">
              {sectorCounts.map(([s, n]) => (
                <button type="button" key={s} className={`chip ${sectors.includes(s) ? 'chip--on' : ''}`} onClick={() => toggleSector(s)}>{s} <span className="muted small">{num(n)}</span></button>
              ))}
            </div>
          </div>
          {sectors.length > 0 && subsectorCounts.length > 0 && (
            <div className="field field--wide"><span>Subsectores (opcional; ninguno = todos los de esos sectores)</span>
              <div className="chip-group">
                {subsectorCounts.map(([s, n]) => (
                  <button type="button" key={s} className={`chip ${subsectors.includes(s) ? 'chip--on' : ''}`} onClick={() => toggle(subsectors, setSubsectors, s)}>{s} <span className="muted small">{num(n)}</span></button>
                ))}
              </div>
            </div>
          )}
          <label className="field"><span>Emails por lote</span><input type="number" min={1} max={500} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} /></label>
        </div>
        <p className="muted small">{num(count)} empresas con email válido y sin baja en este segmento.</p>
      </div>
    </Modal>
  );
}

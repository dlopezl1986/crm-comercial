import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { TagInput } from '@/components/form/TagInput';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { createItem, updateItem } from '@/services/repository';
import { uniqueSorted } from '@/lib/text';
import { num } from '@/lib/format';
import type { Campaign } from '@/types/models';
import { segment } from './campaignLogic';

const BASE = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
export const DEFAULTS = {
  subject: 'Publicidad · Digitaliza tu documentación de transporte en 2 días',
  linkUrl: 'https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=8l5HV7BFYkyJROT-MXvVJ5eaCAWM0CdHpLxifndLx8RUOUNPVUlXWEFBT1ZYV1I3MFRVRkZKQ1NWQi4u',
  imageUrl: `${BASE}campanas/digitaliza-transporte.jpg`,
  footer: 'Comunicación comercial enviada por [RAZÓN SOCIAL], [CIF], [DIRECCIÓN] — serviciosprofesionales@syscomputers.com.\n'
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
  const [sector, setSector] = useState(campaign?.segmentSector ?? '');
  const [batchSize, setBatchSize] = useState(String(campaign?.batchSize ?? 200));
  const [busy, setBusy] = useState(false);
  const sectors = useMemo(() => uniqueSorted(d.companies.map((c) => c.sector)), [d.companies]);
  const count = useMemo(() => segment(d, { segmentTags: tags, segmentSector: sector || undefined }).length, [d, tags, sector]);
  const footerIncomplete = /\[(RAZÓN SOCIAL|CIF|DIRECCIÓN)\]/.test(footer);

  const save = async () => {
    setBusy(true);
    const data = {
      name: name.trim(), subject: subject.trim(), linkUrl: linkUrl.trim(), imageUrl: imageUrl.trim(), footer: footer.trim(),
      segmentTags: tags, segmentSector: sector || undefined, batchSize: Math.max(1, Math.min(500, Number(batchSize) || 200)),
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
          <label className="field"><span>Sector (opcional)</span>
            <select value={sector} onChange={(e) => setSector(e.target.value)}><option value="">Todos</option>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="field"><span>Emails por lote</span><input type="number" min={1} max={500} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} /></label>
        </div>
        <p className="muted small">{num(count)} empresas con email válido y sin baja en este segmento.</p>
      </div>
    </Modal>
  );
}

import { useState, type FormEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth, useOrg } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { updateOrg } from '@/services/workspace';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { usePersistentState } from '@/hooks/usePersistentState';
import { TagsSettings } from '@/features/settings/TagsSettings';
import { CustomFieldsSettings } from '@/features/settings/CustomFieldsSettings';
import { DataSettings } from '@/features/settings/DataSettings';
import { usingEmulators } from '@/lib/firebase';

type Tab = 'general' | 'tags' | 'fields' | 'data';

export function SettingsPage() {
  const [tab, setTab] = usePersistentState<Tab>('settings.tab', 'general');
  return (
    <>
      <PageHeader title="Configuración" />
      <Tabs value={tab} onChange={setTab} items={[
        { id: 'general', label: 'General' }, { id: 'tags', label: 'Etiquetas' },
        { id: 'fields', label: 'Campos personalizados' }, { id: 'data', label: 'Datos' },
      ]} />
      {tab === 'general' && <GeneralSettings />}
      {tab === 'tags' && <TagsSettings />}
      {tab === 'fields' && <CustomFieldsSettings />}
      {tab === 'data' && <DataSettings />}
    </>
  );
}

function GeneralSettings() {
  const { user } = useAuth();
  const org = useOrg();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [orgName, setOrgName] = useState(org.name);
  const [staleDays, setStaleDays] = useState(String(org.settings.staleDays));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const days = Math.max(1, Math.min(365, Number(staleDays) || 14));
    try {
      await updateOrg(org.id, { name: orgName.trim() || 'Mi CRM', 'settings.staleDays': days });
      setStaleDays(String(days));
      toast('Configuración guardada');
    } catch (err) { console.error(err); toast('No se pudo guardar', 'error'); }
  };

  return (
    <div className="settings">
      <Card title="Apariencia">
        <div className="segmented">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={16} /> Claro</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={16} /> Oscuro</button>
        </div>
        <p className="muted small">Se guarda en tu perfil y se aplica en cualquier navegador donde inicies sesión.</p>
      </Card>
      <Card title="Organización y seguimiento">
        <form onSubmit={save} className="stack">
          <div className="form-grid">
            <label className="field"><span>Nombre</span><input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></label>
            <label className="field"><span>Oportunidad estancada tras (días sin actividad)</span>
              <input type="number" min={1} max={365} value={staleDays} onChange={(e) => setStaleDays(e.target.value)} /></label>
          </div>
          <div><button className="btn btn--primary">Guardar</button></div>
        </form>
      </Card>
      <Card title="Cuenta">
        <dl className="kv">
          <dt>Email</dt><dd>{user?.email}</dd>
          <dt>ID de usuario</dt><dd className="mono">{user?.uid}</dd>
          {usingEmulators && <><dt>Entorno</dt><dd>Emuladores locales (pruebas)</dd></>}
        </dl>
      </Card>
    </div>
  );
}

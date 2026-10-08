import { useState, type FormEvent } from 'react';
import { updateDoc } from 'firebase/firestore';
import { Moon, Sun } from 'lucide-react';
import { useAuth, useOrg } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { orgDoc } from '@/services/paths';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

export function SettingsPage() {
  const { user } = useAuth();
  const org = useOrg();
  const { theme, setTheme } = useTheme();
  const [orgName, setOrgName] = useState(org.name);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');

  const saveOrg = async (e: FormEvent) => {
    e.preventDefault();
    setSaved('saving');
    try {
      await updateDoc(orgDoc(org.id), { name: orgName.trim() || 'Mi CRM' });
      setSaved('ok');
    } catch (err) {
      console.error(err);
      setSaved('error');
    }
  };

  return (
    <>
      <PageHeader title="Configuración" />
      <div className="settings">
        <Card title="Apariencia">
          <div className="segmented">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={16} /> Claro</button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={16} /> Oscuro</button>
          </div>
          <p className="muted small">Se guarda en tu perfil y se aplica en cualquier navegador donde inicies sesión.</p>
        </Card>

        <Card title="Cuenta">
          <dl className="kv">
            <dt>Email</dt><dd>{user?.email}</dd>
            <dt>ID de usuario</dt><dd className="mono">{user?.uid}</dd>
          </dl>
        </Card>

        <Card title="Organización">
          <form onSubmit={saveOrg} className="inline-form">
            <label className="field">
              <span>Nombre</span>
              <input value={orgName} onChange={(e) => { setOrgName(e.target.value); setSaved('idle'); }} />
            </label>
            <button className="btn btn--primary" disabled={saved === 'saving'}>Guardar</button>
          </form>
          {saved === 'ok' && <p className="small success">Guardado.</p>}
          {saved === 'error' && <p className="small danger">No se pudo guardar.</p>}
        </Card>
      </div>
    </>
  );
}

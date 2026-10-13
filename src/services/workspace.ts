import { doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { fb } from '@/lib/firebase';
import { orgCol, orgDoc, userDoc } from './paths';
import { stamp } from './repository';
import { DEFAULT_SERVICES } from '@/domain/labels';
import type { Org, UserProfile } from '@/types/models';

export const DEFAULT_ORG_SETTINGS = { staleDays: 14, currency: 'EUR' as const };

/**
 * Garantiza que el usuario tenga perfil y organización personal.
 * En el primer inicio de sesión crea users/{uid}, orgs/{uid}, su membresía de propietario
 * y el catálogo inicial de servicios.
 */
export async function ensureWorkspace(user: User): Promise<UserProfile> {
  const uRef = userDoc(user.uid);
  const uSnap = await getDoc(uRef);

  if (!uSnap.exists()) {
    const orgId = user.uid;
    const batch = writeBatch(fb().db);
    batch.set(uRef, {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      defaultOrgId: orgId,
      prefs: {},
      createdAt: serverTimestamp(),
    });
    batch.set(orgDoc(orgId), {
      name: 'Mi CRM',
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      settings: DEFAULT_ORG_SETTINGS,
    });
    batch.set(doc(fb().db, 'orgs', orgId, 'members', user.uid), {
      uid: user.uid,
      email: user.email ?? '',
      role: 'owner',
      joinedAt: serverTimestamp(),
    });
    await batch.commit();
  }

  const profile = { ...((await getDoc(uRef)).data() as UserProfile), uid: user.uid };
  await ensureCatalog(profile.defaultOrgId, user.uid);
  return profile;
}

/** Crea el catálogo inicial de servicios una única vez por organización. */
async function ensureCatalog(orgId: string, uid: string) {
  const snap = await getDoc(orgDoc(orgId));
  const org = snap.data() as Partial<Org> & { servicesSeeded?: boolean };
  if (!org || org.servicesSeeded || org.ownerId !== uid) return;
  const batch = writeBatch(fb().db);
  DEFAULT_SERVICES.forEach((name, i) => {
    batch.set(doc(orgCol(orgId, 'services')), { name, active: true, order: i, ...stamp(uid) });
  });
  batch.update(orgDoc(orgId), { servicesSeeded: true });
  await batch.commit();
}

export function saveThemePref(uid: string, theme: 'light' | 'dark') {
  return updateDoc(userDoc(uid), { 'prefs.theme': theme });
}

export function updateOrg(orgId: string, data: Record<string, unknown>) {
  return updateDoc(orgDoc(orgId), data);
}

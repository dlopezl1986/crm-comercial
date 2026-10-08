import { getDoc, serverTimestamp, writeBatch, doc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { fb } from '@/lib/firebase';
import { orgDoc, userDoc } from './paths';
import type { Org, UserProfile } from '@/types/models';

export const DEFAULT_ORG_SETTINGS = { staleDays: 14, currency: 'EUR' as const };

/**
 * Garantiza que el usuario tenga perfil y organización personal.
 * En el primer inicio de sesión crea users/{uid}, orgs/{uid} y su membresía de propietario.
 */
export async function ensureWorkspace(user: User): Promise<{ profile: UserProfile; org: Org }> {
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

  const profileSnap = await getDoc(uRef);
  const profile = { ...(profileSnap.data() as UserProfile), uid: user.uid };
  const orgSnap = await getDoc(orgDoc(profile.defaultOrgId));
  const org = { ...(orgSnap.data() as Omit<Org, 'id'>), id: orgSnap.id };
  return { profile, org };
}

export function saveThemePref(uid: string, theme: 'light' | 'dark') {
  return updateDoc(userDoc(uid), { 'prefs.theme': theme });
}

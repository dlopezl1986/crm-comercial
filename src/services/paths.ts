import { collection, doc } from 'firebase/firestore';
import { fb } from '@/lib/firebase';

/** Colecciones de negocio dentro de una organización. */
export type OrgCollection =
  | 'companies' | 'contacts' | 'leads' | 'opportunities' | 'activities'
  | 'services' | 'tags' | 'customFields' | 'imports' | 'members';

export const orgDoc = (orgId: string) => doc(fb().db, 'orgs', orgId);
export const orgCol = (orgId: string, name: OrgCollection) => collection(fb().db, 'orgs', orgId, name);
export const userDoc = (uid: string) => doc(fb().db, 'users', uid);

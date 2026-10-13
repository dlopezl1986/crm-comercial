import {
  doc, serverTimestamp, updateDoc, writeBatch, setDoc, Timestamp, type DocumentReference,
} from 'firebase/firestore';
import { fb } from '@/lib/firebase';
import { orgCol, type OrgCollection } from './paths';
import { settle } from './commit';
import type { BaseDoc } from '@/types/models';

/** Campos que gestiona el repositorio y no deben venir del formulario. */
type Managed = 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'ownerId';
export type NewDoc<T extends BaseDoc> = Omit<T, Managed>;
export type Patch<T extends BaseDoc> = Partial<Record<keyof NewDoc<T>, unknown>> & Record<string, unknown>;

/** Firestore no acepta `undefined`: en altas se omite y en ediciones se guarda como null (campo vaciado). */
function clean(data: Record<string, unknown>, forUpdate: boolean) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) { if (forUpdate) out[k] = null; } else out[k] = v;
  }
  return out;
}

export function stamp(uid: string) {
  return { createdAt: serverTimestamp(), updatedAt: Timestamp.now(), createdBy: uid, ownerId: uid };
}

export function newRef(orgId: string, name: OrgCollection): DocumentReference {
  return doc(orgCol(orgId, name));
}

export async function createItem<T extends BaseDoc>(orgId: string, name: OrgCollection, uid: string, data: NewDoc<T>) {
  const ref = doc(orgCol(orgId, name));
  await settle(setDoc(ref, { ...clean(data as Record<string, unknown>, false), ...stamp(uid) }));
  return ref.id;
}

/** Alta con id ya reservado (para crear varios documentos relacionados a la vez). */
export function createWithRef<T extends BaseDoc>(ref: DocumentReference, uid: string, data: NewDoc<T>) {
  return settle(setDoc(ref, { ...clean(data as Record<string, unknown>, false), ...stamp(uid) }));
}

export function updateItem<T extends BaseDoc>(orgId: string, name: OrgCollection, id: string, data: Patch<T>) {
  return settle(updateDoc(doc(orgCol(orgId, name), id), { ...clean(data, true), updatedAt: Timestamp.now() }));
}

/** Borrado lógico (ver services/sync.ts). */
export function deleteItem(orgId: string, name: OrgCollection, id: string) {
  return settle(updateDoc(doc(orgCol(orgId, name), id), { deleted: true, updatedAt: Timestamp.now() }));
}

/** Aplica cambios a muchos documentos en lotes de 450 (límite de Firestore: 500). */
export async function bulkUpdate(
  orgId: string, name: OrgCollection, updates: { id: string; data: Record<string, unknown> }[],
  onProgress?: (done: number) => void,
) {
  for (let i = 0; i < updates.length; i += 450) {
    const batch = writeBatch(fb().db);
    updates.slice(i, i + 450).forEach(({ id, data }) =>
      batch.update(doc(orgCol(orgId, name), id), { ...clean(data, true), updatedAt: Timestamp.now() }));
    await batch.commit();
    onProgress?.(Math.min(updates.length, i + 450));
  }
}

/** Altas masivas en lotes (importación, datos de demo). Devuelve los ids creados. */
export async function bulkCreate(
  orgId: string, name: OrgCollection, uid: string, rows: Record<string, unknown>[],
  onProgress?: (done: number) => void,
) {
  const ids: string[] = [];
  for (let i = 0; i < rows.length; i += 450) {
    const batch = writeBatch(fb().db);
    rows.slice(i, i + 450).forEach((row) => {
      const ref = row.id ? doc(orgCol(orgId, name), String(row.id)) : doc(orgCol(orgId, name));
      const { id: _omit, ...rest } = row;
      void _omit;
      batch.set(ref, { ...clean(rest, false), ...stamp(uid) });
      ids.push(ref.id);
    });
    await batch.commit();
    onProgress?.(Math.min(rows.length, i + 450));
  }
  return ids;
}

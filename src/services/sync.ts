import {
  getDocsFromCache, onSnapshot, query, where, Timestamp, type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { orgCol, type OrgCollection } from './paths';

/**
 * Sincronización incremental de una colección.
 *
 * 1. Pinta al instante lo que ya hay en la caché local de Firestore (sin lecturas facturables).
 * 2. Escucha en el servidor solo los documentos con `updatedAt >= última sincronización`,
 *    así una sesión nueva lee únicamente lo que ha cambiado (clave con miles de empresas
 *    y la cuota gratuita de 50.000 lecturas/día).
 * Los borrados son lógicos (`deleted: true`) para que también lleguen por esta vía.
 */
export function syncCollection<T extends { id: string; deleted?: boolean }>(
  orgId: string,
  name: OrgCollection,
  onData: (items: T[]) => void,
  onError: (e: Error) => void,
): () => void {
  const key = `crm.sync.${orgId}.${name}`;
  const items = new Map<string, T>();
  let cancelled = false;
  let unsub: (() => void) | null = null;

  const emit = () => onData([...items.values()].filter((x) => !x.deleted));
  const toItem = (d: QueryDocumentSnapshot<DocumentData>) => ({ ...d.data({ serverTimestamps: 'estimate' }), id: d.id }) as T;

  const readLastSync = () => {
    try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
  };
  const writeLastSync = (ms: number) => {
    try { localStorage.setItem(key, String(ms)); } catch { /* ignorar */ }
  };

  (async () => {
    let since = readLastSync();
    try {
      const cached = await getDocsFromCache(orgCol(orgId, name));
      cached.docs.forEach((d) => items.set(d.id, toItem(d)));
    } catch { /* caché no disponible */ }
    // Si la caché está vacía (navegador nuevo o caché borrada), se hace una carga completa.
    if (items.size === 0) since = 0;
    if (cancelled) return;
    // Con caché, se pinta ya. Sin caché, se espera a los datos del servidor (para no mostrar
    // "vacío" mientras descarga); si no hay red, a los 10 s se muestra lo que haya.
    let waitingServer = since === 0;
    if (!waitingServer) emit();
    const fallback = setTimeout(() => { if (waitingServer) { waitingServer = false; emit(); } }, 10000);

    // Margen de 10 min por posibles diferencias de reloj entre dispositivos (updatedAt lo pone el cliente).
    const q = since
      ? query(orgCol(orgId, name), where('updatedAt', '>=', Timestamp.fromMillis(since - 10 * 60 * 1000)))
      : orgCol(orgId, name);

    unsub = onSnapshot(q, (snap) => {
      let max = since;
      snap.docChanges().forEach((ch) => {
        // En modo incremental, un "removed" significa que una edición local aún sin confirmar
        // (updatedAt pendiente) ha salido del filtro: el documento sigue existiendo, con estos datos.
        if (ch.type === 'removed' && since === 0) items.delete(ch.doc.id);
        else items.set(ch.doc.id, toItem(ch.doc));
        const u = (ch.doc.data().updatedAt as Timestamp | null)?.toMillis?.();
        if (u && !ch.doc.metadata.hasPendingWrites && u > max) max = u;
      });
      if (max > since && !snap.metadata.fromCache) writeLastSync(max);
      if (waitingServer && snap.metadata.fromCache) return;
      waitingServer = false;
      clearTimeout(fallback);
      emit();
    }, onError);
  })();

  return () => { cancelled = true; unsub?.(); };
}

/**
 * Escrituras "optimistas": Firestore aplica el cambio en local al instante y lo sincroniza
 * después. La interfaz no espera la confirmación del servidor más de un momento; si el
 * servidor la rechaza más tarde, se avisa con un evento global (lo muestra ToastProvider).
 */
export const WRITE_ERROR_EVENT = 'crm:write-error';
const WAIT_MS = 1200;

export function settle<T>(p: Promise<T>): Promise<T | undefined> {
  p.catch((e) => {
    console.error(e);
    window.dispatchEvent(new CustomEvent(WRITE_ERROR_EVENT, { detail: String(e?.code ?? e) }));
  });
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), WAIT_MS))]);
}

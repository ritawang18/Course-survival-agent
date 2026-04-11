/**
 * Race a promise against a timeout. Returns null on timeout or rejection
 * — callers must handle null. Used to keep skill calls from hanging the
 * route handler.
 */
export async function withTimeout<T>(
  p: Promise<T>,
  ms: number
): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Make account initialization recoverable when an auth or workspace request
 * never settles. A timed-out request is not evidence of an invalid session.
 * Keep authorization decisions in the caller; never auto-sign-out on timeout.
 */
export function withStartupTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export function safeSleep(ms: number, signal?: AbortSignal): Promise<void> {
  let timeoutId: number | undefined;
  signal?.addEventListener("abort", () => {
    clearTimeout(timeoutId);
  });
  return new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      clearTimeout(timeoutId);
      resolve();
    }, ms);
  });
}

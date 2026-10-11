/** Bound function limits to the Inngest account plan; free accounts allow five. */
export const capInngestConcurrency = (requested: number): number => {
  const configured = process.env.INNGEST_CONCURRENCY_LIMIT;
  const cap = configured === undefined ? 5 : Number(configured);
  if (!Number.isSafeInteger(cap) || cap < 1) {
    throw new Error('INNGEST_CONCURRENCY_LIMIT must be a positive integer');
  }
  return Math.min(requested, cap);
};

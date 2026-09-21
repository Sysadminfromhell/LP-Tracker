export function isExpectedReconciliationRetryReason(reason: string | null): boolean {
  if (!reason) {
    return false;
  }
  return (
    reason === 'Unresolved block is not fully synchronized' ||
    /^Resolved 0\/\d+ matches$/.test(reason)
  );
}

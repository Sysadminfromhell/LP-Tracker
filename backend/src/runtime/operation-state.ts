let refreshInProgress = false;
let lifecycleInProgress = false;

export function isRefreshInProgress(): boolean {
  return refreshInProgress;
}
export function isLifecycleInProgress(): boolean {
  return lifecycleInProgress;
}
export function isOperationBusy(): boolean {
  return refreshInProgress || lifecycleInProgress;
}
export function setRefreshInProgress(value: boolean): void {
  refreshInProgress = value;
}
export function setLifecycleInProgress(value: boolean): void {
  lifecycleInProgress = value;
}
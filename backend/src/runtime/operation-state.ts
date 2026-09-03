let refreshInProgress = false;
let lifecycleInProgress = false;

export interface OperationState {
  refreshInProgress: boolean;
  lifecycleInProgress: boolean;
}
export function getOperationState(): OperationState {
  return {
    refreshInProgress,
    lifecycleInProgress,
  };
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

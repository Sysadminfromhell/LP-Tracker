let lifecycleInProgress = false;

export interface OperationState {
  lifecycleInProgress: boolean;
}

export function getOperationState(): OperationState {
  return {
    lifecycleInProgress,
  };
}

export function setLifecycleInProgress(value: boolean): void {
  lifecycleInProgress = value;
}

// Shared globals for VM-extracted composition-root functions. The real state
// machine is used; fixtures choose their own visible frame/packet schedule.
import { BrowserStateRecovery } from '../src/browser-state-recovery.mjs';
export function browserRecoveryBindings() {
  return { browserStateRecovery: new BrowserStateRecovery(), socketStartedAt: 0,
    capturedCanvasPointerId: null, performance, canPresentLiveFeedback: () => true };
}

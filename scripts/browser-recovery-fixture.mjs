// Shared globals for VM-extracted composition-root functions. The real state
// machine is used; fixtures choose their own visible frame/packet schedule.
import { BrowserStateRecovery } from '../src/browser-state-recovery.mjs';
export function browserRecoveryBindings() {
  return { browserStateRecovery: new BrowserStateRecovery(), socketStartedAt: 0,
    // Match-action rendering is outside these socket/navigation fixtures. Its
    // actual confirmation controller and main Escape binding have dedicated tests.
    matchDecisions: { disconnectCount: 0, update() {}, feedback() {}, close() {},
      disconnect() { this.disconnectCount++; } },
    capturedCanvasPointerId: null, performance, canPresentLiveFeedback: () => true };
}

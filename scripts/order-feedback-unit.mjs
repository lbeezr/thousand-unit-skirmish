import assert from 'node:assert/strict';
import { classifyOrderNotice } from '../src/order-feedback.mjs';

assert.deepEqual(classifyOrderNotice({
  message: 'BUILD REJECTED · SPACE BLOCKED',
  noticeToken: 14,
  currentOrderToken: 20,
  pendingBuildOrderToken: 14,
}), {
  applyOrderStatus: false,
  clearPendingBuild: true,
  showToast: true,
}, 'a delayed rejection should clear and explain only its matching pending build');

assert.deepEqual(classifyOrderNotice({
  message: 'BUILD REJECTED · SPACE BLOCKED',
  noticeToken: 14,
  currentOrderToken: 20,
  pendingBuildOrderToken: 18,
}), {
  applyOrderStatus: false,
  clearPendingBuild: false,
  showToast: false,
}, 'a rejection for an older build must not clear a newer build request');

assert.deepEqual(classifyOrderNotice({
  message: 'BUILD REJECTED · SELECT A WORKER',
  noticeToken: 20,
  currentOrderToken: 20,
  pendingBuildOrderToken: null,
}), {
  applyOrderStatus: true,
  clearPendingBuild: false,
  showToast: true,
}, 'a current resume-build rejection should update status without clearing placement state');

assert.deepEqual(classifyOrderNotice({
  message: 'MOVE ORDER · 500 UNITS',
  noticeToken: 14,
  currentOrderToken: 20,
  pendingBuildOrderToken: null,
}), {
  applyOrderStatus: false,
  clearPendingBuild: false,
  showToast: false,
}, 'stale movement results should not replace current feedback');

assert.deepEqual(classifyOrderNotice({
  message: 'BUILD REJECTED · SPACE BLOCKED',
  noticeToken: null,
  currentOrderToken: 20,
  pendingBuildOrderToken: 18,
}), {
  applyOrderStatus: false,
  clearPendingBuild: true,
  showToast: true,
}, 'legacy untagged build rejections should still release their pending UI');

console.log('Order feedback unit scenario passed: stale and matching build replies preserve request-specific UI state.');

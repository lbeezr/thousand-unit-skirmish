export function classifyOrderNotice({ message, noticeToken, currentOrderToken, pendingBuildOrderToken }) {
  const tokenized = Number.isSafeInteger(noticeToken);
  const stale = tokenized && noticeToken !== currentOrderToken;
  const buildRejected = String(message || '').startsWith('BUILD REJECTED ·');
  const pendingBuildReply = buildRejected && (
    (tokenized && noticeToken === pendingBuildOrderToken)
    || (!tokenized && pendingBuildOrderToken !== null)
  );

  return {
    applyOrderStatus: tokenized && !stale,
    clearPendingBuild: pendingBuildReply,
    showToast: !stale || pendingBuildReply,
  };
}

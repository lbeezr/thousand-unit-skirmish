export function classifyOrderNotice({ message, noticeToken, currentOrderToken, pendingBuildOrderToken }) {
  const tokenized = Number.isSafeInteger(noticeToken);
  const stale = tokenized && noticeToken !== currentOrderToken;
  const buildRejected = String(message || '').startsWith('BUILD REJECTED ·');
  const wallPlaced = String(message || '').startsWith('PALISADE LINE PLACED ·')
    || message === 'WALL ALREADY PLACED · NO CHARGE';
  const completePendingBuild = wallPlaced && tokenized && noticeToken === pendingBuildOrderToken;
  const pendingBuildReply = buildRejected && (
    (tokenized && noticeToken === pendingBuildOrderToken)
    || (!tokenized && pendingBuildOrderToken !== null)
  );

  return {
    ...(completePendingBuild ? { completePendingBuild: true } : {}),
    applyOrderStatus: tokenized && !stale,
    clearPendingBuild: pendingBuildReply,
    showToast: !stale || pendingBuildReply || completePendingBuild,
  };
}

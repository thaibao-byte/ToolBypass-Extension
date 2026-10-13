// Background service worker — không cần logic phức tạp,
// chỉ giữ để extension hoạt động ổn định trên Kiwi/Quetta.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ToolBypass] Extension installed — t.me/toolbypass');
});

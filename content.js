/**
 * Bubble Breakpoint Override v4 - Content Script
 * Injects the main BBO script into the Bubble editor page context.
 */
(function() {
  'use strict';
  if (!window.location.href.includes('/page')) return;
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(script);
  console.log('[BBO] Content script v4 loaded.');
})();

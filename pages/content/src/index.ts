console.log('[Uato Naext] Content script loaded');

// Function to inject the script as early as possible
const injectScript = () => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected-fetch.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
  console.log('[Uato Naext] Fetch interceptor injected');
};

// Inject immediately
injectScript();

// Listen for custom event from injected script
window.addEventListener('UATO_JWT_TOKEN', (event: Event) => {
  const customEvent = event as CustomEvent;
  const token = customEvent.detail?.token;

  if (token) {
    console.log('[Uato Naext] Retrieved JWT Token via CustomEvent');

    // Store in chrome.storage for persistence
    chrome.storage.local.set({ jwtToken: token }, () => {
      console.log('[Uato Naext] Token stored in extension storage');
    });

    // Also notify the background script
    chrome.runtime.sendMessage({ type: 'JWT_TOKEN_UPDATED', token });
  }
});

// Check if there's already a token in storage
chrome.storage.local.get(['jwtToken'], result => {
  if (result.jwtToken) {
    console.log('[Uato Naext] Retrieved token from storage');
  }
});

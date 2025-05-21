console.log('[Uato Naext] Content script loaded');

// Function to inject the script as early as possible
const injectScript = () => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected-fetch.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
  console.log('[Uato Naext] Fetch interceptor injected');
};

// Inject an API handler script
const injectApiHandler = () => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('api-handler.js');
  script.onload = () => console.log('[Uato Naext] API handler injected');
  (document.head || document.documentElement).appendChild(script);
};

// Inject scripts
injectScript();
injectApiHandler();

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

// Listen for API response events from the page context
window.addEventListener('UATO_API_RESPONSE', (event: Event) => {
  const customEvent = event as CustomEvent;
  const { data, error, type } = customEvent.detail || {};

  if (type === 'subjects') {
    console.log('[Uato Naext] Received subjects data from page context');
    chrome.runtime.sendMessage({
      type: 'SUBJECTS_FETCHED',
      data,
      error,
      timestamp: new Date().toISOString(),
    });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUBJECTS') {
    console.log('[Uato Naext] Received request to fetch subjects');

    // Trigger the fetch subjects function in the page context
    window.dispatchEvent(new CustomEvent('UATO_FETCH_SUBJECTS'));

    // Let the popup know we're processing the request
    sendResponse({ status: 'processing' });
    return true; // Keep the message channel open for async response
  }
});

// Check if there's already a token in storage
chrome.storage.local.get(['jwtToken'], result => {
  if (result.jwtToken) {
    console.log('[Uato Naext] Retrieved token from storage');
  }
});

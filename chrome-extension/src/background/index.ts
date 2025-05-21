import 'webextension-polyfill';

console.log('Background loaded');

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward SUBJECTS_FETCHED messages to popup
  if (message.type === 'SUBJECTS_FETCHED') {
    chrome.runtime.sendMessage(message);
  }

  // Handle JWT token updates
  if (message.type === 'JWT_TOKEN_UPDATED') {
    console.log('Background script received updated JWT token');
  }
});

// Function to get token when needed by other parts of your extension
export const getJwtToken = async (): Promise<string | null> => {
  return new Promise(resolve => {
    chrome.storage.local.get(['jwtToken'], result => {
      resolve(result.jwtToken || null);
    });
  });
};

// Export a function to use the token for API requests
export const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  const token = await getJwtToken();
  if (!token) {
    throw new Error('No authentication token available');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, {
    ...options,
    headers,
  });
};

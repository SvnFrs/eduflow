(() => {
  console.log('[EduFlow] injected-fetch.js loaded');

  // Store the original fetch
  const originalFetch = window.fetch;

  // Create storage for the token
  let capturedToken = null;

  // Override fetch
  window.fetch = async (...args) => {
    const requestInfo = args[0];
    const requestInit = args[1] || {};

    // Check for token in this request
    try {
      const headers = requestInit.headers || {};
      let authorization;

      // Handle different header formats
      if (headers instanceof Headers) {
        authorization = headers.get('authorization');
      } else if (typeof headers === 'object') {
        authorization = headers['authorization'] || headers['Authorization'];
      }

      if (authorization?.startsWith('Bearer ')) {
        const bearerToken = authorization.slice(7);
        if (bearerToken && bearerToken !== capturedToken) {
          capturedToken = bearerToken;
          console.log('[EduFlow] Captured new Bearer token');

          // Store locally
          localStorage.setItem('eduflowToken', bearerToken);

          // Send to extension
          window.dispatchEvent(
            new CustomEvent('EDUFLOW_JWT_TOKEN', {
              detail: { token: bearerToken },
            }),
          );
        }
      }
    } catch (e) {
      console.warn('[EduFlow] Error processing headers:', e);
    }

    // Continue with the original fetch
    return originalFetch.apply(this, args);
  };

  // Also override XMLHttpRequest to capture tokens there
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (...args) {
    // Store the method and URL for later use
    this._eduflowMethod = args[0];
    this._eduflowUrl = args[1];
    return originalXHROpen.apply(this, args);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
    // Check if this is an authorization header
    if (header.toLowerCase() === 'authorization' && value.startsWith('Bearer ')) {
      const bearerToken = value.slice(7);
      if (bearerToken && bearerToken !== capturedToken) {
        capturedToken = bearerToken;
        console.log('[EduFlow] Captured new Bearer token from XHR');

        // Store locally
        localStorage.setItem('eduflowToken', bearerToken);

        // Send to extension
        window.dispatchEvent(
          new CustomEvent('EDUFLOW_JWT_TOKEN', {
            detail: { token: bearerToken },
          }),
        );
      }
    }
    return originalXHRSetRequestHeader.apply(this, arguments);
  };

  // Try to retrieve token from localStorage if it exists
  const storedToken = localStorage.getItem('eduflowToken');
  if (storedToken) {
    console.log('[EduFlow] Found stored token');
    window.dispatchEvent(
      new CustomEvent('EDUFLOW_JWT_TOKEN', {
        detail: { token: storedToken },
      }),
    );
  }
})();

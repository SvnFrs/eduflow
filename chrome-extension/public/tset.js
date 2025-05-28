(() => {
  console.log('[Uato Naext] API handler loaded in page context');

  // Function to get JWT token
  const getJwtToken = () => {
    try {
      return localStorage.getItem('uatoNaextToken');
    } catch (error) {
      console.error('[Uato Naext] Error getting JWT token:', error);
      return null;
    }
  };

  // Function to get user identity
  const getUserIdentity = () => {
    try {
      const identify = localStorage.getItem('identify');
      return identify ? JSON.parse(identify) : null;
    } catch (error) {
      console.error('[Uato Naext] Error getting user identity:', error);
      return null;
    }
  };

  // Function to intercept and reuse headers from existing requests
  let capturedHeaders = null;
  let lastCaptureTime = null;

  // Override fetch to capture headers from legitimate requests
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const request = args[0];
    const options = args[1] || {};

    // Check if this is a request to the API we care about
    if (typeof request === 'string' && request.includes('fugw-edunext.fpt.edu.vn/fu/api/v1/')) {
      const headers = options.headers || {};

      // Capture headers if they contain the required fields
      if (headers['x-checksum'] && headers['x-hash'] && headers['x-date']) {
        capturedHeaders = {
          'x-checksum': headers['x-checksum'],
          'x-hash': headers['x-hash'],
          'x-date': headers['x-date'],
          'x-expiration': headers['x-expiration'],
        };
        lastCaptureTime = new Date();
        console.log('[Uato Naext] Captured headers from legitimate request:', {
          'x-date': headers['x-date'],
          'x-expiration': headers['x-expiration'],
        });
      }
    }

    return originalFetch.apply(this, args);
  };

  // Also override XMLHttpRequest to capture headers
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const headerCapture = {};

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (name.toLowerCase().startsWith('x-')) {
      headerCapture[name.toLowerCase()] = value;

      // If we have all required headers, store them
      if (headerCapture['x-checksum'] && headerCapture['x-hash'] && headerCapture['x-date']) {
        capturedHeaders = {
          'x-checksum': headerCapture['x-checksum'],
          'x-hash': headerCapture['x-hash'],
          'x-date': headerCapture['x-date'],
          'x-expiration': headerCapture['x-expiration'],
        };
        lastCaptureTime = new Date();
        console.log('[Uato Naext] Captured headers from XHR request:', {
          'x-date': headerCapture['x-date'],
          'x-expiration': headerCapture['x-expiration'],
        });
      }
    }

    return originalXHRSetRequestHeader.call(this, name, value);
  };

  // Function to format date in the same format as the original requests
  const formatDate = date => {
    // Use local time instead of UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // Function to generate headers using captured values or fallback
  const generateApiHeaders = token => {
    const baseHeaders = {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      priority: 'u=1, i',
      'sec-ch-ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
    };

    // If we have captured headers and they're recent (within 30 seconds), use them
    if (capturedHeaders && lastCaptureTime) {
      const now = new Date();
      const timeSinceCapture = now.getTime() - lastCaptureTime.getTime();

      // Only use captured headers if they're recent (within 30 seconds)
      if (timeSinceCapture < 30000) {
        // Update the timestamp to current time using local time
        const expiration = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now

        const updatedHeaders = {
          ...baseHeaders,
          'x-checksum': capturedHeaders['x-checksum'], // Reuse the same checksum
          'x-date': formatDate(now),
          'x-expiration': formatDate(expiration),
          'x-hash': capturedHeaders['x-hash'], // Reuse the same hash
        };

        console.log('[Uato Naext] Using captured headers with updated timestamp:', {
          'x-date': updatedHeaders['x-date'],
          'x-expiration': updatedHeaders['x-expiration'],
        });

        return updatedHeaders;
      } else {
        console.log('[Uato Naext] Captured headers too old, clearing them');
        capturedHeaders = null;
        lastCaptureTime = null;
      }
    }

    // Fallback: try to make request without these headers first
    console.log('[Uato Naext] No valid captured headers, using base headers only');
    return baseHeaders;
  };

  // Function to fetch class list for a course
  const fetchClassList = async courseId => {
    const token = getJwtToken();
    if (!token) {
      throw new Error('No JWT token found');
    }

    try {
      console.log('[Uato Naext] Attempting to fetch class list for course:', courseId);

      // First, try to trigger a legitimate request to capture fresh headers
      if (!capturedHeaders || !lastCaptureTime || new Date().getTime() - lastCaptureTime.getTime() > 30000) {
        console.log('[Uato Naext] No recent headers available, requesting fresh headers...');

        // Wait a moment to see if any legitimate requests happen
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      let headers = generateApiHeaders(token);

      let response = await originalFetch(
        `https://fugw-edunext.fpt.edu.vn/fu/api/v1/class/list-class?courseId=${courseId}`,
        {
          method: 'GET',
          headers: headers,
          mode: 'cors',
          credentials: 'include',
        },
      );

      // If the first attempt fails, wait a bit more for headers to be captured
      if (!response.ok && (!capturedHeaders || !lastCaptureTime)) {
        console.log('[Uato Naext] First attempt failed, waiting longer for headers to be captured...');

        // Wait longer for headers to be captured from other requests
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try again with potentially captured headers
        headers = generateApiHeaders(token);
        response = await originalFetch(
          `https://fugw-edunext.fpt.edu.vn/fu/api/v1/class/list-class?courseId=${courseId}`,
          {
            method: 'GET',
            headers: headers,
            mode: 'cors',
            credentials: 'include',
          },
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Uato Naext] API request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.code === '200' && result.data && result.data.length > 0) {
        return result.data[0]; // Return the first class
      } else {
        throw new Error(`No classes found for this course. Response: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error('[Uato Naext] Error fetching class list:', error);
      throw error;
    }
  };

  // Function to handle course redirection
  const handleCourseRedirection = async courseId => {
    try {
      console.log(`[Uato Naext] Handling redirection for course ${courseId}`);

      const classInfo = await fetchClassList(courseId);
      const classId = classInfo.id;

      console.log(`[Uato Naext] Found class ID: ${classId} for course ${courseId}`);

      // Send the redirection info back to content script
      window.dispatchEvent(
        new CustomEvent('UATO_API_RESPONSE', {
          detail: {
            type: 'course_redirect',
            data: {
              courseId,
              classId,
              className: classInfo.name,
              semesterName: classInfo.semesterName,
              campusCode: classInfo.campusCode,
              redirectUrl: `https://fu-edunext.fpt.edu.vn/course?id=${courseId}&classId=${classId}`,
            },
          },
        }),
      );
    } catch (error) {
      console.error('[Uato Naext] Error in course redirection:', error);

      window.dispatchEvent(
        new CustomEvent('UATO_API_RESPONSE', {
          detail: {
            type: 'course_redirect',
            error: error.message || 'Failed to get class information',
          },
        }),
      );
    }
  };

  // Function to get subjects from localStorage
  const getSubjectsFromStorage = () => {
    try {
      const semester = localStorage.getItem('SELECTED_SEMESTER');
      if (!semester) {
        console.log('[Uato Naext] No semester found in localStorage');
        return null;
      }

      const key = 'COURSES-' + semester;
      const cached = localStorage.getItem(key);

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.data) {
            console.log('[Uato Naext] Found subjects in localStorage:', parsed.data.length);
            return parsed.data;
          }
        } catch (e) {
          console.error('[Uato Naext] Error parsing subjects from localStorage:', e);
        }
      }

      return null;
    } catch (error) {
      console.error('[Uato Naext] Error accessing localStorage:', error);
      return null;
    }
  };

  // Function to handle the subjects request
  const handleSubjectsRequest = () => {
    const subjects = getSubjectsFromStorage();

    if (subjects) {
      window.dispatchEvent(
        new CustomEvent('UATO_API_RESPONSE', {
          detail: {
            type: 'subjects',
            data: subjects,
          },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('UATO_API_RESPONSE', {
          detail: {
            type: 'subjects',
            error: 'Could not find subjects data in localStorage. Please refresh the university page first.',
          },
        }),
      );
    }
  };

  // Listen for fetch subjects request
  window.addEventListener('UATO_FETCH_SUBJECTS', () => {
    console.log('[Uato Naext] Received request to fetch subjects in page context');
    handleSubjectsRequest();
  });

  // Listen for course redirection request
  window.addEventListener('UATO_COURSE_REDIRECT', event => {
    const { courseId } = event.detail || {};
    if (courseId) {
      console.log(`[Uato Naext] Received request to redirect to course ${courseId}`);
      handleCourseRedirection(courseId);
    }
  });

  // Check immediately for subjects when script loads
  const initialSubjects = getSubjectsFromStorage();
  if (initialSubjects) {
    console.log('[Uato Naext] Found subjects during initialization');
    window.dispatchEvent(
      new CustomEvent('UATO_API_RESPONSE', {
        detail: {
          type: 'subjects',
          data: initialSubjects,
        },
      }),
    );
  }

  // Monitor for changes to localStorage that might contain subjects
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    originalSetItem.call(this, key, value);

    if (key.startsWith('COURSES-')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.data) {
          console.log('[Uato Naext] Detected new subjects data in localStorage');
          window.dispatchEvent(
            new CustomEvent('UATO_API_RESPONSE', {
              detail: {
                type: 'subjects',
                data: parsed.data,
              },
            }),
          );
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  };

  // Periodically clean up old captured headers
  setInterval(() => {
    if (capturedHeaders && lastCaptureTime) {
      const now = new Date();
      const timeSinceCapture = now.getTime() - lastCaptureTime.getTime();

      // Clear headers older than 1 minute
      if (timeSinceCapture > 60000) {
        console.log('[Uato Naext] Clearing old captured headers');
        capturedHeaders = null;
        lastCaptureTime = null;
      }
    }
  }, 30000); // Check every 30 seconds
})();

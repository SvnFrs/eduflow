(() => {
  console.log('[Uato Naext] API handler loaded in page context');

  // Function to get subjects from localStorage
  const getSubjectsFromStorage = () => {
    try {
      const semester = localStorage.getItem('SELECTED_SEMESTER');
      if (!semester) {
        console.log('[Uato Naext] No semester found in localStorage');
        return null;
      }

      // Try to get from app's cache
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
      // Send the data to content script
      window.dispatchEvent(
        new CustomEvent('UATO_API_RESPONSE', {
          detail: {
            type: 'subjects',
            data: subjects,
          },
        }),
      );
    } else {
      // If no subjects found, send error
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

  // Also monitor for changes to localStorage that might contain subjects
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    // Call original function first
    originalSetItem.call(this, key, value);

    // Check if this is subject data
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Ignore parsing errors
      }
    }
  };
})();

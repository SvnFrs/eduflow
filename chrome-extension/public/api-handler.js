(() => {
  console.log('[EduFlow] API handler loaded in page context');

  // Function to get JWT token
  const getJwtToken = () => {
    try {
      return localStorage.getItem('eduflowToken');
    } catch (error) {
      console.error('[EduFlow] Error getting JWT token:', error);
      return null;
    }
  };

  // Function to get user identity
  const getUserIdentity = () => {
    try {
      const identify = localStorage.getItem('identify');
      return identify ? JSON.parse(identify) : null;
    } catch (error) {
      console.error('[EduFlow] Error getting user identity:', error);
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
    if (typeof request === 'string' && request.includes('fugw-edunext.fpt.edu.vn/fu')) {
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
        console.log('[EduFlow] Captured headers from legitimate request:', {
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
        console.log('[EduFlow] Captured headers from XHR request:', {
          'x-date': headerCapture['x-date'],
          'x-expiration': headerCapture['x-expiration'],
        });
      }
    }

    return originalXHRSetRequestHeader.call(this, name, value);
  };

  // Function to check if markdown editor is present
  const hasMarkdownEditor = () => {
    const editor = document.querySelector('.comment-editor textarea.w-md-editor-text-input');
    return !!editor;
  };

  // Function to check if grading modal is present
  const hasGradingModal = () => {
    const modal = document.querySelector('.MuiDialogContent-root');
    return modal && modal.innerText.includes('You are grading for groupmates');
  };

  // Function to auto-grade groupmates
  const autoGradeGroupmates = () => {
    return new Promise((resolve, reject) => {
      const modal = document.querySelector('.MuiDialogContent-root');

      if (!modal || !modal.innerText.includes('You are grading for groupmates')) {
        reject(new Error('Grading modal not found'));
        return;
      }

      console.log('[EduFlow] 🎯 Grading modal detected. Waiting for content to load...');

      // Wait until stars are rendered (poll every 300ms, max 10s)
      let checkCount = 0;
      const maxChecks = 30;

      const interval = setInterval(() => {
        const allRatingGroups = modal.querySelectorAll('.MuiRating-root');

        if (allRatingGroups.length > 0) {
          console.log(`[EduFlow] 🟢 Found ${allRatingGroups.length} rating groups. Auto grading...`);

          try {
            // Grade all with 5 stars
            allRatingGroups.forEach((rating, index) => {
              const stars = rating.querySelectorAll('input[type="radio"]');
              const maxStar = Array.from(stars).find(star => star.value === '5');

              if (maxStar) {
                maxStar.click();
                console.log(`[EduFlow] Rated group ${index + 1} with 5 stars`);
              }
            });

            console.log('[EduFlow] ✅ Auto graded all teammates with 5 stars.');

            // Wait a bit for the UI to update, then submit
            setTimeout(() => {
              const gradeButton = document.querySelector('button[type="button"] span[title="Grade"]')?.parentElement;

              if (gradeButton) {
                console.log('[EduFlow] 📝 Submitting grades...');
                gradeButton.click();

                // Wait for submission to complete
                setTimeout(() => {
                  resolve({
                    success: true,
                    gradedCount: allRatingGroups.length,
                    message: `Successfully graded ${allRatingGroups.length} teammates with 5 stars`,
                  });
                }, 1000);
              } else {
                reject(new Error('Grade submit button not found'));
              }
            }, 500);

            clearInterval(interval);
          } catch (error) {
            clearInterval(interval);
            reject(error);
          }
        }

        if (++checkCount >= maxChecks) {
          clearInterval(interval);
          reject(new Error('Timeout: Could not find rating stars in time'));
        }
      }, 300);
    });
  };

  // Function to check markdown editor and respond
  const checkMarkdownEditor = () => {
    const hasEditor = hasMarkdownEditor();
    console.log('[EduFlow] Markdown editor check:', hasEditor);

    window.dispatchEvent(
      new CustomEvent('EDUFLOW_API_RESPONSE', {
        detail: {
          type: 'markdown_editor_check',
          hasEditor: hasEditor,
        },
      }),
    );
  };

  // Function to check grading modal and respond
  const checkGradingModal = () => {
    const hasModal = hasGradingModal();
    console.log('[EduFlow] Grading modal check:', hasModal);

    window.dispatchEvent(
      new CustomEvent('EDUFLOW_API_RESPONSE', {
        detail: {
          type: 'grading_modal_check',
          hasModal: hasModal,
        },
      }),
    );
  };

  // Function to handle auto grading request
  const handleAutoGrading = async () => {
    try {
      const result = await autoGradeGroupmates();
      window.dispatchEvent(
        new CustomEvent('EDUFLOW_API_RESPONSE', {
          detail: {
            type: 'auto_grading_complete',
            data: result,
          },
        }),
      );
    } catch (error) {
      console.error('[EduFlow] Error auto grading:', error);
      window.dispatchEvent(
        new CustomEvent('EDUFLOW_API_RESPONSE', {
          detail: {
            type: 'auto_grading_error',
            error: error.message || 'Failed to auto grade teammates',
          },
        }),
      );
    }
  };

  // Improved function to find and fill the discussion input field
  const fillDiscussionInput = text => {
    try {
      console.log('[EduFlow] Attempting to fill discussion input with improved method');

      // Find the textarea using the specific selector
      const ta = document.querySelector('.comment-editor textarea.w-md-editor-text-input');

      if (!ta) {
        console.log('[EduFlow] Discussion textarea not found');
        return false;
      }

      console.log('[EduFlow] Found textarea, applying React-friendly input method');

      // Get React's real value setter
      const proto = Object.getPrototypeOf(ta);
      const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;

      // Call that setter so both DOM + React state update
      valueSetter.call(ta, text);

      // Dispatch native input event
      ta.dispatchEvent(new Event('input', { bubbles: true }));

      // Dispatch change if needed
      ta.dispatchEvent(new Event('change', { bubbles: true }));

      // Focus the textarea
      ta.focus();

      console.log('[EduFlow] Successfully filled discussion input with AI response using React method');
      return true;
    } catch (error) {
      console.error('[EduFlow] Error filling discussion input:', error);
      return false;
    }
  };

  // Function to handle filling editor with text
  const handleFillEditor = text => {
    try {
      const filled = fillDiscussionInput(text);

      if (filled) {
        window.dispatchEvent(
          new CustomEvent('EDUFLOW_API_RESPONSE', {
            detail: {
              type: 'editor_filled',
              data: { success: true },
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('EDUFLOW_API_RESPONSE', {
            detail: {
              type: 'editor_fill_error',
              error: 'Could not find or fill discussion input field',
            },
          }),
        );
      }
    } catch (error) {
      console.error('[EduFlow] Error handling fill editor:', error);
      window.dispatchEvent(
        new CustomEvent('EDUFLOW_API_RESPONSE', {
          detail: {
            type: 'editor_fill_error',
            error: error.message || 'Failed to fill editor',
          },
        }),
      );
    }
  };

  // Function to get course info from quiz URL or localStorage
  const getCourseInfoFromQuizUrl = () => {
    try {
      const currentUrl = window.location.href;

      // Extract classId from URL if available
      const classIdMatch = currentUrl.match(/classId=(\d+)/);
      if (classIdMatch) {
        const classId = parseInt(classIdMatch[1], 10);
        console.log('[EduFlow] Found classId in URL:', classId);
      }

      // Try to get course info from localStorage using any available courses
      const semester = localStorage.getItem('SELECTED_SEMESTER');
      if (semester) {
        const key = 'COURSES-' + semester;
        const cached = localStorage.getItem(key);

        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.data && parsed.data.length > 0) {
              // For quiz pages, we'll use the first available course as fallback
              // since we can't easily match the exact course from the quiz URL
              const course = parsed.data[0];
              console.log('[EduFlow] Using course info for quiz:', course);
              return {
                ...course,
                title: course.title.split('_')[0], // Remove everything after underscore if exists
              };
            }
          } catch (e) {
            console.error('[EduFlow] Error parsing courses from localStorage:', e);
          }
        }
      }

      // Fallback: create a dummy course object
      return {
        title: 'Current Course',
        courseId: 0,
        courseCode: 'UNKNOWN',
      };
    } catch (error) {
      console.error('[EduFlow] Error getting course info from quiz URL:', error);
      return {
        title: 'Current Course',
        courseId: 0,
        courseCode: 'UNKNOWN',
      };
    }
  };

  // Function to extract quiz information from URL
  const getQuizInfoFromUrl = () => {
    try {
      const currentUrl = window.location.href;

      // Check if we're on a quiz page
      const quizMatch = currentUrl.match(/\/course\/activity\/question\?id=(\d+)&classId=(\d+)&sessionId=(\d+)/);
      if (!quizMatch) {
        return null;
      }

      const [, id, classId, sessionId] = quizMatch;

      // Extract quiz content from the page
      const contentElement = document.querySelector('.wrap-entry-lesson-content .styled p');
      const content = contentElement ? contentElement.textContent.trim() : 'Quiz content not found';

      // Check if markdown editor is available
      const hasEditor = hasMarkdownEditor();

      // Check if grading modal is available
      const hasModal = hasGradingModal();

      console.log('[EduFlow] Detected quiz from URL:', {
        id,
        classId,
        sessionId,
        content,
        hasMarkdownEditor: hasEditor,
        hasGradingModal: hasModal,
      });

      return {
        id,
        classId,
        sessionId,
        content,
        hasMarkdownEditor: hasEditor,
        hasGradingModal: hasModal,
      };
    } catch (error) {
      console.error('[EduFlow] Error extracting quiz info:', error);
      return null;
    }
  };

  // Function to detect current course from URL
  const getCurrentCourseFromUrl = () => {
    try {
      const currentUrl = window.location.href;

      // Check if we're on a course page
      const courseMatch = currentUrl.match(/\/course\?id=(\d+)/);
      if (!courseMatch) {
        return null;
      }

      const courseId = parseInt(courseMatch[1], 10);
      console.log('[EduFlow] Detected course ID from URL:', courseId);

      // Get the courses from localStorage
      const semester = localStorage.getItem('SELECTED_SEMESTER');
      if (!semester) {
        console.log('[EduFlow] No semester found in localStorage');
        return null;
      }

      const key = 'COURSES-' + semester;
      const cached = localStorage.getItem(key);

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.data) {
            // Find the course that matches the ID
            const course = parsed.data.find(c => c.courseId === courseId);
            if (course) {
              console.log('[EduFlow] Found matching course:', course);
              return {
                ...course,
                title: course.title.split('_')[0], // Remove everything after underscore if exists
              };
            } else {
              console.log('[EduFlow] No course found with ID:', courseId);
            }
          }
        } catch (e) {
          console.error('[EduFlow] Error parsing courses from localStorage:', e);
        }
      }

      return null;
    } catch (error) {
      console.error('[EduFlow] Error detecting current course:', error);
      return null;
    }
  };

  // Function to check current page type
  const getCurrentPageType = () => {
    try {
      const currentUrl = window.location.href;

      if (currentUrl.includes('/course/activity/question?id=')) {
        return 'quiz';
      } else if (currentUrl.includes('/home')) {
        return 'homepage';
      } else if (currentUrl.includes('/course?id=')) {
        return 'course';
      } else {
        return 'other';
      }
    } catch (error) {
      console.error('[EduFlow] Error checking page type:', error);
      return 'other';
    }
  };

  // Function to navigate to discussion page
  const navigateToDiscussion = () => {
    try {
      console.log('[EduFlow] Looking for DISCUSS button');

      // Use the improved selector method
      const discussBtn = Array.from(document.querySelectorAll('button[role="tab"]')).find(
        el => el.textContent && el.textContent.trim().startsWith('DISCUSS'),
      );

      if (discussBtn) {
        console.log('[EduFlow] Found DISCUSS button, clicking...');
        discussBtn.click();

        // Send success response
        window.dispatchEvent(
          new CustomEvent('EDUFLOW_API_RESPONSE', {
            detail: {
              type: 'discussion_redirect',
              data: { success: true, message: 'Successfully navigated to discussion' },
            },
          }),
        );
      } else {
        console.log('[EduFlow] DISCUSS button not found');

        // Log all tab buttons for debugging
        const allTabButtons = Array.from(document.querySelectorAll('button[role="tab"]'));
        console.log(
          '[EduFlow] All tab buttons found:',
          allTabButtons.map(btn => btn.textContent?.trim()),
        );

        // Send error response
        window.dispatchEvent(
          new CustomEvent('EDUFLOW_API_RESPONSE', {
            detail: {
              type: 'discussion_redirect',
              error:
                'DISCUSS button not found on the page. Make sure you are on a quiz page with discussion available.',
            },
          }),
        );
      }
    } catch (error) {
      console.error('[EduFlow] Error navigating to discussion:', error);

      window.dispatchEvent(
        new CustomEvent('EDUFLOW_API_RESPONSE', {
          detail: {
            type: 'discussion_redirect',
            error: error.message || 'Failed to navigate to discussion',
          },
        }),
      );
    }
  };

  // Function to handle current course request
  const handleCurrentCourseRequest = () => {
    const pageType = getCurrentPageType();
    let currentCourse = null;
    let currentQuiz = null;

    if (pageType === 'quiz') {
      currentQuiz = getQuizInfoFromUrl();
      // Always provide course info for quiz pages
      currentCourse = getCourseInfoFromQuizUrl();
      console.log('[EduFlow] Quiz page detected - currentCourse:', currentCourse, 'currentQuiz:', currentQuiz);
    } else if (pageType === 'course') {
      currentCourse = getCurrentCourseFromUrl();
      console.log('[EduFlow] Course page detected - currentCourse:', currentCourse);
    }

    window.dispatchEvent(
      new CustomEvent('EDUFLOW_API_RESPONSE', {
        detail: {
          type: 'current_course',
          data: {
            pageType,
            currentCourse,
            currentQuiz,
          },
        },
      }),
    );
  };

  // Function to handle course redirection (simplified)
  const handleCourseRedirection = async courseId => {
    try {
      console.log(`[EduFlow] Handling redirection for course ${courseId}`);

      // Create the direct URL without needing to fetch class information
      const redirectUrl = `https://fu-edunext.fpt.edu.vn/course?id=${courseId}`;

      console.log(`[EduFlow] Redirecting directly to: ${redirectUrl}`);

      // Send the redirection info back to content script
      window.dispatchEvent(
        new CustomEvent('EDUFLOW_API_RESPONSE', {
          detail: {
            type: 'course_redirect',
            data: {
              courseId,
              redirectUrl,
            },
          },
        }),
      );
    } catch (error) {
      console.error('[EduFlow] Error in course redirection:', error);

      window.dispatchEvent(
        new CustomEvent('EDUFLOW_API_RESPONSE', {
          detail: {
            type: 'course_redirect',
            error: error.message || 'Failed to create redirect URL',
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
        console.log('[EduFlow] No semester found in localStorage');
        return null;
      }

      const key = 'COURSES-' + semester;
      const cached = localStorage.getItem(key);

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.data) {
            console.log('[EduFlow] Found subjects in localStorage:', parsed.data.length);
            return parsed.data;
          }
        } catch (e) {
          console.error('[EduFlow] Error parsing subjects from localStorage:', e);
        }
      }

      return null;
    } catch (error) {
      console.error('[EduFlow] Error accessing localStorage:', error);
      return null;
    }
  };

  // Function to handle the subjects request
  const handleSubjectsRequest = () => {
    const subjects = getSubjectsFromStorage();

    if (subjects) {
      window.dispatchEvent(
        new CustomEvent('EDUFLOW_API_RESPONSE', {
          detail: {
            type: 'subjects',
            data: subjects,
          },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('EDUFLOW_API_RESPONSE', {
          detail: {
            type: 'subjects',
            error: 'Could not find subjects data in localStorage. Please refresh the university page first.',
          },
        }),
      );
    }
  };

  // Listen for fetch subjects request
  window.addEventListener('EDUFLOW_FETCH_SUBJECTS', () => {
    console.log('[EduFlow] Received request to fetch subjects in page context');
    handleSubjectsRequest();
  });

  // Listen for current course request
  window.addEventListener('EDUFLOW_GET_CURRENT_COURSE', () => {
    console.log('[EduFlow] Received request to get current course in page context');
    handleCurrentCourseRequest();
  });

  // Listen for course redirection request
  window.addEventListener('EDUFLOW_COURSE_REDIRECT', event => {
    const { courseId } = event.detail || {};
    if (courseId) {
      console.log(`[EduFlow] Received request to redirect to course ${courseId}`);
      handleCourseRedirection(courseId);
    }
  });

  // Listen for discussion navigation request
  window.addEventListener('EDUFLOW_NAVIGATE_TO_DISCUSSION', () => {
    console.log('[EduFlow] Received request to navigate to discussion in page context');
    navigateToDiscussion();
  });

  // Listen for markdown editor check request
  window.addEventListener('EDUFLOW_CHECK_MARKDOWN_EDITOR', () => {
    console.log('[EduFlow] Received request to check markdown editor');
    checkMarkdownEditor();
  });

  // Listen for grading modal check request
  window.addEventListener('EDUFLOW_CHECK_GRADING_MODAL', () => {
    console.log('[EduFlow] Received request to check grading modal');
    checkGradingModal();
  });

  // Listen for auto grading request
  window.addEventListener('EDUFLOW_AUTO_GRADE_TEAMMATES', () => {
    console.log('[EduFlow] Received request to auto grade teammates');
    handleAutoGrading();
  });

  // Listen for fill editor request
  window.addEventListener('EDUFLOW_FILL_EDITOR', event => {
    const { text } = event.detail || {};
    if (text) {
      console.log('[EduFlow] Received request to fill editor with text');
      handleFillEditor(text);
    }
  });

  // Auto-grading observer that works continuously
  const setupAutoGradingObserver = () => {
    console.log('[EduFlow] Setting up auto-grading observer...');

    const observer = new MutationObserver(mutations => {
      // Check if a grading modal appeared
      const modal = document.querySelector('.MuiDialogContent-root');

      if (modal && modal.innerText.includes('You are grading for groupmates')) {
        console.log('[EduFlow] 🎯 Auto-grading observer detected grading modal');

        // Notify about modal detection
        window.dispatchEvent(
          new CustomEvent('EDUFLOW_API_RESPONSE', {
            detail: {
              type: 'grading_modal_detected',
              data: { detected: true },
            },
          }),
        );

        // Auto-trigger grading after a short delay
        setTimeout(() => {
          handleAutoGrading();
        }, 500);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[EduFlow] Auto-grading observer active');
  };

  // Rest of the initialization code...
  // Check immediately for subjects when script loads
  const initialSubjects = getSubjectsFromStorage();
  if (initialSubjects) {
    console.log('[EduFlow] Found subjects during initialization');
    window.dispatchEvent(
      new CustomEvent('EDUFLOW_API_RESPONSE', {
        detail: {
          type: 'subjects',
          data: initialSubjects,
        },
      }),
    );
  }

  // Check immediately for current course when script loads
  const initialPageType = getCurrentPageType();
  let initialCurrentCourse = null;
  let initialCurrentQuiz = null;

  if (initialPageType === 'quiz') {
    initialCurrentQuiz = getQuizInfoFromUrl();
    initialCurrentCourse = getCourseInfoFromQuizUrl(); // Always get course info for quiz pages
  } else if (initialPageType === 'course') {
    initialCurrentCourse = getCurrentCourseFromUrl();
  }

  if (initialPageType || initialCurrentCourse || initialCurrentQuiz) {
    console.log('[EduFlow] Found page info during initialization:', {
      pageType: initialPageType,
      currentCourse: initialCurrentCourse,
      currentQuiz: initialCurrentQuiz,
    });
    window.dispatchEvent(
      new CustomEvent('EDUFLOW_API_RESPONSE', {
        detail: {
          type: 'current_course',
          data: {
            pageType: initialPageType,
            currentCourse: initialCurrentCourse,
            currentQuiz: initialCurrentQuiz,
          },
        },
      }),
    );
  }

  // Setup auto-grading observer for quiz pages
  if (initialPageType === 'quiz') {
    setupAutoGradingObserver();
  }

  // Monitor for URL changes (for SPAs)
  let currentUrl = window.location.href;
  const checkUrlChange = () => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('[EduFlow] URL changed, checking current course');

      // Setup auto-grading observer if we're now on a quiz page
      if (getCurrentPageType() === 'quiz') {
        setupAutoGradingObserver();
      }

      // Wait a bit for the page to load
      setTimeout(() => {
        handleCurrentCourseRequest();
      }, 500);
    }
  };

  // Check for URL changes periodically
  setInterval(checkUrlChange, 1000);

  // Also listen for popstate events (back/forward buttons)
  window.addEventListener('popstate', () => {
    console.log('[EduFlow] Popstate event, checking current course');
    setTimeout(() => {
      handleCurrentCourseRequest();

      // Setup auto-grading observer if we're on a quiz page
      if (getCurrentPageType() === 'quiz') {
        setupAutoGradingObserver();
      }
    }, 500);
  });

  // Monitor for changes to localStorage that might contain subjects
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    originalSetItem.call(this, key, value);

    if (key.startsWith('COURSES-')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.data) {
          console.log('[EduFlow] Detected new subjects data in localStorage');
          window.dispatchEvent(
            new CustomEvent('EDUFLOW_API_RESPONSE', {
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

  // Monitor for DOM changes that might indicate the quiz content or markdown editor has loaded
  const quizObserver = new MutationObserver(mutations => {
    let shouldCheckQuiz = false;

    mutations.forEach(mutation => {
      // Check if quiz content elements or markdown editor were added
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (
              element.classList.contains('wrap-entry-lesson-content') ||
              element.querySelector('.wrap-entry-lesson-content') ||
              element.classList.contains('styled') ||
              element.querySelector('.styled') ||
              element.classList.contains('comment-editor') ||
              element.querySelector('.comment-editor') ||
              element.classList.contains('w-md-editor') ||
              element.querySelector('.w-md-editor')
            ) {
              shouldCheckQuiz = true;
              break;
            }
          }
        }
      }
    });

    if (shouldCheckQuiz && getCurrentPageType() === 'quiz') {
      console.log('[EduFlow] Quiz content or editor DOM changes detected, updating quiz info');
      setTimeout(() => {
        handleCurrentCourseRequest();
      }, 500);
    }
  });

  // Start observing DOM changes for quiz content and editor
  quizObserver.observe(document, {
    childList: true,
    subtree: true,
  });

  // Periodically clean up old captured headers
  setInterval(() => {
    if (capturedHeaders && lastCaptureTime) {
      const now = new Date();
      const timeSinceCapture = now.getTime() - lastCaptureTime.getTime();

      // Clear headers older than 1 minute
      if (timeSinceCapture > 60000) {
        console.log('[EduFlow] Clearing old captured headers');
        capturedHeaders = null;
        lastCaptureTime = null;
      }
    }
  }, 30000); // Check every 30 seconds

  console.log('[EduFlow] API handler initialization complete with quiz detection, AI integration, and auto-grading');
})();

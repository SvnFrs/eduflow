console.log('[EduFlow] Content script loaded');

// Function to inject the script as early as possible
const injectScript = () => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected-fetch.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
  console.log('[EduFlow] Fetch interceptor injected');
};

// Inject an API handler script
const injectApiHandler = () => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('api-handler.js');
  script.onload = () => console.log('[EduFlow] API handler injected');
  (document.head || document.documentElement).appendChild(script);
};

// Function to call Gemini API from content script
const callGeminiAPI = async (quizContent: string, courseTitle: string): Promise<string> => {
  const GEMINI_API_KEY = '';
  const prompt = `Please generate a short answer based on the following quiz content and course: ${quizContent}, the course is ${courseTitle}`;

  try {
    console.log('[EduFlow] Making Gemini API request from content script...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      },
    );

    console.log('[EduFlow] Gemini API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EduFlow] Gemini API error response:', errorText);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[EduFlow] Gemini API response data:', data);

    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response format from Gemini API');
    }
  } catch (error) {
    console.error('[EduFlow] Error calling Gemini API from content script:', error);
    throw error;
  }
};

// Function to generate AI response and fill input
const generateAndFillAiResponse = async (quizContent: string, courseTitle: string) => {
  try {
    console.log('[EduFlow] Starting AI response generation...');
    console.log('[EduFlow] Quiz content:', quizContent);
    console.log('[EduFlow] Course title:', courseTitle);

    // First check if the markdown editor is present by asking the page context
    const hasEditor = await new Promise<boolean>(resolve => {
      const checkEditor = () => {
        window.dispatchEvent(new CustomEvent('EDUFLOW_CHECK_MARKDOWN_EDITOR'));
      };

      const handleEditorCheck = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.type === 'markdown_editor_check') {
          window.removeEventListener('EDUFLOW_API_RESPONSE', handleEditorCheck);
          resolve(customEvent.detail.hasEditor || false);
        }
      };

      window.addEventListener('EDUFLOW_API_RESPONSE', handleEditorCheck);
      checkEditor();

      // Timeout after 3 seconds
      setTimeout(() => {
        window.removeEventListener('EDUFLOW_API_RESPONSE', handleEditorCheck);
        resolve(false);
      }, 3000);
    });

    if (!hasEditor) {
      throw new Error('Markdown editor not found. Please navigate to the discussion page first.');
    }

    // Call Gemini API from content script
    const aiResponse = await callGeminiAPI(quizContent, courseTitle);
    console.log('[EduFlow] Received AI response:', aiResponse);

    // Send the response to page context to fill the editor
    window.dispatchEvent(
      new CustomEvent('EDUFLOW_FILL_EDITOR', {
        detail: { text: aiResponse },
      }),
    );

    // Send success response to popup
    chrome.runtime.sendMessage({
      type: 'AI_RESPONSE_COMPLETE',
      data: { success: true, response: aiResponse },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[EduFlow] Error generating AI response:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate AI response';

    chrome.runtime.sendMessage({
      type: 'AI_RESPONSE_COMPLETE',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};

// Function to auto-grade teammates
const autoGradeTeammates = async () => {
  try {
    console.log('[EduFlow] Starting auto-grading process...');

    // Check if grading modal is present
    const hasModal = await new Promise<boolean>(resolve => {
      const checkModal = () => {
        window.dispatchEvent(new CustomEvent('EDUFLOW_CHECK_GRADING_MODAL'));
      };

      const handleModalCheck = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.type === 'grading_modal_check') {
          window.removeEventListener('EDUFLOW_API_RESPONSE', handleModalCheck);
          resolve(customEvent.detail.hasModal || false);
        }
      };

      window.addEventListener('EDUFLOW_API_RESPONSE', handleModalCheck);
      checkModal();

      // Timeout after 3 seconds
      setTimeout(() => {
        window.removeEventListener('EDUFLOW_API_RESPONSE', handleModalCheck);
        resolve(false);
      }, 3000);
    });

    if (!hasModal) {
      throw new Error('Grading modal not found. Please open the grading modal first.');
    }

    // Trigger auto-grading
    window.dispatchEvent(new CustomEvent('EDUFLOW_AUTO_GRADE_TEAMMATES'));

    // Send success response to popup
    chrome.runtime.sendMessage({
      type: 'AUTO_GRADING_COMPLETE',
      data: { success: true, message: 'Auto-grading process started' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[EduFlow] Error auto-grading teammates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to auto-grade teammates';

    chrome.runtime.sendMessage({
      type: 'AUTO_GRADING_COMPLETE',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};

// Inject scripts
injectScript();
injectApiHandler();

// Listen for custom event from injected script
window.addEventListener('EDUFLOW_JWT_TOKEN', (event: Event) => {
  const customEvent = event as CustomEvent;
  const token = customEvent.detail?.token;

  if (token) {
    console.log('[EduFlow] Retrieved JWT Token via CustomEvent');

    // Store in chrome.storage for persistence
    chrome.storage.local.set({ jwtToken: token }, () => {
      console.log('[EduFlow] Token stored in extension storage');
    });

    // Also notify the background script
    chrome.runtime.sendMessage({ type: 'JWT_TOKEN_UPDATED', token });
  }
});

// Listen for API response events from the page context
window.addEventListener('EDUFLOW_API_RESPONSE', (event: Event) => {
  const customEvent = event as CustomEvent;
  const { data, error, type } = customEvent.detail || {};

  if (type === 'subjects') {
    console.log('[EduFlow] Received subjects data from page context');
    chrome.runtime.sendMessage({
      type: 'SUBJECTS_FETCHED',
      data,
      error,
      timestamp: new Date().toISOString(),
    });
  } else if (type === 'course_redirect') {
    console.log('[EduFlow] Received course redirect data from page context');
    chrome.runtime.sendMessage({
      type: 'COURSE_REDIRECT_READY',
      data,
      error,
      timestamp: new Date().toISOString(),
    });
  } else if (type === 'current_course') {
    console.log('[EduFlow] Received current course data from page context');
    chrome.runtime.sendMessage({
      type: 'CURRENT_COURSE_INFO',
      data,
      error,
      timestamp: new Date().toISOString(),
    });
  } else if (type === 'discussion_redirect') {
    console.log('[EduFlow] Received discussion redirect result from page context');
    chrome.runtime.sendMessage({
      type: 'DISCUSSION_REDIRECT_COMPLETE',
      data,
      error,
      timestamp: new Date().toISOString(),
    });
  } else if (type === 'editor_filled') {
    console.log('[EduFlow] Editor filled successfully');
    chrome.runtime.sendMessage({
      type: 'AI_RESPONSE_COMPLETE',
      data: { success: true },
      timestamp: new Date().toISOString(),
    });
  } else if (type === 'editor_fill_error') {
    console.log('[EduFlow] Error filling editor');
    chrome.runtime.sendMessage({
      type: 'AI_RESPONSE_COMPLETE',
      error: error || 'Failed to fill editor',
      timestamp: new Date().toISOString(),
    });
  } else if (type === 'grading_modal_detected') {
    console.log('[EduFlow] Grading modal detected automatically');
    chrome.runtime.sendMessage({
      type: 'GRADING_MODAL_DETECTED',
      data,
      timestamp: new Date().toISOString(),
    });
  } else if (type === 'auto_grading_complete') {
    console.log('[EduFlow] Auto-grading completed successfully');
    chrome.runtime.sendMessage({
      type: 'AUTO_GRADING_COMPLETE',
      data,
      timestamp: new Date().toISOString(),
    });
  } else if (type === 'auto_grading_error') {
    console.log('[EduFlow] Auto-grading error');
    chrome.runtime.sendMessage({
      type: 'AUTO_GRADING_COMPLETE',
      error: error || 'Failed to auto-grade teammates',
      timestamp: new Date().toISOString(),
    });
  }
});

// Function to check current course info
const checkCurrentCourse = () => {
  console.log('[EduFlow] Requesting current course info');
  window.dispatchEvent(new CustomEvent('EDUFLOW_GET_CURRENT_COURSE'));
};

// Function to navigate to discussion
const navigateToDiscussion = () => {
  console.log('[EduFlow] Requesting navigation to discussion');
  window.dispatchEvent(new CustomEvent('EDUFLOW_NAVIGATE_TO_DISCUSSION'));
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUBJECTS') {
    console.log('[EduFlow] Received request to fetch subjects');
    window.dispatchEvent(new CustomEvent('EDUFLOW_FETCH_SUBJECTS'));
    sendResponse({ status: 'processing' });
    return true;
  } else if (message.type === 'REDIRECT_TO_COURSE') {
    console.log('[EduFlow] Received request to redirect to course:', message.courseId);
    window.dispatchEvent(
      new CustomEvent('EDUFLOW_COURSE_REDIRECT', {
        detail: { courseId: message.courseId },
      }),
    );
    sendResponse({ status: 'processing' });
    return true;
  } else if (message.type === 'GET_CURRENT_COURSE') {
    console.log('[EduFlow] Received request to get current course');
    checkCurrentCourse();
    sendResponse({ status: 'processing' });
    return true;
  } else if (message.type === 'NAVIGATE_TO_DISCUSSION') {
    console.log('[EduFlow] Received request to navigate to discussion');
    navigateToDiscussion();
    sendResponse({ status: 'processing' });
    return true;
  } else if (message.type === 'GENERATE_AI_RESPONSE') {
    console.log('[EduFlow] Received request to generate AI response');
    const { quizContent, courseTitle } = message;
    if (quizContent && courseTitle) {
      generateAndFillAiResponse(quizContent, courseTitle);
      sendResponse({ status: 'processing' });
    } else {
      sendResponse({ status: 'error', error: 'Missing quiz content or course title' });
    }
    return true;
  } else if (message.type === 'AUTO_GRADE_TEAMMATES') {
    console.log('[EduFlow] Received request to auto-grade teammates');
    autoGradeTeammates();
    sendResponse({ status: 'processing' });
    return true;
  }
});

// Monitor URL changes for single-page application behavior
let currentUrl = window.location.href;

const handleUrlChange = () => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    console.log('[EduFlow] URL changed in content script:', currentUrl);

    // Wait a moment for the page to settle, then check current course
    setTimeout(() => {
      checkCurrentCourse();
    }, 1000);
  }
};

// Check for URL changes periodically
setInterval(handleUrlChange, 2000);

// Listen for navigation events
window.addEventListener('popstate', () => {
  console.log('[EduFlow] Popstate event detected');
  setTimeout(() => {
    checkCurrentCourse();
  }, 1000);
});

// Listen for pushstate/replacestate (for SPAs)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function (...args) {
  originalPushState.apply(this, args);
  console.log('[EduFlow] PushState detected');
  setTimeout(() => {
    checkCurrentCourse();
  }, 1000);
};

history.replaceState = function (...args) {
  originalReplaceState.apply(this, args);
  console.log('[EduFlow] ReplaceState detected');
  setTimeout(() => {
    checkCurrentCourse();
  }, 1000);
};

// Check current course when content script loads
setTimeout(() => {
  checkCurrentCourse();
}, 2000);

// Check if there's already a token in storage
chrome.storage.local.get(['jwtToken'], result => {
  if (result.jwtToken) {
    console.log('[EduFlow] Retrieved token from storage');
  }
});

// Listen for DOM changes that might indicate navigation
const observer = new MutationObserver(mutations => {
  let shouldCheck = false;

  mutations.forEach(mutation => {
    // Check if the page title changed (common indicator of navigation)
    if (mutation.type === 'childList' && mutation.target === document.head) {
      const titleElements = mutation.addedNodes;
      for (let i = 0; i < titleElements.length; i++) {
        if (titleElements[i].nodeName === 'TITLE') {
          shouldCheck = true;
          break;
        }
      }
    }

    // Check if main content areas changed
    if (
      mutation.type === 'childList' &&
      mutation.target instanceof Element &&
      (mutation.target.id.includes('main') ||
        mutation.target.id.includes('content') ||
        mutation.target.id.includes('app'))
    ) {
      shouldCheck = true;
    }
  });

  if (shouldCheck) {
    console.log('[EduFlow] DOM changes detected, checking current course');
    setTimeout(() => {
      checkCurrentCourse();
    }, 1500);
  }
});

// Start observing DOM changes
observer.observe(document, {
  childList: true,
  subtree: true,
});

console.log('[EduFlow] Content script initialization complete');

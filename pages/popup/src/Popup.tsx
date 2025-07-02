import { useState, useEffect } from 'react';
import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

interface Subject {
  title: string;
  courseId: number;
  courseCode: string;
}

interface CurrentCourse extends Subject {
  // Additional properties if needed
}

interface QuizInfo {
  id: string;
  classId: string;
  sessionId: string;
  content: string;
  hasMarkdownEditor: boolean;
  hasGradingModal?: boolean; // Add this field
}

type PageType = 'homepage' | 'course' | 'quiz' | 'other';

const Popup = () => {
  const theme = useStorage(exampleThemeStorage);
  const isLight = theme === 'light';
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentCourse, setCurrentCourse] = useState<CurrentCourse | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<QuizInfo | null>(null);
  const [pageType, setPageType] = useState<PageType>('other');
  const [loading, setLoading] = useState(false);
  const [redirectingCourseId, setRedirectingCourseId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [autoGrading, setAutoGrading] = useState(false);

  useEffect(() => {
    // Check if we're on the university site
    checkConnection();

    // Load cached data
    chrome.storage.local.get(['subjects', 'lastFetched', 'selectedSemester'], result => {
      if (result.subjects) {
        setSubjects(result.subjects);
      }

      if (result.lastFetched) {
        setLastFetched(new Date(result.lastFetched));
      }

      if (result.selectedSemester) {
        // Format semester name for display (e.g., "SUMMER2025" -> "Summer 2025")
        const formattedSemester = formatSemesterName(result.selectedSemester);
        setSemester(formattedSemester);
      }
    });

    // Request current course info when popup opens
    requestCurrentCourseInfo();

    // Listen for messages from content script
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageListener = (message: any) => {
      if (message.type === 'SUBJECTS_FETCHED') {
        if (message.data) {
          const processedSubjects = processSubjects(message.data);
          setSubjects(processedSubjects);
          setLastFetched(new Date());
          setLoading(false);

          const semesterFromCode = extractSemesterFromCode(processedSubjects);
          if (semesterFromCode) {
            setSemester(formatSemesterName(semesterFromCode));
            chrome.storage.local.set({ selectedSemester: semesterFromCode });
          }

          chrome.storage.local.set({
            subjects: processedSubjects,
            lastFetched: new Date().toISOString(),
          });
        } else if (message.error) {
          setError(message.error);
          setLoading(false);
        }
      } else if (message.type === 'COURSE_REDIRECT_READY') {
        if (message.data) {
          console.log('[EduFlow] Course redirect ready:', message.data);
          // Open the course in a new tab with the proper classId
          chrome.tabs.create({ url: message.data.redirectUrl });
          setRedirectingCourseId(null);
        } else if (message.error) {
          setError(`Failed to redirect: ${message.error}`);
          setRedirectingCourseId(null);
        }
      } else if (message.type === 'CURRENT_COURSE_INFO') {
        if (message.data) {
          console.log('[EduFlow] Current course info received:', message.data);
          setPageType(message.data.pageType || 'other');
          setCurrentCourse(message.data.currentCourse || null);
          setCurrentQuiz(message.data.currentQuiz || null);
        }
      } else if (message.type === 'DISCUSSION_REDIRECT_COMPLETE') {
        setDiscussionLoading(false);
        if (message.error) {
          setError(`Failed to navigate to discussion: ${message.error}`);
        } else {
          // After successful navigation, refresh the current page info
          setTimeout(() => {
            requestCurrentCourseInfo();
          }, 1500);
        }
      } else if (message.type === 'AI_RESPONSE_COMPLETE') {
        setAiGenerating(false);
        if (message.error) {
          setError(`Failed to generate AI response: ${message.error}`);
        }
      } else if (message.type === 'AUTO_GRADING_COMPLETE') {
        setAutoGrading(false);
        if (message.error) {
          setError(`Failed to auto-grade teammates: ${message.error}`);
        }
      } else if (message.type === 'GRADING_MODAL_DETECTED') {
        console.log('[EduFlow] Grading modal detected automatically');
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // Request current course info from content script
  const requestCurrentCourseInfo = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CURRENT_COURSE' }, response => {
          if (!response) {
            console.log('[EduFlow] Could not get current course info from content script');
          }
        });
      }
    } catch (error) {
      console.error('[EduFlow] Error requesting current course info:', error);
    }
  };

  // Process subjects to ensure they have all required fields and are sorted properly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processSubjects = (subjects: any[]): Subject[] => {
    return subjects
      .filter(subject => subject && subject.title && subject.courseId)
      .map(subject => ({
        title: subject.title.split('_')[0], // Remove everything after underscore if exists
        courseId: subject.courseId,
        courseCode: subject.courseCode || 'Unknown Code',
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  };

  // Extract semester from course codes (e.g., "MMA301 ↔ [SUMMER2025]")
  const extractSemesterFromCode = (subjects: Subject[]): string | null => {
    for (const subject of subjects) {
      const match = subject.courseCode.match(/\[([^\]]+)\]/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Format semester name (e.g., "SUMMER2025" -> "Summer 2025")
  const formatSemesterName = (semesterStr: string): string => {
    // Extract season and year
    const seasonMatch = semesterStr.match(/([A-Z]+)(\d+)/);
    if (!seasonMatch) return semesterStr;

    const [, season, year] = seasonMatch;
    const formattedSeason = season.charAt(0).toUpperCase() + season.slice(1).toLowerCase();

    return `${formattedSeason} ${year}`;
  };

  const checkConnection = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (tab?.url?.includes('fugw-edunext.fpt.edu.vn') || tab?.url?.includes('fu-edunext.fpt.edu.vn')) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (err) {
      console.error('Error checking connection:', err);
      setConnectionStatus('disconnected');
    }
  };

  const fetchSubjects = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get active tab to send message to content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      // Check if we're on the university site
      if (connectionStatus !== 'connected') {
        setError('Please navigate to the university website first');
        setLoading(false);
        return;
      }

      // Send message to content script to fetch subjects
      chrome.tabs.sendMessage(tabs[0].id, { type: 'FETCH_SUBJECTS' }, response => {
        if (!response) {
          setError('Could not communicate with page. Please make sure you are on the university website.');
          setLoading(false);
        }
      });

      // Timeout after 10 seconds if no response
      setTimeout(() => {
        if (loading) {
          setLoading(false);
          setError('Request timed out. Please try again or reload the university website.');
        }
      }, 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setLoading(false);
    }
  };

  const navigateToSubject = async (courseId: number) => {
    try {
      setRedirectingCourseId(courseId);
      setError(null);

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        // If not on university site, create new tab first
        const newTab = await chrome.tabs.create({ url: 'https://fu-edunext.fpt.edu.vn/' });
        if (newTab.id) {
          // Wait a bit for the page to load, then try to redirect
          setTimeout(() => {
            chrome.tabs.sendMessage(newTab.id!, {
              type: 'REDIRECT_TO_COURSE',
              courseId,
            });
          }, 3000);
        }
        return;
      }

      if (connectionStatus !== 'connected') {
        // Open university site first
        const newTab = await chrome.tabs.create({ url: 'https://fu-edunext.fpt.edu.vn/' });
        if (newTab.id) {
          // Wait for the page to load, then try to redirect
          setTimeout(() => {
            chrome.tabs.sendMessage(newTab.id!, {
              type: 'REDIRECT_TO_COURSE',
              courseId,
            });
          }, 3000);
        }
        return;
      }

      // Send message to content script to handle the redirection
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          type: 'REDIRECT_TO_COURSE',
          courseId,
        },
        response => {
          if (!response) {
            setError('Could not communicate with page. Please make sure you are on the university website.');
            setRedirectingCourseId(null);
          }
        },
      );

      // Timeout after 10 seconds
      setTimeout(() => {
        if (redirectingCourseId === courseId) {
          setRedirectingCourseId(null);
          setError('Redirection timed out. Please try again.');
        }
      }, 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate to subject');
      setRedirectingCourseId(null);
    }
  };

  const navigateToDiscussion = async () => {
    try {
      setDiscussionLoading(true);
      setError(null);

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script to click the discuss button
      chrome.tabs.sendMessage(tabs[0].id, { type: 'NAVIGATE_TO_DISCUSSION' }, response => {
        if (!response) {
          setError('Could not communicate with page. Please make sure you are on the quiz page.');
          setDiscussionLoading(false);
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (discussionLoading) {
          setDiscussionLoading(false);
          setError('Discussion navigation timed out. Please try again.');
        }
      }, 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate to discussion');
      setDiscussionLoading(false);
    }
  };

  const generateAiResponse = async () => {
    if (!currentQuiz || !currentCourse) {
      setError('Quiz or course information not available');
      return;
    }

    try {
      setAiGenerating(true);
      setError(null);

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script to generate and post AI response
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          type: 'GENERATE_AI_RESPONSE',
          quizContent: currentQuiz.content,
          courseTitle: currentCourse.title,
        },
        response => {
          if (!response || response.status === 'error') {
            setError(
              response?.error || 'Could not communicate with page. Please make sure you are on the discussion page.',
            );
            setAiGenerating(false);
          }
          // Success will be handled by the message listener
        },
      );

      // Timeout after 30 seconds for AI generation
      setTimeout(() => {
        if (aiGenerating) {
          setAiGenerating(false);
          setError('AI response generation timed out. Please try again.');
        }
      }, 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI response');
      setAiGenerating(false);
    }
  };

  const autoGradeTeammates = async () => {
    try {
      setAutoGrading(true);
      setError(null);

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      chrome.tabs.sendMessage(tabs[0].id, { type: 'AUTO_GRADE_TEAMMATES' }, response => {
        if (!response || response.status === 'error') {
          setError(response?.error || 'Could not communicate with page.');
          setAutoGrading(false);
        }
      });

      setTimeout(() => {
        if (autoGrading) {
          setAutoGrading(false);
          setError('Auto-grading timed out. Please try again.');
        }
      }, 15000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-grade teammates');
      setAutoGrading(false);
    }
  };

  const navigateToUniversity = () => {
    const url = 'https://fu-edunext.fpt.edu.vn/';
    chrome.tabs.create({ url });
  };

  const navigateToHomepage = () => {
    const url = 'https://fu-edunext.fpt.edu.vn/home';
    chrome.tabs.create({ url });
  };

  const formatLastFetched = () => {
    if (!lastFetched) return '';

    const now = new Date();
    const diffMs = now.getTime() - lastFetched.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  };

  const renderQuizView = () => {
    if (!currentQuiz) {
      return (
        <div className="current-course-not-found">
          <div className="quiz-icon">📝</div>
          <p className="current-course-title">Quiz Not Found</p>
          <p className="current-course-description">
            Could not identify the current quiz. Make sure you're on a valid quiz page.
          </p>
          <button className="view-all-button" onClick={navigateToHomepage}>
            View All Courses
          </button>
        </div>
      );
    }

    return (
      <div className="quiz-view">
        <div className="quiz-header">
          <div className="quiz-icon">📝</div>
          <p className="quiz-label">Current Quiz</p>
        </div>

        <div className="quiz-card">
          <div className="quiz-content">
            <h3 className="quiz-content-title">Quiz Content</h3>
            <div className="quiz-content-text">{currentQuiz.content}</div>
          </div>

          <div className="quiz-info">
            <p className="quiz-detail">Quiz ID: {currentQuiz.id}</p>
            <p className="quiz-detail">Class ID: {currentQuiz.classId}</p>
            <p className="quiz-detail">Session ID: {currentQuiz.sessionId}</p>
            {currentQuiz.hasMarkdownEditor && <p className="quiz-detail editor-status">✅ Editor Available</p>}
          </div>
        </div>

        <div className="quiz-actions">
          <button className="discussion-button" onClick={navigateToDiscussion} disabled={discussionLoading}>
            {discussionLoading ? 'Loading...' : 'Go to Discussion'}
          </button>
          <button
            className="ai-button"
            onClick={generateAiResponse}
            disabled={aiGenerating || !currentQuiz.hasMarkdownEditor}>
            {aiGenerating ? 'Generating...' : 'Generate AI Response'}
          </button>
          <button className="grade-button" onClick={autoGradeTeammates} disabled={autoGrading}>
            {autoGrading ? 'Grading...' : 'Auto Grade Team'}
          </button>
          <button className="view-all-button" onClick={navigateToHomepage}>
            View All Courses
          </button>
        </div>
      </div>
    );
  };

  const renderCurrentCourseView = () => {
    if (!currentCourse) {
      return (
        <div className="current-course-not-found">
          <div className="course-icon">📚</div>
          <p className="current-course-title">Course Not Found</p>
          <p className="current-course-description">
            Could not identify the current course. Make sure you're on a valid course page.
          </p>
          <button className="view-all-button" onClick={navigateToHomepage}>
            View All Courses
          </button>
        </div>
      );
    }

    return (
      <div className="current-course-view">
        <div className="current-course-header">
          <div className="course-icon">📖</div>
          <p className="current-course-label">Current Course</p>
        </div>

        <div className="current-course-card">
          <h3 className="current-course-title">{currentCourse.title}</h3>
          <p className="current-course-code">{currentCourse.courseCode}</p>
        </div>

        <div className="current-course-actions">
          <button className="  view-all-button" onClick={navigateToHomepage}>
            View All Courses
          </button>
        </div>
      </div>
    );
  };

  const renderAllCoursesView = () => {
    // Show loading state
    if (loading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your subjects...</p>
        </div>
      );
    }

    // Show subjects if available
    if (subjects.length > 0) {
      return (
        <div className="subjects-list">
          {subjects.map(subject => (
            <button
              key={subject.courseId}
              className="subject-item"
              onClick={() => navigateToSubject(subject.courseId)}
              disabled={redirectingCourseId === subject.courseId}
              tabIndex={0}>
              <h3>{subject.title}</h3>
              <p className="course-code">{subject.courseCode}</p>
              {redirectingCourseId === subject.courseId && (
                <div className="redirecting-indicator">
                  <div className="spinner"></div>
                  <span>Redirecting...</span>
                </div>
              )}
            </button>
          ))}
        </div>
      );
    }

    // Show empty state when connected but no subjects
    return (
      <div className="empty-state">
        <p>No subjects loaded</p>
        <p className="help-text">Click "Get Subjects" to load your courses</p>
      </div>
    );
  };

  const renderMainContent = () => {
    // Don't show subjects if not connected to university site
    if (connectionStatus !== 'connected') {
      return (
        <div className="not-connected-state">
          <div className="university-icon">🎓</div>
          <p className="not-connected-title">Connect to University</p>
          <p className="not-connected-description">
            Navigate to the FPT University website to view and manage your subjects.
          </p>
          <button className="connect-button" onClick={navigateToUniversity}>
            Go to University Site
          </button>
        </div>
      );
    }

    // Show quiz view if on quiz page
    if (pageType === 'quiz') {
      return renderQuizView();
    }

    // Show current course view if on course page
    if (pageType === 'course') {
      return renderCurrentCourseView();
    }

    // Show all courses view for homepage or other pages
    return renderAllCoursesView();
  };

  const shouldShowFetchButton = () => {
    return (
      connectionStatus === 'connected' &&
      pageType !== 'quiz' &&
      (pageType === 'homepage' || (pageType === 'other' && subjects.length === 0))
    );
  };

  const getHeaderTitle = () => {
    if (pageType === 'quiz') {
      return 'Quiz Page';
    }
    if (pageType === 'course' && currentCourse) {
      return 'Current Course';
    }
    return 'EduFlow';
  };

  const getHeaderSubtitle = () => {
    if (pageType === 'course' || pageType === 'quiz') {
      return null;
    }

    if (connectionStatus === 'connected') {
      return (
        <div className="semester">
          {semester && <span className="semester-name">{semester}</span>}
          {lastFetched && subjects.length > 0 && <span className="last-fetched"> • Updated {formatLastFetched()}</span>}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`popup-container ${isLight ? 'light-theme' : 'dark-theme'}`}>
      <header>
        <h1>{getHeaderTitle()}</h1>
        {getHeaderSubtitle()}

        <div className={`connection-status ${connectionStatus}`}>
          <span className="status-indicator"></span>
          <span>{connectionStatus === 'connected' ? 'Connected to FPT University' : 'Not connected'}</span>
        </div>
      </header>

      {shouldShowFetchButton() && (
        <div className="actions">
          <button className="fetch-button" onClick={fetchSubjects} disabled={loading}>
            {loading ? 'Loading...' : subjects.length > 0 ? 'Refresh Subjects' : 'Get Subjects'}
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <div className="subjects-container">{renderMainContent()}</div>

      <footer>
        <div className="version">v1.0.0</div>
        <div className="credits">EduFlow</div>
      </footer>
    </div>
  );
};

export default withErrorBoundary(
  withSuspense(Popup, <div className="loading">Loading...</div>),
  <div className="error">Error Occurred</div>,
);

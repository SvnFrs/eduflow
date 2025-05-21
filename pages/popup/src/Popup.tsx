import { useState, useEffect } from 'react';
import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

interface Subject {
  title: string;
  courseId: number;
  courseCode: string;
}

const Popup = () => {
  const theme = useStorage(exampleThemeStorage);
  const isLight = theme === 'light';
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

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

    // Listen for messages from content script
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageListener = (message: any) => {
      if (message.type === 'SUBJECTS_FETCHED') {
        if (message.data) {
          const processedSubjects = processSubjects(message.data);
          setSubjects(processedSubjects);
          setLastFetched(new Date());
          setLoading(false);

          // Extract semester from courseCode if available
          const semesterFromCode = extractSemesterFromCode(processedSubjects);
          if (semesterFromCode) {
            setSemester(formatSemesterName(semesterFromCode));
            chrome.storage.local.set({ selectedSemester: semesterFromCode });
          }

          // Cache the processed subjects
          chrome.storage.local.set({
            subjects: processedSubjects,
            lastFetched: new Date().toISOString(),
          });
        } else if (message.error) {
          setError(message.error);
          setLoading(false);
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

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

  const navigateToSubject = (courseId: number) => {
    const url = `https://fu-edunext.fpt.edu.vn/course/${courseId}/`;
    chrome.tabs.create({ url });
  };

  const navigateToUniversity = () => {
    const url = 'https://fu-edunext.fpt.edu.vn/';
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

  return (
    <div className={`popup-container ${isLight ? 'light-theme' : 'dark-theme'}`}>
      <header>
        <h1>Uato Naext</h1>
        <div className="semester">
          {semester && <span className="semester-name">{semester}</span>}
          {lastFetched && subjects.length > 0 && <span className="last-fetched"> • Updated {formatLastFetched()}</span>}
        </div>

        <div className={`connection-status ${connectionStatus}`}>
          <span className="status-indicator"></span>
          <span>{connectionStatus === 'connected' ? 'Connected to FPT University' : 'Not connected'}</span>
        </div>
      </header>

      <div className="actions">
        {connectionStatus === 'connected' ? (
          <button className="fetch-button" onClick={fetchSubjects} disabled={loading}>
            {loading ? 'Loading...' : subjects.length > 0 ? 'Refresh Subjects' : 'Get Subjects'}
          </button>
        ) : (
          <button className="fetch-button go-to-site" onClick={navigateToUniversity}>
            Go to University Site
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="subjects-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your subjects...</p>
          </div>
        ) : subjects.length > 0 ? (
          <div className="subjects-list">
            {subjects.map(subject => (
              <button
                key={subject.courseId}
                className="subject-item"
                onClick={() => navigateToSubject(subject.courseId)}
                tabIndex={0}>
                <h3>{subject.title}</h3>
                <p className="course-code">{subject.courseCode}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No subjects loaded</p>
            <p className="help-text">
              {connectionStatus === 'connected'
                ? 'Click "Get Subjects" to load your courses'
                : 'Please navigate to the university website'}
            </p>
          </div>
        )}
      </div>

      <footer>
        <div className="version">v1.0.0</div>
        <div className="credits">Uato Naext</div>
      </footer>
    </div>
  );
};

export default withErrorBoundary(
  withSuspense(Popup, <div className="loading">Loading...</div>),
  <div className="error">Error Occurred</div>,
);

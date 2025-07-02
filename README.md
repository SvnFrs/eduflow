<div align="center">

# 🎓 EduFlow

*Your AI-Powered University Companion (Because Who Has Time for Manual Course Management?)*

![](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![](https://img.shields.io/badge/Typescript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![](https://badges.aleen42.com/src/vitejs.svg)
![](https://img.shields.io/badge/Chrome_Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![](https://img.shields.io/badge/AI_Powered-FF6B6B?style=flat-square&logo=openai&logoColor=white)

*Making university life easier, one click at a time* ✨

</div>

## 📖 Table of Contents

- [What is EduFlow?](#what-is-eduflow)
- [Features](#features)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
- [Technical Details](#technical-details)
- [Contributing](#contributing)

## 🚀 What is EduFlow?

EduFlow is a Chrome extension designed specifically for FPT University students who are tired of manually navigating through course materials, writing discussion posts, and grading teammates. Built with React, TypeScript, and powered by Google's Gemini AI, EduFlow transforms your university experience from tedious to seamless.

*Think of it as your personal academic assistant that never sleeps, never complains, and definitely doesn't judge your last-minute submissions.* 😄

## ✨ Features

### 🎯 Smart Course Management
- **Instant Course Detection**: Automatically identifies your current course and quiz pages
- **Quick Navigation**: Jump between courses faster than you can say "deadline anxiety"
- **Real-time Sync**: Keeps track of all your subjects and their details

### 🤖 AI-Powered Discussion Assistant
- **Intelligent Response Generation**: Let Gemini AI craft thoughtful discussion posts based on quiz content
- **Context-Aware**: Understands your course material and generates relevant responses
- **One-Click Posting**: From generation to submission in seconds

### ⭐ Auto-Grading Magic
- **Teammate Auto-Grader**: Automatically grades all teammates with 5 stars (because teamwork makes the dream work!)
- **Smart Detection**: Recognizes grading modals and handles them instantly
- **Zero Effort**: Sit back while EduFlow handles the repetitive grading tasks

### 🎨 User Experience
- **Clean Interface**: Modern, intuitive design that doesn't make your eyes bleed
- **Dark/Light Themes**: Because we respect your preference for late-night studying
- **Real-time Status**: Always know what's happening with connection indicators

## 🛠 Getting Started

### Prerequisites
- Google Chrome browser
- FPT University student account
- Node.js (>= 22.12.0)
- pnpm package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/eduflow.git
   cd eduflow
   ```

2. **Install dependencies**
   ```bash
   npm install -g pnpm
   pnpm install
   ```

3. **Build the extension**
   ```bash
   pnpm build
   ```

4. **Load into Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

## 📱 Usage Guide

### Getting Your Courses
1. Navigate to the FPT University website
2. Open the EduFlow extension
3. Click "Get Subjects" to fetch your current semester courses
4. Browse and click on any course to navigate directly to it

### Using AI Discussion Assistant
1. Open any quiz page on the university portal
2. Click "Go to Discussion" in the EduFlow popup
3. Once on the discussion page, click "Generate AI Response"
4. Watch as Gemini AI crafts a thoughtful response based on your quiz content
5. The response is automatically filled into the discussion input field

### Auto-Grading Teammates
1. When a grading modal appears (you know, the one that asks you to rate your teammates)
2. EduFlow automatically detects it and shows "Auto Grade Team" button
3. Click the button and watch as all teammates get 5-star ratings
4. *Because let's be honest, everyone deserves those stars* ⭐

### Navigation Features
- **Course Pages**: See current course information and quick navigation options
- **Quiz Detection**: Automatic detection of quiz content with AI response capabilities
- **Discussion Access**: One-click navigation to discussion sections

## 🔧 Technical Details

### Architecture
- **Frontend**: React 19 with TypeScript
- **Styling**: Tailwind CSS for modern, responsive design
- **Build Tool**: Vite with Rollup for fast development and optimized builds
- **AI Integration**: Google Gemini 2.0 Flash model for content generation
- **Extension API**: Chrome Extensions Manifest V3

### Key Components
- **Content Script**: Handles page interaction and DOM manipulation
- **Background Script**: Manages extension lifecycle and API calls
- **Popup Interface**: Main user interface for course management
- **API Handler**: Manages university portal API interactions
- **Storage System**: Persistent data storage for courses and preferences

### Security Features
- **Token Management**: Secure JWT token handling for university portal authentication
- **Header Interception**: Smart capture of authentication headers for API calls
- **Local Storage**: Safe storage of course data and user preferences

## 🎨 Development

### Development Server
```bash
pnpm dev
```

### Building for Production
```bash
pnpm build
```

### Linting and Formatting
```bash
pnpm lint
pnpm format
```

## 🤝 Contributing

We welcome contributions! Whether it's:
- 🐛 Bug fixes (because nobody's perfect, not even our code)
- ✨ New features (got ideas? we're all ears!)
- 📚 Documentation improvements
- 🎨 UI/UX enhancements

### Development Setup
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (your future self will thank you)
5. Commit with descriptive messages
6. Push and create a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **FPT University Students**: For inspiring this project through shared academic struggles
- **Google Gemini AI**: For making our discussion posts sound smarter than we actually are
- **React & TypeScript Communities**: For the amazing tools and documentation
- **Coffee**: For making development possible at 3 AM

---

<div align="center">

*Built with ❤️ and way too much caffeine*

**EduFlow** - Making university life easier, one automation at a time

*P.S. - We're not responsible if this extension makes you too efficient and you finish all your work early. Use responsibly!* 😉

</div>

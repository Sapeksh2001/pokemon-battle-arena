# Technology Stack Documentation

## 1. Stack Overview
**Last Updated**: 2026-03-22
**Version**: 1.0

### Architecture Pattern
- **Type**: Serverless Client-Side Application
- **Pattern**: Modular MVC structure injected into the DOM
- **Deployment**: Firebase Hosting

---

## 2. Frontend Stack

### Core Framework
- **Framework**: Vanilla JavaScript (ES6+ Modules)
- **Version**: Built-in browser interpreters
- **Reason**: Maximum performance, no build steps required for local development, complete control over retro DOM manipulation.

### UI Styling
- **CSS Strategy**: Custom Vanilla CSS with Tailwind CSS utility classes.
- **Reason**: Need highly specific pixel-art aesthetic rulesets (e.g., `image-rendering: pixelated`) mixed with rapid flexbox utility alignment.

### Audio Manager
- **Library**: Tone.js
- **Reason**: Programmable synth routing to generate nostalgic 8-bit/16-bit sound effects dynamically.

---

## 3. Backend Stack / Database

### Real-time Sync
- **Service**: Firebase Realtime Database
- **SDK**: Firebase Web SDK (v8 compatible imports via CDN)
- **Reason**: Requires extremely low-latency JSON state tree synchronization across peers without writing custom WebSocket backends.

---

## 4. Development Tools
- **Package Manager**: NPM (tracking `package.json` for specific utilities)
- **Local Server**: `http-server` via npx for instant serving.

## 5. Security & Infrastructure
- **Hosting**: Firebase Hosting (CDN backed edge delivery).
- **Secrets Management**: Handled via `.env` guidelines; production secrets injected into Firebase project settings. No hardcoded database admin credentials exist in the client.

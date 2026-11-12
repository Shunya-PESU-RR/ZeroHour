# ZeroHour - SHUNYA 2026

**A real-time hackathon management platform for ZeroHour, a 24-hour mathematics hackathon under SHUNYA 2026.**

**Event Dates:** November 14–15, 2026  
**Theme:** Optical Illusion  
**Duration:** 24 Hours

## Overview

ZeroHour is a web-based event management platform designed to streamline team coordination, mentor assistance, request tracking, and event administration during a hackathon.

The platform provides dedicated interfaces for organizers, mentors, and participating teams, supported by a centralized Supabase backend.

## Features

### Organizer Dashboard
- Monitor mentor assistance requests.
- Track requests across Open, Claimed, and Resolved states.
- Assign mentors and manage request workflows.
- View event activity through a centralized interface.

### Mentor Workspace
- Dedicated mentor authentication.
- View and manage assistance requests.
- Claim, release, and resolve requests.
- Track assigned requests.

### Team Interface
- Team login and dashboard.
- Submit assistance requests.
- Track request status.

### Evaluation and Leaderboard
- Rubric-based team evaluations.
- Weighted scoring.
- Team rankings and leaderboard visualization.

*Feature availability depends on the current deployment and configuration.*

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, CSS |
| Build Tool | Vite |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Real-time Updates | Supabase Realtime |
| Version Control | Git & GitHub |

## Project Architecture

The application follows a frontend–backend architecture:

- **React Frontend:** User interfaces, navigation, forms, and dashboards.
- **API Layer:** Data fetching, state updates, and database operations.
- **Supabase Backend:** Authentication, PostgreSQL database, authorization policies, and real-time synchronization.

## Getting Started

### Prerequisites

- Node.js
- npm
- Git
- A configured Supabase project

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd ZeroHour
```

Install dependencies:

```bash
npm install
```

Configure the environment variables using the names expected by the existing Supabase client. For example, if the project uses Vite's standard naming convention:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Do not commit `.env` files or private credentials.

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

### Production Build

```bash
npm run build
```

## Request Management Workflow

The mentor assistance system uses three request states:

**OPEN → CLAIMED → RESOLVED**

1. A team submits an assistance request.
2. The request appears in the Open queue.
3. A mentor claims the request or an organizer assigns it.
4. The mentor assists the team.
5. The request is marked Resolved.

Requests can also be released back into the Open queue when required.

## Security

ZeroHour uses Supabase authentication and database-level access controls to support role-specific workflows.

Sensitive credentials must remain outside the frontend repository. Database operations should respect configured Row Level Security policies and authorized RPC functions.

## Future Enhancements

- Immersive optical-illusion-themed event website.
- Interactive 3D mathematical geometry.
- Enhanced dashboard visualizations.
- Improved mobile responsiveness.
- Additional event analytics and monitoring.

## Event Information

**ZeroHour — SHUNYA 2026**  
November 14–15, 2026  
24-Hour Mathematics Hackathon  
Theme: Optical Illusion

---

*Built for ZeroHour at SHUNYA 2026.*
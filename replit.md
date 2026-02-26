# TRYBE — Private Global Health Collaboration Platform

## Overview
TRYBE is an exclusive, invite-only global health collaboration platform designed for professionals. It facilitates structured collaboration through "Tables," threaded discussions, direct messaging, a specialized health calendar ("Moments"), and an AI-powered "TRYBE Assistant." The platform aims to foster strategic coordination within the global health sector, offering a robust environment for serious professionals to connect and collaborate.

## User Preferences
Not specified.

## System Architecture
**Frontend**: Developed with React, Vite, and TypeScript, utilizing `shadcn/ui` for components, TanStack Query for data fetching, and `wouter` for routing.
**Backend**: Built using Express.js and TypeScript, incorporating session-based authentication.
**Database**: PostgreSQL, managed with Drizzle ORM.
**AI**: Integrates OpenAI GPT-4o-mini for the TRYBE Assistant, designed as a strategic coordination assistant. The system is designed to function gracefully even if the OpenAI API key is not provided.

**UI/UX Design**:
The platform employs a "quietly confident" aesthetic with a professional, calm, and neutral color scheme, primarily featuring amber/orange accents.
- **Typography**: Uses the Inter font, with serif Georgia for accent taglines.
- **Interactivity**: All interactive elements include `data-testid` attributes.
- **Animations**: Features `animate-fade-in-up` and `animate-fade-in` entrance animations across pages, with stagger classes for sequential reveals.
- **Glass Effects**: Utilizes `backdrop-blur` for elements like the top bar, assistant drawer, and focus selector modal.
- **No uppercase labels** and **no bright blues** are used, maintaining a consistent calm aesthetic.
- **Responsive Elements**: Includes micro-interactions for buttons (scale on hover/active) and ensures reduced motion for users with corresponding preferences.
- **Card System**: Employs a tiered `border-radius` system (`rounded-xl`, `rounded-2xl`, `rounded-l-[2.5rem]`) for different components.
- **Messaging**: Chat bubbles are styled with `rounded-2xl` and specific padding for a warmer feel.
- **The TRYBE Assistant** is implemented as a floating drawer on the right side, triggered by a top-bar button, and not permanently visible.
- **Dashboard**: Features a "Your current focus" hero card leading to a primary CTA, with a secondary grid for My Tables, Upcoming Moments, and Messages.
- **Empty States**: Designed with a 1-line explanation and a single action button for clarity.

**Technical Implementations**:
- **Authentication**: Session-based authentication using `express-session`. Users register with an invite code and are auto-approved as ACTIVE.
- **Table Management**: Users can directly create collaboration tables without admin approval. An automated cleanup process removes inactive tables (no posts for 14+ days) and past calendar events every 6 hours.
- **TRYBE Assistant OMNI**: Utilizes OpenAI function calling with a tool loop and 17 registered tools for actions (e.g., join/leave tables, create threads, send DMs, create tables, send invites, update profile, submit feedback) and information retrieval (e.g., search tables/milestones/members, get table/thread details). It also supports analysis and drafting capabilities like summarizing threads, strategic reflection, and drafting posts. All write actions require user confirmation.
- **Context Builder**: The server's `context-builder.ts` handles intent classification, profile and data injection, thread memory (rolling AI summaries), and conversation compression.
- **Moderation**: All structured outputs and user-generated content are run through the OpenAI moderation API.
- **Invite System**: Supports `ADMIN_CODE` (requires manual admin approval) and `MEMBER_INVITE` (auto-approves, 14-day expiry, 5/month quota). Member invites are managed via a dedicated page with quota display and history.

## External Dependencies
- **PostgreSQL**: Primary database for all platform data.
- **OpenAI GPT-4o-mini**: Used for the TRYBE Assistant's AI capabilities, including natural language processing, function calling, analysis, and content moderation.
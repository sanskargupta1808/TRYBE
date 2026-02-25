# TRYBE — Private Global Health Collaboration Platform

## Project Overview
TRYBE is a private, invite-only global health collaboration platform built for serious professionals. It features structured collaboration Tables, threaded discussions, DMs, a 2026 health calendar (Moments), an AI-powered TRYBE Assistant, and a full admin panel.

## Architecture
- **Frontend**: React + Vite + TypeScript, shadcn/ui, TanStack Query, wouter routing
- **Backend**: Express.js + TypeScript, session-based auth
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: OpenAI GPT-4o-mini (TRYBE Assistant, falls back gracefully without key)

## Key Files
- `shared/schema.ts` — Drizzle schema + Zod types for all tables
- `server/db.ts` — Database connection
- `server/storage.ts` — All CRUD operations
- `server/routes.ts` — All API endpoints (includes onboarding NLP at POST /api/onboarding/process)
- `server/seed.ts` — Seed script (admin user, invites, tables, calendar events)
- `client/src/App.tsx` — Full routing with auth guards
- `client/src/contexts/AuthContext.tsx` — Session auth context
- `client/src/components/AppSidebar.tsx` — Sidebar with app + admin nav
- `client/src/hooks/useVoiceRecorder.ts` — MediaRecorder-based voice recording hook
- `client/src/hooks/useSignaling.ts` — WebSocket signaling hook for WebRTC audio calls
- `client/src/components/AssistantPanel.tsx` — TRYBE Assistant chat panel

## Pages
### Public
- `/` — Landing
- `/login` — Login
- `/register` — Register with invite code
- `/request-invite` — Invite request form
- `/pending-approval` — Pending admin approval
- `/forgot-password` — Forgot password
- `/privacy`, `/terms`, `/code-of-conduct`, `/ai-transparency` — Policy pages

### App (authenticated)
- `/app/onboarding` — Conversational NLP-driven onboarding (chat UI with TRYBE Assistant)
- `/app` — Dashboard
- `/app/tables` — Browse & join tables
- `/app/tables/:id` — Table detail + threads
- `/app/tables/:id/threads/:threadId` — Thread detail + posts
- `/app/tables/request` — Request a new table
- `/app/moments` — 2026 health calendar with signals
- `/app/messages` — DM conversations list
- `/app/messages/:id` — DM conversation
- `/app/feedback` — Submit feedback
- `/app/settings` — Profile & assistant settings

### Admin (admin/moderator only)
- `/admin` — Overview + metrics
- `/admin/users` — User management (approve/suspend/reject)
- `/admin/invites` — Invite code management
- `/admin/invite-requests` — Invite request review
- `/admin/table-requests` — Table request review
- `/admin/moderation` — Content moderation queue
- `/admin/calendar` — Calendar/Moments management
- `/admin/feedback` — Member feedback review
- `/admin/audit-log` — Admin activity log

## Seeded Data
- **Admin**: admin@trybe.health / ChangeMe123!
- **Invite codes**: ALPHA-TRYBE-001 through ALPHA-TRYBE-005 (90-day expiry)
- **10 collaboration tables**: across disease areas, policy, advocacy
- **20 calendar events**: 2026 health milestones

## Auth Flow
1. User registers with an invite code → PENDING_APPROVAL
2. Admin approves → ACTIVE → user completes onboarding
3. Session-based auth (express-session with SESSION_SECRET)

## Design System
- Primary color: amber/orange (24 85% 45%)
- Professional, calm, neutral
- No emoji in UI; text-based reactions (Agree, Thanks, Noted, Helpful, Important, Insightful)
- All interactive elements have `data-testid` attributes
- Inter font, warm off-white bg, deep charcoal text, subtle tonal card shadows
- No uppercase labels — sentence case throughout
- No bright blues — warm neutral chart/badge palette
- No gradients as primary identity

## UX Architecture (Focus-First Redesign)
- Dashboard: Single "Your current focus" hero card → one primary CTA (Open table) → secondary 3-column grid (My tables, Upcoming moments, Messages) with max 3 items each + "View all" links
- Focus table stored in localStorage (`trybe_focus_table`); "Change focus" modal for switching
- Assistant: floating drawer (right-side overlay with backdrop blur) triggered by "Ask TRYBE Assistant" top bar button; not permanently visible
- Progressive disclosure: max 5 items in thread lists, "View all" toggle; max 3 items in dashboard previews
- Empty states: 1-line explanation + 1 next action button (e.g., "Browse tables", "Ask TRYBE Assistant", "View tables")
- Small assistant callout at bottom of dashboard: "Want suggestions tailored to your focus?"

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection
- `SESSION_SECRET` — Express session secret
- `OPENAI_API_KEY` — For TRYBE Assistant (falls back gracefully if absent)

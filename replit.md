# TRYBE — Private Global Health Collaboration Platform

## Project Overview
TRYBE is a private, invite-only global health collaboration platform built for serious professionals. It features structured collaboration Tables, threaded discussions, DMs, a 2026 health calendar (Moments), an AI-powered TRYBE Assistant, and a full admin panel.

## Architecture
- **Frontend**: React + Vite + TypeScript, shadcn/ui, TanStack Query, wouter routing
- **Backend**: Express.js + TypeScript, session-based auth
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: OpenAI GPT-4o-mini (TRYBE Assistant OMNI — strategic coordination assistant, falls back gracefully without key)

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
- Professional, calm, neutral — "quietly confident" aesthetic
- No emoji in UI; text-based reactions (Agree, Thanks, Noted, Helpful, Important, Insightful)
- All interactive elements have `data-testid` attributes
- Inter font (serif Georgia for accent taglines), warm off-white bg, deep charcoal text, subtle tonal card shadows
- No uppercase labels — sentence case throughout
- No bright blues — warm neutral chart/badge palette
- No gradients as primary identity (subtle warm gradient on focus card only)

### Visual Polish (Creative Director Pass — Complete)
- **Entrance animations**: Every page has `animate-fade-in-up` and/or `animate-fade-in` entrance animations. Stagger classes (`stagger-1` through `stagger-6`) used on Dashboard, Landing, auth pages, detail pages, and Invites for sequential reveal.
- **Glass effects**: top bar `bg-background/60 backdrop-blur-md`, assistant drawer `bg-background/90 backdrop-blur-xl rounded-l-[2.5rem]`, focus selector modal `bg-card/80 backdrop-blur-xl`
- **Typography**: `heading-rule` class on all major page headings (Dashboard, Tables, Messages, Moments, Settings, Invites, Feedback, RequestTable, Landing); time-of-day greeting on dashboard; serif italic on brand tagline and onboarding subtitle
- **Focus card**: left border accent (3px primary/40), warm gradient bg, `rounded-2xl`, p-8 padding, `text-2xl tracking-tight`, size="lg" CTA button
- **Auth pages**: `auth-dots` CSS dot grid texture, `auth-glow` radial gradient behind logo, bordered card container with shadow, `animate-fade-in-up` with stagger on logo/heading/form
- **Sidebar**: fade gradient separators (not hard borders), subtle active state (2px primary accent bar + 5% bg tint), avatar hover ring, `hover-elevate` on nav items
- **Empty states**: radial gradient glow behind icon (primary/8%), increased padding (p-10), prominent action buttons, `animate-fade-in` entrance
- **Button micro-interactions**: primary buttons `hover:scale-[1.015]` + all buttons `active:scale-[0.98]` with 150ms transition-transform
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all animations and button transforms
- **Card radius system**: `rounded-xl` (standard cards across all pages and admin), `rounded-2xl` (focus card, modals), `rounded-l-[2.5rem]` (assistant drawer)
- **Cards**: hover shadow lift (`hover:shadow-md transition-shadow duration-200`) on dashboard grid cards
- **Message bubbles**: `rounded-2xl` with `px-3.5 py-2.5` for warmer feel
- **CTA glow**: `cta-glow` class adds warm box-shadow on hover (primary/15%) for hero buttons
- **Chip press**: `chip-press` class adds `active:scale(0.95)` for tactile feedback on filter/signal chips
- **Moment accent bar**: `moment-accent-bar` class adds a 3px left accent bar (primary/35%) on milestone cards
- **Admin pages**: All 10 admin pages upgraded to `rounded-xl` card containers (24 surfaces total)

### Trusted Invites & Tiered Approval
- **Invite types**: `ADMIN_CODE` (requires manual admin approval) and `MEMBER_INVITE` (auto-approves on use, 14-day expiry, 5/month quota)
- Admin panel shows invite type badges (blue "Member invite" / grey "Admin code") and auto-confirm indicator
- Admin Users page has "Pause invites" / "Restore invites" toggle per user
- Member invite page at `/app/invites`: quota display, send form (email + optional note), sent invite history
- Welcome page at `/app/welcome`: auto-approved member landing with onboarding prompt
- Assistant knows about invites and can direct users to `/app/invites`

## TRYBE Assistant OMNI (Phase 2 — Strategic Coordination)
- **Core identity**: Calm, professional, neutral. Human-led, AI-supported. Suggestion-only.
- **Capabilities**:
  1. Suggest Tables — profile-matched table recommendations
  2. Summarise Threads — structured Key Themes / Areas of Agreement / Open Questions (max 400 words, 4 bullets/section)
  3. Strategic Reflection — "What's happening here?", "Is there alignment forming?" → structured analysis with Suggested Next Step
  4. Milestone Preparation — "Help me prepare for World TB Day" → Context, Focus Areas, Stakeholder Types, Optional Suggestion
  5. Draft Posts/Messages — professional, neutral, moderation-checked (max 400 words)
  6. Surface Calendar Moments — relevance-matched upcoming events
  7. Inviting Colleagues — directs to /app/invites, explains 5/month quota
  8. General Support — platform navigation and guidance
- **Activity Pattern Nudges** (GET /api/assistant/nudges):
  - Inactive tables (10+ days no activity) → subtle re-engagement suggestion
  - Upcoming milestones (within 30 days) → preparation prompt
  - Throttled: max 1/session, max 3/week; suppressed for QUIET activity level
- **Personal Focus Review**: Every 30 days, prompts "Has your professional focus shifted?" with Update/Keep options
- **Guardrails**: Refuses political positions, advocacy drafts, off-topic requests, medical advice
- **Moderation**: All structured outputs (drafts, summaries, reflections, milestone content) run through OpenAI moderation API
- **Tone rules**: No exclamation marks, no emoji, no motivational/inspirational language, no corporate jargon
- **Frontend**: Collapsible sections for structured content (reflection, milestone, summary), nudge cards, focus review prompt
- **Response format**: JSON with assistantText, summaryContent, reflectionContent, milestoneContent, draftContent, suggestedActions
- **Max tokens**: 1200 (up from 800)

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

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
- **Empty States**: Designed with a 1-line explanation and a single action button for clarity, with radial gradient icon backgrounds and generous padding.
- **Focus Card**: Premium treatment with left accent bar (3px primary/40), warm gradient background, shimmer highlight line at top, and size="lg" CTA button.
- **Tag Colours**: Eight-colour tag system (warm/teal/violet/sky/rose/lime/amber/slate) with dark mode variants, applied to badges across tables, moments, and profiles.
- **Sidebar Polish**: Fade separators instead of hard borders, active nav accent bar, avatar ring on hover, subtle background tint.
- **Auth Pages**: Dot grid background pattern with radial glow behind logo, card containers with shadow.

**Technical Implementations**:
- **Authentication**: Session-based authentication using `express-session` with PostgreSQL-backed session store (`connect-pg-simple`). Sessions persist across server restarts with `rolling: true` (cookie refreshed on each request). Users register with an invite code and are auto-approved as ACTIVE. Password reset available via email token flow (forgot-password) and directly from Settings (change-password with current password verification). All password fields use a reusable `PasswordInput` component with show/hide toggle.
- **Data Freshness**: TanStack Query configured with `staleTime: 5min`, `refetchOnWindowFocus: true`, `retry: 1`, `gcTime: 30min`. AuthContext re-validates session on window focus (throttled to 1min), on network reconnect, and every 10 minutes. DB pools use `keepAlive: true` with proper idle timeouts. Expired sessions on protected routes trigger automatic redirect to login.
- **Suspend/Reactivate Flow**: When admin suspends a user, `suspendedAt` is set and a suspension email is sent (with 14-day warning) with a link to `/suspended` where the user can submit a reactivation appeal. Appeals are reviewed at `/admin/appeals`. Approving an appeal reactivates the user (status→ACTIVE, suspendedAt→null) with all data preserved and sends a reactivation confirmation email. Rejecting sends no email. If a suspended user does not appeal within 14 days, their account and all associated data are permanently auto-deleted by the cleanup cron (every 6 hours). Deletion cascades through: DM conversations/messages/reactions, calendar/milestone signals, community events, posts, threads (with posts/memory), table memberships, join requests, table requests, invite references (nullified), feedback, appeals, moderation items, audit log, profile, and user record. Admin accounts are exempt from auto-deletion. Schema: `reactivation_appeals` table with userId, message, status (PENDING/APPROVED/REJECTED), reviewedByUserId, reviewedAt.
- **Moments Page**: The `/app/moments` page is split into two tabs: **Calendar** (auto-synced read-only WHO Global Health Days with Support/Interested signals) and **Milestones** (user-created events). Any user can create a milestone with title, description, date, end date, location, virtual link, and up to 10 tags (predefined + custom). Milestones support Interested/Attending toggle signals with live counts (Attending triggers a branded email with event details). Creators can delete their own events. Schema: `community_events` + `community_event_signals` tables. API: `/api/milestones` (GET/POST), `/api/milestones/:id/signal` (POST toggle), `/api/milestones/:id` (DELETE).
- **Table Management**: Users can directly create collaboration tables without admin approval. An automated cleanup process removes inactive tables (no posts for 14+ days) and past calendar events every 6 hours. **Seed Tables**: 60 pre-created tables covering all disease areas, regions, health roles, and cross-topic combinations. Table tags use exact profile value strings for case-insensitive matching. **Recommendation Algorithm**: Tables are scored by exact tag overlap with user profile (interests, regions, healthRole). When no exact match exists, fuzzy/partial matching scores tables by substring containment and word-level overlap (0.5 for substring match, 0.3 for word match). If fewer than 5 tables match, the system backfills with top-scored general recommendations to ensure every user always sees tables. Tables are sorted by membership first (joined tables at top), then by relevance score.
- **TRYBE Assistant OMNI**: Utilizes OpenAI function calling with a tool loop and 17 registered tools for actions (e.g., join/leave tables, create threads, send DMs, create tables, send invites, update profile, submit feedback) and information retrieval (e.g., search tables/milestones/members, get table/thread details). It also supports analysis and drafting capabilities like summarizing threads, strategic reflection, and drafting posts. All write actions require user confirmation.
- **Context Builder**: The server's `context-builder.ts` handles intent classification, profile and data injection, thread memory (rolling AI summaries), and conversation compression.
- **Moderation**: All structured outputs and user-generated content are run through the OpenAI moderation API. Users can flag any post in thread discussions for code of conduct violations. Flagged posts appear in the Admin Moderation Queue (`/admin/moderation`) with full context: the flagged content, author name/email, table/thread location, reporter name, and timestamp. Admins can take four actions on flagged items: **Dismiss** (no issue found), **Send Warning DM** (sends a conduct warning directly to the author's DMs, bypassing the shared-table restriction), **Remove Post** (marks the post as REMOVED, showing a placeholder in the thread), or **Suspend Account** (suspends the author and sends suspension email). All moderation actions are audit-logged.
- **Invite System**: Supports `ADMIN_CODE` (requires manual admin approval) and `MEMBER_INVITE` (auto-approves, 14-day expiry, 5/month quota). Member invites are managed via a dedicated page with quota display and history.

## External Dependencies
- **PostgreSQL**: Primary database for all platform data.
- **OpenAI GPT-4o-mini**: Used for the TRYBE Assistant's AI capabilities, including natural language processing, function calling, analysis, and content moderation.
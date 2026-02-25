import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import * as storage from "./storage";
import { createAuditEntry } from "./storage";
import OpenAI from "openai";
import { sendInviteEmail, sendInviteRequestApprovedEmail, sendAccountApprovedEmail } from "./email";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─── Middleware ───────────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}
async function requireActive(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.status !== "ACTIVE") return res.status(403).json({ error: "Account not active" });
  next();
}
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await storage.getUserById(req.session.userId);
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) return res.status(403).json({ error: "Forbidden" });
  next();
}

// ─── Simple moderation check ──────────────────────────────────────────────────
const BANNED_TERMS = ["hate", "kill", "terrorist", "extremist", "disinformation", "harassment", "profanity"];
async function moderateContent(text: string): Promise<{ flagged: boolean; reason?: string }> {
  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (lower.includes(term)) return { flagged: true, reason: `Contains prohibited term: ${term}` };
  }
  if (openai) {
    try {
      const resp = await openai.moderations.create({ input: text });
      const result = resp.results[0];
      if (result?.flagged) return { flagged: true, reason: "Flagged by AI moderation" };
    } catch {}
  }
  return { flagged: false };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(session({
    secret: process.env.SESSION_SECRET || "trybe-secret-key-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));

  // ─── Auth ──────────────────────────────────────────────────────────────────

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = await storage.getUserById(req.session.userId);
    if (!user) { req.session.destroy(() => {}); return res.json({ user: null }); }
    const profile = await storage.getUserProfile(user.id);
    return res.json({ user: { ...user, passwordHash: undefined }, profile });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, inviteToken, organisation, roleTitle } = req.body;
    if (!name || !email || !password || !inviteToken) return res.status(400).json({ error: "All fields required" });
    if (password.length < 12) return res.status(400).json({ error: "Password must be at least 12 characters" });

    const invite = await storage.getInviteByToken(inviteToken);
    if (!invite || invite.status !== "UNUSED") return res.status(400).json({ error: "That invitation code isn't valid, or it has expired." });
    if (invite.expiresAt && new Date() > invite.expiresAt) return res.status(400).json({ error: "That invitation code isn't valid, or it has expired." });
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) return res.status(400).json({ error: "This invitation was issued to a different email address." });

    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(400).json({ error: "An account with this email already exists." });

    const user = await storage.createUser({ name, email, password, organisation, roleTitle });
    await storage.useInvite(inviteToken, user.id);
    await createAuditEntry({ actorUserId: user.id, action: "USER_REGISTERED", targetType: "USER", targetId: user.id });

    // Auto-verify for demo (admin can manage actual email flow)
    const verified = await storage.verifyUserEmail(user.emailVerifyToken!);
    return res.json({ user: { ...verified, passwordHash: undefined }, message: "Registration successful. Awaiting admin approval." });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await storage.verifyPassword(user, password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    if (user.status === "PENDING_VERIFICATION") return res.status(403).json({ error: "Please verify your email first." });
    if (user.status === "SUSPENDED") return res.status(403).json({ error: "Your account has been suspended." });

    req.session.userId = user.id;
    await storage.updateUserLastLogin(user.id);
    await createAuditEntry({ actorUserId: user.id, action: "USER_LOGIN", targetType: "USER", targetId: user.id });
    const profile = await storage.getUserProfile(user.id);
    return res.json({ user: { ...user, passwordHash: undefined }, profile });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ success: true });
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Token required" });
    const user = await storage.verifyUserEmail(token as string);
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });
    return res.json({ success: true });
  });

  // ─── Invite Requests (public) ─────────────────────────────────────────────

  app.post("/api/invite-requests", async (req, res) => {
    const { name, organisation, roleTitle, email, focusAreas, reason } = req.body;
    if (!name || !organisation || !roleTitle || !email) return res.status(400).json({ error: "Required fields missing" });
    const request = await storage.createInviteRequest({ name, organisation, roleTitle, email, focusAreas, reason });
    return res.json(request);
  });

  // ─── Invites (admin) ──────────────────────────────────────────────────────

  app.get("/api/invites", requireAdmin, async (req, res) => {
    const invites = await storage.getAllInvites();
    res.json(invites);
  });
  app.post("/api/invites", requireAdmin, async (req, res) => {
    const { email, expiresInDays } = req.body;
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : undefined;
    const invite = await storage.createInvite({ email, createdByUserId: req.session.userId, expiresAt });
    await createAuditEntry({ actorUserId: req.session.userId, action: "INVITE_CREATED", targetType: "INVITE", targetId: invite.id, metadata: { email } });
    res.json(invite);
  });
  app.post("/api/invites/:id/revoke", requireAdmin, async (req, res) => {
    const invite = await storage.revokeInvite(req.params.id);
    res.json(invite);
  });

  // ─── Admin: Invite Requests ───────────────────────────────────────────────

  app.get("/api/admin/invite-requests", requireAdmin, async (req, res) => {
    const requests = await storage.getAllInviteRequests();
    res.json(requests);
  });
  app.post("/api/admin/invite-requests/:id/approve", requireAdmin, async (req, res) => {
    const updated = await storage.updateInviteRequestStatus(req.params.id, "APPROVED");
    // Also create an invite for them
    const invite = await storage.createInvite({ email: updated.email, createdByUserId: req.session.userId, expiresAt: new Date(Date.now() + 30 * 86400000) });
    res.json({ request: updated, invite });
  });
  app.post("/api/admin/invite-requests/:id/decline", requireAdmin, async (req, res) => {
    const updated = await storage.updateInviteRequestStatus(req.params.id, "DECLINED");
    res.json(updated);
  });

  // ─── Admin: Users ─────────────────────────────────────────────────────────

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  });
  app.post("/api/admin/users/:id/approve", requireAdmin, async (req, res) => {
    const user = await storage.updateUserStatus(req.params.id, "ACTIVE");
    await createAuditEntry({ actorUserId: req.session.userId, action: "USER_APPROVED", targetType: "USER", targetId: req.params.id });
    res.json({ ...user, passwordHash: undefined });
  });
  app.post("/api/admin/users/:id/suspend", requireAdmin, async (req, res) => {
    const user = await storage.updateUserStatus(req.params.id, "SUSPENDED");
    await createAuditEntry({ actorUserId: req.session.userId, action: "USER_SUSPENDED", targetType: "USER", targetId: req.params.id });
    res.json({ ...user, passwordHash: undefined });
  });
  app.post("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    const { role } = req.body;
    const user = await storage.updateUserRole(req.params.id, role);
    res.json({ ...user, passwordHash: undefined });
  });

  // ─── User Profile ─────────────────────────────────────────────────────────

  app.get("/api/profile", requireActive, async (req, res) => {
    const profile = await storage.getUserProfile(req.session.userId!);
    res.json(profile);
  });
  app.put("/api/profile", requireActive, async (req, res) => {
    const profile = await storage.upsertUserProfile(req.session.userId!, req.body);
    res.json(profile);
  });

  // ─── Tables ───────────────────────────────────────────────────────────────

  app.get("/api/tables", requireActive, async (req, res) => {
    const allTables = await storage.getAllTables();
    const myTables = await storage.getTablesForUser(req.session.userId!);
    const myIds = new Set(myTables.map(t => t.id));
    res.json({ all: allTables, myTableIds: Array.from(myIds) });
  });
  app.get("/api/tables/my", requireActive, async (req, res) => {
    const tables = await storage.getTablesForUser(req.session.userId!);
    res.json(tables);
  });
  app.get("/api/tables/:id", requireActive, async (req, res) => {
    const table = await storage.getTableById(req.params.id);
    if (!table) return res.status(404).json({ error: "Table not found" });
    const members = await storage.getTableMembers(req.params.id);
    const isMember = await storage.isTableMember(req.params.id, req.session.userId!);
    const threads = await storage.getThreadsByTable(req.params.id);
    res.json({ ...table, members, isMember, threads });
  });
  app.post("/api/tables/:id/join", requireActive, async (req, res) => {
    const table = await storage.getTableById(req.params.id);
    if (!table) return res.status(404).json({ error: "Not found" });
    const already = await storage.isTableMember(req.params.id, req.session.userId!);
    if (already) return res.status(400).json({ error: "Already a member" });
    if (table.requiresApprovalToJoin) {
      const req_ = await storage.createTableJoinRequest(req.params.id, req.session.userId!);
      return res.json({ status: "requested", request: req_ });
    }
    const member = await storage.addTableMember(req.params.id, req.session.userId!);
    await createAuditEntry({ actorUserId: req.session.userId, action: "TABLE_JOINED", targetType: "TABLE", targetId: req.params.id });
    res.json({ status: "joined", member });
  });
  app.post("/api/tables/:id/leave", requireActive, async (req, res) => {
    await storage.removeTableMember(req.params.id, req.session.userId!);
    res.json({ success: true });
  });
  app.get("/api/tables/:id/join-requests", requireActive, async (req, res) => {
    const requests = await storage.getTableJoinRequests(req.params.id);
    res.json(requests);
  });
  app.post("/api/tables/:id/join-requests/:reqId/approve", requireActive, async (req, res) => {
    const updated = await storage.updateJoinRequestStatus(req.params.reqId, "APPROVED");
    // Add to table members
    await storage.addTableMember(req.params.id, updated.userId);
    res.json(updated);
  });
  app.post("/api/tables/:id/join-requests/:reqId/decline", requireActive, async (req, res) => {
    const updated = await storage.updateJoinRequestStatus(req.params.reqId, "DECLINED");
    res.json(updated);
  });

  // Admin: table management
  app.post("/api/admin/tables", requireAdmin, async (req, res) => {
    const table = await storage.createTable({ ...req.body, createdByUserId: req.session.userId });
    if (req.session.userId) await storage.addTableMember(table.id, req.session.userId, "HOST");
    res.json(table);
  });
  app.post("/api/admin/tables/:id/status", requireAdmin, async (req, res) => {
    const { status } = req.body;
    const table = await storage.updateTableStatus(req.params.id, status);
    res.json(table);
  });

  // ─── Table Requests ───────────────────────────────────────────────────────

  app.post("/api/table-requests", requireActive, async (req, res) => {
    const { title, purpose, tags, reason } = req.body;
    const mod = await moderateContent(`${title} ${purpose} ${reason || ""}`);
    if (mod.flagged) return res.status(400).json({ error: "This may not meet TRYBE's professional conduct standards. Please rephrase." });
    const request = await storage.createTableRequest({ title, purpose, tags, reason, requestedByUserId: req.session.userId });
    res.json(request);
  });
  app.get("/api/admin/table-requests", requireAdmin, async (req, res) => {
    const requests = await storage.getAllTableRequests();
    res.json(requests);
  });
  app.post("/api/admin/table-requests/:id/approve", requireAdmin, async (req, res) => {
    const updated = await storage.updateTableRequestStatus(req.params.id, "APPROVED");
    // Auto-create the table
    const table = await storage.createTable({ title: updated.title, purpose: updated.purpose, tags: updated.tags ?? [], createdByUserId: updated.requestedByUserId ?? undefined });
    if (updated.requestedByUserId) await storage.addTableMember(table.id, updated.requestedByUserId, "HOST");
    await createAuditEntry({ actorUserId: req.session.userId, action: "TABLE_REQUEST_APPROVED", targetType: "TABLE_REQUEST", targetId: req.params.id });
    res.json({ request: updated, table });
  });
  app.post("/api/admin/table-requests/:id/decline", requireAdmin, async (req, res) => {
    const updated = await storage.updateTableRequestStatus(req.params.id, "DECLINED");
    res.json(updated);
  });

  // ─── Threads ──────────────────────────────────────────────────────────────

  app.get("/api/tables/:tableId/threads", requireActive, async (req, res) => {
    const threads = await storage.getThreadsByTable(req.params.tableId);
    res.json(threads);
  });
  app.post("/api/tables/:tableId/threads", requireActive, async (req, res) => {
    const { title } = req.body;
    const mod = await moderateContent(title);
    if (mod.flagged) return res.status(400).json({ error: "This may not meet TRYBE's professional conduct standards. Please rephrase." });
    const isMember = await storage.isTableMember(req.params.tableId, req.session.userId!);
    if (!isMember) return res.status(403).json({ error: "Must be a table member to start threads" });
    const thread = await storage.createThread({ tableId: req.params.tableId, title, createdByUserId: req.session.userId });
    res.json(thread);
  });
  app.get("/api/threads/:id", requireActive, async (req, res) => {
    const thread = await storage.getThreadById(req.params.id);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const posts = await storage.getPostsByThread(req.params.id);
    res.json({ ...thread, posts });
  });

  // ─── Posts ────────────────────────────────────────────────────────────────

  app.get("/api/threads/:threadId/posts", requireActive, async (req, res) => {
    const posts = await storage.getPostsByThread(req.params.threadId);
    res.json(posts);
  });
  app.post("/api/threads/:threadId/posts", requireActive, async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });
    const mod = await moderateContent(content);
    if (mod.flagged) {
      await storage.createModerationItem({ contentType: "POST", contentId: "pending", reason: mod.reason || "Flagged", reportedByUserId: req.session.userId });
      return res.status(400).json({ error: "This may not meet TRYBE's professional conduct standards. Please rephrase and try again." });
    }
    const post = await storage.createPost({ threadId: req.params.threadId, userId: req.session.userId, content, moderationStatus: "CLEAN" });
    res.json(post);
  });
  app.post("/api/admin/posts/:id/moderation", requireAdmin, async (req, res) => {
    const { status } = req.body;
    const post = await storage.updatePostModeration(req.params.id, status);
    res.json(post);
  });

  // ─── DMs ─────────────────────────────────────────────────────────────────

  app.get("/api/messages", requireActive, async (req, res) => {
    const convs = await storage.getDmConversationsForUser(req.session.userId!);
    res.json(convs);
  });
  app.post("/api/messages", requireActive, async (req, res) => {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: "Target user required" });
    const conv = await storage.createDmConversation(req.session.userId!, targetUserId);
    res.json(conv);
  });
  app.get("/api/messages/:id", requireActive, async (req, res) => {
    const conv = await storage.getDmConversationById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Not found" });
    if (conv.userAId !== req.session.userId && conv.userBId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    const messages = await storage.getDmMessages(req.params.id);
    res.json({ ...conv, messages });
  });
  app.post("/api/messages/:id/send", requireActive, async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });
    const mod = await moderateContent(content);
    if (mod.flagged) return res.status(400).json({ error: "This may not meet TRYBE's professional conduct standards. Please rephrase." });
    const msg = await storage.createDmMessage({ conversationId: req.params.id, senderId: req.session.userId, content });
    res.json(msg);
  });

  // ─── Calendar ─────────────────────────────────────────────────────────────

  app.get("/api/calendar", requireActive, async (req, res) => {
    const events = await storage.getAllCalendarEvents();
    const signals = await storage.getUserSignals(req.session.userId!);
    res.json({ events, signals });
  });
  app.post("/api/calendar/:id/signal", requireActive, async (req, res) => {
    const { signalType } = req.body;
    const signal = await storage.upsertSignal(req.session.userId!, req.params.id, signalType);
    res.json(signal);
  });
  app.post("/api/admin/calendar", requireAdmin, async (req, res) => {
    const event = await storage.createCalendarEvent(req.body);
    res.json(event);
  });
  app.delete("/api/admin/calendar/:id", requireAdmin, async (req, res) => {
    await storage.deleteCalendarEvent(req.params.id);
    res.json({ success: true });
  });

  // ─── Feedback ─────────────────────────────────────────────────────────────

  app.post("/api/feedback", requireActive, async (req, res) => {
    const { contextType, contextId, category, rating, message } = req.body;
    if (!message || !category) return res.status(400).json({ error: "Required fields missing" });
    const fb = await storage.createFeedback({ userId: req.session.userId, contextType: contextType || "GENERAL", contextId, category, rating, message });
    res.json(fb);
  });
  app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    const items = await storage.getAllFeedback();
    res.json(items);
  });

  // ─── Moderation ───────────────────────────────────────────────────────────

  app.get("/api/admin/moderation", requireAdmin, async (req, res) => {
    const items = await storage.getAllModerationItems();
    res.json(items);
  });
  app.post("/api/admin/moderation/:id/resolve", requireAdmin, async (req, res) => {
    const item = await storage.resolveModerationItem(req.params.id);
    res.json(item);
  });

  // ─── Audit Log ────────────────────────────────────────────────────────────

  app.get("/api/admin/audit-log", requireAdmin, async (req, res) => {
    const entries = await storage.getAuditLog();
    res.json(entries);
  });

  // ─── TRYBE Assistant ──────────────────────────────────────────────────────

  app.post("/api/assistant/suggest-tables", requireActive, async (req, res) => {
    const { profile: profileOverride } = req.body;
    const user = await storage.getUserById(req.session.userId!);
    const profile = profileOverride || await storage.getUserProfile(req.session.userId!);
    const allTables = await storage.getAllTables();
    const userTableIds = (await storage.getTablesForUser(req.session.userId!)).map(t => t.id);
    const availableTables = allTables.filter(t => !userTableIds.includes(t.id));

    if (!openai || availableTables.length === 0) {
      const suggestions = availableTables.slice(0, 3).map(t => ({
        tableId: t.id,
        title: t.title,
        purpose: t.purpose,
        tags: t.tags,
        reason: "Relevant to your areas of focus.",
      }));
      return res.json({ suggestions });
    }

    const tableList = availableTables.map(t =>
      `ID: ${t.id} | Title: ${t.title} | Purpose: ${t.purpose} | Tags: ${(t.tags || []).join(", ")}`
    ).join("\n");

    const prompt = `You are TRYBE Assistant helping a new user find the most relevant collaboration tables.

User profile:
- Name: ${user?.name}
- Organisation: ${user?.organisation || "Not specified"}
- Role: ${user?.roleTitle || "Not specified"}
- Health role: ${profile?.healthRole || "Not specified"}
- Disease interests: ${(profile?.interests || []).join(", ") || "Not specified"}
- Regions: ${(profile?.regions || []).join(", ") || "Not specified"}
- Current goal: ${profile?.currentGoal || "Not specified"}
- Collaboration mode: ${profile?.collaborationMode || "OBSERVE"}

Available collaboration tables:
${tableList}

Select exactly 3 tables that best match this user's profile. Prefer tables that align with their disease interests and regions. Return JSON:
{
  "suggestions": [
    {"tableId": "...", "title": "...", "reason": "One sentence explaining why this table suits them specifically."},
    {"tableId": "...", "title": "...", "reason": "..."},
    {"tableId": "...", "title": "...", "reason": "..."}
  ]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 600,
      });
      let parsed: any = {};
      try { parsed = JSON.parse(completion.choices[0]?.message?.content || "{}"); } catch {}
      const suggestions = (parsed.suggestions || []).map((s: any) => {
        const table = allTables.find(t => t.id === s.tableId);
        return table ? { tableId: s.tableId, title: s.title || table.title, purpose: table.purpose, tags: table.tags, reason: s.reason } : null;
      }).filter(Boolean);
      res.json({ suggestions });
    } catch (err: any) {
      console.error("[Assistant/SuggestTables]", err?.message);
      const fallback = availableTables.slice(0, 3).map(t => ({
        tableId: t.id, title: t.title, purpose: t.purpose, tags: t.tags,
        reason: "Relevant to your areas of focus.",
      }));
      res.json({ suggestions: fallback });
    }
  });

  app.post("/api/assistant", requireActive, async (req, res) => {
    const { message, context, history } = req.body;
    const user = await storage.getUserById(req.session.userId!);
    const profile = await storage.getUserProfile(req.session.userId!);
    const allTables = await storage.getAllTables();
    const userTables = await storage.getTablesForUser(req.session.userId!);
    const userTableIds = userTables.map(t => t.id);
    const availableTables = allTables.filter(t => !userTableIds.includes(t.id));

    if (!openai) {
      return res.json({
        assistantText: "I'm here to support your work. Explore the Tables section to find collaboration spaces relevant to your focus.",
        suggestedActions: [
          { type: "NAVIGATE", label: "Browse Tables", url: "/app/tables" },
          { type: "NAVIGATE", label: "View Moments", url: "/app/moments" },
        ],
      });
    }

    // ── Fetch page-specific context ──────────────────────────────────────────
    let threadContext = "";
    let tableContext = "";
    let calendarContext = "";

    if (context?.threadId) {
      try {
        const thread = await storage.getThreadById(context.threadId);
        const posts = await storage.getPostsByThread(context.threadId);
        if (thread) {
          const postLines = posts
            .filter(p => p.post.moderationStatus === "CLEAN")
            .slice(-20)
            .map(p => `[${p.user?.name || "Member"}]: ${p.post.content}`)
            .join("\n");
          threadContext = `\nCurrent thread: "${thread.title}"${postLines ? `\nDiscussion so far:\n${postLines}` : " (no posts yet)"}`;
        }
      } catch {}
    }

    if (context?.tableId) {
      try {
        const table = await storage.getTableById(context.tableId);
        const threads = await storage.getThreadsByTable(context.tableId);
        if (table) {
          tableContext = `\nCurrent table: "${table.title}"\nPurpose: ${table.purpose}\nActive threads: ${threads.map(t => `"${t.title}"`).join(", ") || "None yet"}`;
        }
      } catch {}
    }

    // Fetch upcoming calendar events (next 90 days)
    try {
      const allEvents = await storage.getAllCalendarEvents();
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const upcoming = allEvents
        .filter(e => e.startDate >= today && e.startDate <= cutoff)
        .slice(0, 5)
        .map(e => `- ${e.title} (${e.startDate})${e.organiser ? ` — ${e.organiser}` : ""}${e.tags?.length ? ` [${e.tags.join(", ")}]` : ""}`)
        .join("\n");
      if (upcoming) calendarContext = `\nUpcoming health moments (next 90 days):\n${upcoming}`;
    } catch {}

    // ── Build system prompt ──────────────────────────────────────────────────
    const myTablesSummary = userTables.length > 0
      ? userTables.map(t => `- ${t.title} (ID: ${t.id})`).join("\n")
      : "None yet";
    const availableTablesSummary = availableTables.slice(0, 12).map(t =>
      `- ${t.title} (ID: ${t.id}) | Tags: ${(t.tags || []).join(", ")}`
    ).join("\n");

    const systemPrompt = `You are TRYBE Assistant — a calm, professional, neutral AI assistant embedded in TRYBE, a private invite-only global health collaboration platform.

TRYBE's philosophy: Human-led. AI-supported. You suggest, the user decides. Never act autonomously.

━━━ YOUR IDENTITY & TONE ━━━
- Warm but restrained. Plain English, no hype or jargon.
- Professional, like a well-informed colleague — not a chatbot.
- Concise. 2–4 sentences unless drafting content or summarising.
- Never use emoji. Never be sycophantic.

━━━ ABSOLUTE LIMITS ━━━
- Never provide medical advice, clinical guidance, or diagnoses.
- Never take political or policy positions on behalf of TRYBE.
- Never act without explicit user confirmation (all actions are suggestions only).
- Never fabricate table IDs, thread IDs, or content. Use only IDs from the data below.
- If you do not know something, say so plainly.

━━━ YOUR CAPABILITIES BY CONTEXT ━━━

1. SUGGEST TABLES
   When the user wants table recommendations, use the "Available tables" list below.
   Explain in one sentence why each matches their profile. Use SUGGEST_JOIN_TABLE action.

2. SUMMARISE A THREAD
   When asked to summarise, use the thread discussion content provided below.
   Write a structured summary: key themes, main points raised, any emerging consensus or open questions.
   Put the summary in "summaryContent", not just assistantText.

3. DRAFT A POST OR MESSAGE
   When asked to draft content, write a professional, neutral draft.
   Do not publish it — put it in "draftContent" so the user can review and edit before using.
   Keep drafts factual and collaborative in tone.

4. SURFACE CALENDAR MOMENTS
   Use the upcoming events listed below. Suggest which ones are relevant to the user's focus areas.
   Suggest relevant tables or discussions that align with the event.

5. ADJUST PREFERENCES
   If the user asks to change their assistant activity level or collaboration mode, explain
   they can update this in Settings, and use NAVIGATE to /app/settings.

6. GENERAL SUPPORT
   Answer questions about how TRYBE works. Help the user understand their workspace.
   If they seem stuck, suggest a next step.

━━━ USER PROFILE ━━━
- Name: ${user?.name}
- Organisation: ${user?.organisation || "Not specified"}
- Role: ${user?.roleTitle || "Not specified"} ${profile?.healthRole ? `(${profile.healthRole})` : ""}
- Disease interests: ${(profile?.interests || []).join(", ") || "Not specified"}
- Regions: ${(profile?.regions || []).join(", ") || "Not specified"}
- Collaboration mode: ${profile?.collaborationMode || "OBSERVE"}
- Assistant activity: ${profile?.assistantActivityLevel || "BALANCED"}
- Current goal: ${profile?.currentGoal || "Not specified"}

━━━ PLATFORM DATA ━━━
Tables I belong to:
${myTablesSummary || "None yet"}

Available tables to suggest (not yet a member):
${availableTablesSummary || "None available"}
${calendarContext}${threadContext}${tableContext}

━━━ CURRENT CONTEXT ━━━
Page: ${context?.page || "/app"}${context?.threadId ? ` | Thread ID: ${context.threadId}` : ""}${context?.tableId ? ` | Table ID: ${context.tableId}` : ""}

━━━ RESPONSE FORMAT ━━━
Always respond with valid JSON:
{
  "assistantText": "Your main response (2–4 sentences unless summarising/drafting)",
  "summaryContent": "Full thread/discussion summary here — only include if user asked to summarise",
  "draftContent": "Full draft post or message here — only include if user asked to draft something",
  "suggestedActions": [
    {"type": "SUGGEST_JOIN_TABLE", "tableId": "exact-id-from-list", "label": "View: Table Name"},
    {"type": "NAVIGATE", "label": "Go to Moments", "url": "/app/moments"},
    {"type": "NAVIGATE", "label": "Go to Settings", "url": "/app/settings"}
  ]
}
Rules:
- suggestedActions: 0–3 items, only genuinely relevant ones. Never fabricate IDs.
- summaryContent: only when summarising a thread — structured, not just a paragraph.
- draftContent: only when drafting — ready to use but clearly a draft.
- Omit any field that is not needed (no empty strings for summaryContent/draftContent).`;

    // Build conversation history for the model
    const conversationMessages: { role: "user" | "assistant"; content: string }[] = (history || [])
      .slice(-8)
      .map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));
    conversationMessages.push({ role: "user", content: message });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
        ],
        response_format: { type: "json_object" },
        max_tokens: 800,
      });
      let result: any = { assistantText: "", suggestedActions: [] };
      try { result = JSON.parse(completion.choices[0]?.message?.content || "{}"); } catch {}

      // Second-pass: moderate any draft content produced by the AI
      if (result.draftContent && openai) {
        try {
          const modCheck = await openai.moderations.create({ input: result.draftContent });
          if (modCheck.results[0]?.flagged) {
            result.draftContent = undefined;
            result.assistantText = "I wasn't able to produce a suitable draft for that request. Please rephrase what you'd like me to help with.";
          }
        } catch {}
      }

      res.json(result);
    } catch (err: any) {
      console.error("[Assistant]", err?.message);
      res.json({ assistantText: "I'm having trouble right now. Please try again in a moment.", suggestedActions: [] });
    }
  });

  // ─── Admin: Unified Action Endpoints ────────────────────────────────────

  app.get("/api/admin/invites", requireAdmin, async (req, res) => {
    const invites = await storage.getAllInvites();
    res.json(invites);
  });
  app.post("/api/admin/invites", requireAdmin, async (req, res) => {
    const { email, recipientName, expiresInDays } = req.body;
    const expiresAt = new Date(Date.now() + (expiresInDays || 30) * 86400000);
    const invite = await storage.createInvite({ email, createdByUserId: req.session.userId, expiresAt });
    await createAuditEntry({ actorUserId: req.session.userId, action: "INVITE_CREATED", targetType: "INVITE", targetId: invite.id, metadata: { email } });
    let emailSent = false;
    let emailError: string | undefined;
    if (email) {
      const result = await sendInviteEmail(email, recipientName, invite.token);
      emailSent = result.sent;
      emailError = result.error;
    }
    res.json({ ...invite, emailSent, emailError });
  });
  app.delete("/api/admin/invites/:id", requireAdmin, async (req, res) => {
    const invite = await storage.revokeInvite(req.params.id);
    res.json(invite);
  });

  app.post("/api/admin/users/:userId/action", requireAdmin, async (req, res) => {
    const { action } = req.body;
    const { userId } = req.params;
    let user;
    if (action === "APPROVE") {
      user = await storage.updateUserStatus(userId, "ACTIVE");
      await createAuditEntry({ actorUserId: req.session.userId, action: "USER_APPROVED", targetType: "USER", targetId: userId });
      if (user?.email) sendAccountApprovedEmail(user.email, user.name).catch(() => {});
    } else if (action === "REJECT") {
      user = await storage.updateUserStatus(userId, "REJECTED");
      await createAuditEntry({ actorUserId: req.session.userId, action: "USER_REJECTED", targetType: "USER", targetId: userId });
    } else if (action === "SUSPEND") {
      user = await storage.updateUserStatus(userId, "SUSPENDED");
      await createAuditEntry({ actorUserId: req.session.userId, action: "USER_SUSPENDED", targetType: "USER", targetId: userId });
    } else if (action === "REACTIVATE") {
      user = await storage.updateUserStatus(userId, "ACTIVE");
      await createAuditEntry({ actorUserId: req.session.userId, action: "USER_REACTIVATED", targetType: "USER", targetId: userId });
    } else {
      return res.status(400).json({ error: "Unknown action" });
    }
    res.json({ ...user, passwordHash: undefined });
  });

  app.post("/api/admin/invite-requests/:id/action", requireAdmin, async (req, res) => {
    const { action } = req.body;
    if (action === "APPROVE") {
      const updated = await storage.updateInviteRequestStatus(req.params.id, "APPROVED");
      const invite = await storage.createInvite({ email: updated.email, createdByUserId: req.session.userId, expiresAt: new Date(Date.now() + 30 * 86400000) });
      let emailSent = false;
      if (updated.email) {
        emailSent = await sendInviteRequestApprovedEmail(updated.email, updated.name, invite.token);
      }
      res.json({ request: updated, invite, emailSent });
    } else if (action === "REJECT") {
      const updated = await storage.updateInviteRequestStatus(req.params.id, "REJECTED");
      res.json(updated);
    } else {
      res.status(400).json({ error: "Unknown action" });
    }
  });

  app.post("/api/admin/table-requests/:id/action", requireAdmin, async (req, res) => {
    const { action } = req.body;
    if (action === "APPROVE") {
      const updated = await storage.updateTableRequestStatus(req.params.id, "APPROVED");
      const table = await storage.createTable({ title: updated.title, purpose: updated.purpose, tags: updated.tags ?? [], createdByUserId: updated.requestedByUserId ?? undefined });
      if (updated.requestedByUserId) await storage.addTableMember(table.id, updated.requestedByUserId, "HOST");
      await createAuditEntry({ actorUserId: req.session.userId, action: "TABLE_REQUEST_APPROVED", targetType: "TABLE_REQUEST", targetId: req.params.id });
      res.json({ request: updated, table });
    } else if (action === "REJECT") {
      const updated = await storage.updateTableRequestStatus(req.params.id, "DECLINED");
      res.json(updated);
    } else {
      res.status(400).json({ error: "Unknown action" });
    }
  });

  app.post("/api/admin/moderation/:id/review", requireAdmin, async (req, res) => {
    const { action, adminNote } = req.body;
    const item = await storage.resolveModerationItem(req.params.id);
    await createAuditEntry({ actorUserId: req.session.userId, action: "MODERATION_ACTION", targetType: "MODERATION", targetId: req.params.id, metadata: { action, adminNote } });
    res.json(item);
  });

  // ─── Admin Metrics ────────────────────────────────────────────────────────

  app.get("/api/admin/metrics", requireAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    const tables = await storage.getAllTables();
    const feedback = await storage.getAllFeedback();
    const modItems = await storage.getAllModerationItems();
    res.json({
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === "ACTIVE").length,
      pendingApproval: users.filter(u => u.status === "PENDING_APPROVAL").length,
      totalTables: tables.length,
      totalFeedback: feedback.length,
      openModerationItems: modItems.filter(m => m.status === "OPEN").length,
    });
  });

  return httpServer;
}

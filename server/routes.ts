import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import * as storage from "./storage";
import { createAuditEntry } from "./storage";
import OpenAI from "openai";
import { sendInviteEmail, sendMemberInviteEmail, sendInviteRequestApprovedEmail, sendAccountApprovedEmail, sendAccountSuspendedEmail, sendAccountReactivatedEmail, sendTableJoinApprovedEmail, sendTableJoinDeclinedEmail, sendTableRequestDeclinedEmail, sendPasswordResetEmail, sendMilestoneAttendingEmail } from "./email";
import { randomBytes } from "crypto";
import { savePushSubscription, removePushSubscription, sendPushToUser, sendPushToMultipleUsers } from "./push";
import multer from "multer";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { assistantTools, executeTool, READ_ONLY_TOOLS, TOOL_LABELS } from "./assistant-tools";
import { classifyIntent, getToolsForIntent, buildUserProfile, buildMyTablesSummary, buildAvailableTablesSummary, buildUpcomingEventsSummary, compressConversationHistory, getOrBuildThreadSummary } from "./context-builder";

declare module "express-session" {
  interface SessionData {
    userId: string;
    pendingActions?: { tool: string; args: any; label: string; description: string }[];
  }
}

const openai = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  ? new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "replit",
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    })
  : process.env.OPENAI_API_KEY
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

// ─── Multer Setup ─────────────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Serve uploaded files
  const express = await import("express");
  app.use("/uploads", express.default.static(uploadsDir));

  // ── WebSocket Signaling Server (live audio calls) ────────────────────────────
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const wsClients = new Map<string, WebSocket>();
  wss.on("connection", (ws) => {
    let registeredUserId: string | null = null;
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "register") {
          registeredUserId = msg.userId;
          wsClients.set(msg.userId, ws);
          return;
        }
        if (msg.to) {
          const target = wsClients.get(msg.to);
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({ ...msg, from: registeredUserId }));
          }
        }
      } catch {}
    });
    ws.on("close", () => {
      if (registeredUserId) wsClients.delete(registeredUserId);
    });
  });

  const PgStore = pgSession(session);
  const sessionPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000, keepAlive: true });
  app.use(session({
    store: new PgStore({ pool: sessionPool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "trybe-secret-key-change-in-prod",
    resave: false,
    saveUninitialized: false,
    rolling: true,
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
    await createAuditEntry({ actorUserId: user.id, action: "USER_REGISTERED", targetType: "USER", targetId: user.id, metadata: { inviteType: invite.inviteType, invitedBy: invite.createdByUserId } });

    // Auto-verify for demo
    const verified = await storage.verifyUserEmail(user.emailVerifyToken!);

    // Tiered approval: member invites auto-approve, admin codes require manual approval
    if (invite.autoApproveOnUse && !invite.requiresManualApproval) {
      const activated = await storage.updateUserStatus(verified!.id, "ACTIVE");
      await createAuditEntry({ actorUserId: verified!.id, action: "AUTO_APPROVED", targetType: "USER", targetId: verified!.id, metadata: { inviteType: invite.inviteType, invitedBy: invite.createdByUserId } });
      req.session.userId = activated!.id;
      await storage.updateUserLastLogin(activated!.id);
      return new Promise<void>((resolve) => {
        req.session.save(() => {
          res.json({ user: { ...activated, passwordHash: undefined }, autoApproved: true, message: "Your access has been confirmed." });
          resolve();
        });
      });
    }

    return res.json({ user: { ...verified, passwordHash: undefined }, autoApproved: false, message: "Registration successful. Awaiting admin approval." });
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

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.setPasswordResetToken(user.id, token, expiresAt);
      await sendPasswordResetEmail(user.email, user.name, token);
    }
    return res.json({ success: true });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
    if (password.length < 12) return res.status(400).json({ error: "Password must be at least 12 characters" });
    const user = await storage.getUserByResetToken(token);
    if (!user) return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
    await storage.resetPassword(user.id, password);
    return res.json({ success: true });
  });

  app.post("/api/auth/reactivation-appeal", async (req, res) => {
    const { email, message } = req.body;
    if (!email || !message) return res.status(400).json({ error: "Email and message are required" });
    if (message.trim().length < 20) return res.status(400).json({ error: "Please provide a more detailed message (at least 20 characters)." });
    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    if (!user || user.status !== "SUSPENDED") return res.status(400).json({ error: "No suspended account found with this email address." });
    const existingAppeals = await storage.getReactivationAppealsByUser(user.id);
    const pendingAppeal = existingAppeals.find(a => a.status === "PENDING");
    if (pendingAppeal) return res.status(400).json({ error: "You already have a pending appeal. The admin team will review it shortly." });
    const appeal = await storage.createReactivationAppeal(user.id, message.trim());
    await createAuditEntry({ actorUserId: user.id, action: "REACTIVATION_APPEAL_SUBMITTED", targetType: "USER", targetId: user.id });
    return res.json({ success: true, appeal });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Current and new password are required" });
    if (newPassword.length < 12) return res.status(400).json({ error: "New password must be at least 12 characters" });
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const valid = await storage.verifyPassword(user, currentPassword);
    if (!valid) return res.status(400).json({ error: "Current password is incorrect" });
    await storage.resetPassword(user.id, newPassword);
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

  // ─── Member Invites ─────────────────────────────────────────────────────

  app.get("/api/invites/my", requireActive, async (req, res) => {
    const invites = await storage.getInvitesByCreator(req.session.userId!);
    const memberInvites = invites.filter(i => i.inviteType === "MEMBER_INVITE");
    const quota = await storage.getUserInviteQuota(req.session.userId!);
    res.json({ invites: memberInvites, quota });
  });

  app.post("/api/invites/send", requireActive, async (req, res) => {
    const { email, note } = req.body;
    if (!email) return res.status(400).json({ error: "Email address is required" });

    const user = await storage.getUserById(req.session.userId!);
    if (!user || user.status !== "ACTIVE") return res.status(403).json({ error: "Only active members can send invitations" });
    if (!user.canInvite) return res.status(403).json({ error: "Your invite privileges have been paused. Please contact an admin." });

    const quota = await storage.getUserInviteQuota(req.session.userId!);
    if (!quota || quota.remaining <= 0) return res.status(429).json({ error: `You've used all ${quota?.total || 5} invitations this month. Your quota resets next month.` });

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: "Someone with this email address is already on TRYBE." });

    const invite = await storage.createInvite({
      email,
      createdByUserId: req.session.userId,
      expiresAt: new Date(Date.now() + 14 * 86400000),
      inviteType: "MEMBER_INVITE",
      autoApproveOnUse: true,
      requiresManualApproval: false,
      maxUses: 1,
      recipientNote: note,
    });

    await storage.incrementInviteQuotaUsed(req.session.userId!);
    await createAuditEntry({
      actorUserId: req.session.userId,
      action: "MEMBER_INVITE_CREATED",
      targetType: "INVITE",
      targetId: invite.id,
      metadata: { email, inviteType: "MEMBER_INVITE" },
    });

    let emailSent = false;
    let emailError: string | undefined;
    const result = await sendMemberInviteEmail(email, user.name, invite.token, note);
    emailSent = result.sent;
    emailError = result.error;

    const updatedQuota = await storage.getUserInviteQuota(req.session.userId!);
    res.json({ invite, emailSent, emailError, quota: updatedQuota });
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
    const appeals = await storage.getAllAppeals();
    const pendingAppealsByUser: Record<string, any> = {};
    for (const a of appeals) {
      if (a.status === "PENDING") {
        pendingAppealsByUser[a.userId] = { id: a.id, message: a.message, createdAt: a.createdAt };
      }
    }
    res.json(users.map(u => ({ ...u, passwordHash: undefined, pendingAppeal: pendingAppealsByUser[u.id] || null })));
  });
  app.post("/api/admin/users/:id/approve", requireAdmin, async (req, res) => {
    const user = await storage.updateUserStatus(req.params.id, "ACTIVE");
    await createAuditEntry({ actorUserId: req.session.userId, action: "USER_APPROVED", targetType: "USER", targetId: req.params.id });
    res.json({ ...user, passwordHash: undefined });
  });
  app.post("/api/admin/users/:id/suspend", requireAdmin, async (req, res) => {
    const user = await storage.updateUserStatus(req.params.id, "SUSPENDED");
    await createAuditEntry({ actorUserId: req.session.userId, action: "USER_SUSPENDED", targetType: "USER", targetId: req.params.id });
    if (user?.email) sendAccountSuspendedEmail(user.email, user.name).catch(() => {});
    res.json({ ...user, passwordHash: undefined });
  });
  app.post("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    const { role } = req.body;
    const user = await storage.updateUserRole(req.params.id, role);
    res.json({ ...user, passwordHash: undefined });
  });

  // ─── User Profile ─────────────────────────────────────────────────────────

  app.get("/api/push/vapid-key", requireActive, (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
  });
  app.post("/api/push/subscribe", requireActive, async (req, res) => {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    await savePushSubscription(req.session.userId!, subscription);
    res.json({ success: true });
  });
  app.post("/api/push/unsubscribe", requireActive, async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Endpoint required" });
    await removePushSubscription(req.session.userId!, endpoint);
    res.json({ success: true });
  });

  app.get("/api/profile", requireActive, async (req, res) => {
    const profile = await storage.getUserProfile(req.session.userId!);
    res.json(profile);
  });

  app.put("/api/user/profile", requireActive, async (req, res) => {
    const { name, organisation, roleTitle, bio, contactVisibility } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (organisation !== undefined) updates.organisation = organisation;
    if (roleTitle !== undefined) updates.roleTitle = roleTitle;
    if (bio !== undefined) {
      if (bio && bio.trim()) {
        const mod = await moderateContent(bio);
        if (mod.flagged) return res.status(400).json({ error: "Bio content may not meet TRYBE's professional conduct standards." });
      }
      updates.bio = bio;
    }
    if (contactVisibility !== undefined) {
      if (!["EVERYONE", "MEMBERS_ONLY", "NOBODY"].includes(contactVisibility)) {
        return res.status(400).json({ error: "Invalid contact visibility" });
      }
      updates.contactVisibility = contactVisibility;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
    const user = await storage.updateUserProfile(req.session.userId!, updates);
    res.json({ ...user, passwordHash: undefined });
  });

  app.put("/api/user/avatar", requireActive, async (req, res) => {
    const { avatarUrl } = req.body;
    if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== "string") {
      return res.status(400).json({ error: "Invalid avatar URL" });
    }
    const user = await storage.updateUserProfile(req.session.userId!, { avatarUrl: avatarUrl || null });
    res.json({ ...user, passwordHash: undefined });
  });

  app.get("/api/users/:userId/public-profile", requireActive, async (req, res) => {
    const targetUser = await storage.getUserById(req.params.userId);
    if (!targetUser || targetUser.status !== "ACTIVE") return res.status(404).json({ error: "User not found" });

    const profile = await storage.getUserProfile(targetUser.id);
    const userTables = await storage.getTablesForUser(targetUser.id);

    let showEmail = targetUser.contactVisibility === "EVERYONE";
    if (!showEmail && targetUser.contactVisibility === "MEMBERS_ONLY" && req.session.userId) {
      const viewerTables = await storage.getTablesForUser(req.session.userId!);
      const viewerTableIds = new Set(viewerTables.map(t => t.id));
      showEmail = userTables.some(t => viewerTableIds.has(t.id));
    }

    res.json({
      id: targetUser.id,
      name: targetUser.name,
      handle: targetUser.handle,
      organisation: targetUser.organisation,
      roleTitle: targetUser.roleTitle,
      bio: targetUser.bio,
      avatarUrl: targetUser.avatarUrl,
      email: showEmail ? targetUser.email : undefined,
      contactVisibility: targetUser.contactVisibility,
      createdAt: targetUser.createdAt,
      healthRole: profile?.healthRole,
      regions: profile?.regions || [],
      interests: profile?.interests || [],
      tables: userTables.map(t => ({ id: t.id, title: t.title, purpose: t.purpose })),
    });
  });

  app.put("/api/handle", requireActive, async (req, res) => {
    const { handle } = req.body;
    if (!handle || typeof handle !== "string") return res.status(400).json({ error: "Handle is required" });
    const cleaned = handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleaned.length < 3) return res.status(400).json({ error: "Handle must be at least 3 characters (letters, numbers, underscores only)" });
    if (cleaned.length > 30) return res.status(400).json({ error: "Handle must be 30 characters or fewer" });
    const updated = await storage.updateUserHandle(req.session.userId!, cleaned);
    if (!updated) return res.status(409).json({ error: "That handle is already taken. Try another." });
    res.json(updated);
  });
  app.put("/api/profile", requireActive, async (req, res) => {
    const { profileSnapshot, currentGoal, ...rest } = req.body;
    const textToCheck = [profileSnapshot, currentGoal].filter(Boolean).join(" ");
    if (textToCheck.trim()) {
      const mod = await moderateContent(textToCheck);
      if (mod.flagged) return res.status(400).json({ error: "Profile content may not meet TRYBE's professional conduct standards. Please rephrase." });
    }
    const profile = await storage.upsertUserProfile(req.session.userId!, req.body);
    res.json(profile);
  });

  // ─── Onboarding NLP ──────────────────────────────────────────────────────

  app.post("/api/onboarding/process", requireActive, async (req, res) => {
    const { message, currentStep, currentProfile } = req.body;
    if (!message?.trim() || !currentStep) return res.status(400).json({ error: "Message and step required" });
    const user = await storage.getUserById(req.session.userId!);

    const VALID_ROLES = ["Patient Advocate","Public Health Professional","Policymaker / Advisor","Clinical Researcher","Industry Medical Team","Health NGO / Foundation","Academic / Educator","Journalist / Communications","Other"];
    const VALID_DISEASES = ["Cancer","Rare Disease","Diabetes","Mental Health","HIV/AIDS","TB","AMR","Cardiovascular","Respiratory","NCD Prevention","Neurology","Paediatrics","Maternal Health","Infectious Disease"];
    const VALID_REGIONS = ["Global","Europe","North America","Asia Pacific","Africa","Latin America","Middle East","South Asia"];

    if (!openai) {
      return res.json({
        profile: currentProfile || {},
        response: "I understand. Let's continue.",
        nextStep: currentStep,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are TRYBE Assistant, onboarding a new member named ${user?.name || "there"} to a private global health collaboration platform.
Parse the user's message to extract structured profile data for the current onboarding step.

Current step: "${currentStep}"
Current profile so far: ${JSON.stringify(currentProfile || {})}

EXTRACTION RULES:
- step "role": Match to ONE of these roles: ${JSON.stringify(VALID_ROLES)}. Pick the closest match. If unclear, use "Other".
- step "interests": Match to disease areas from: ${JSON.stringify(VALID_DISEASES)}. Extract ALL mentioned topics, even if phrased differently (e.g. "antimicrobial resistance" → "AMR", "heart disease" → "Cardiovascular"). Return as array.
- step "regions": Match to regions from: ${JSON.stringify(VALID_REGIONS)}. Interpret broadly (e.g. "Europe and Africa" → ["Europe", "Africa"], "worldwide" → ["Global"]). Return as array.
- step "goal": Extract a brief goal statement (1-2 sentences). If they mention specifics, include them.
- step "preferences": Extract collaborationMode (OBSERVE/CONTRIBUTE/LEAD) and assistantActivityLevel (QUIET/BALANCED/ACTIVE). Default to CONTRIBUTE and BALANCED if not specified.

Also write a brief, warm, professional acknowledgement (1-2 sentences, no emojis) that naturally transitions to the next topic. Do NOT ask the next question — just acknowledge.

Return ONLY valid JSON:
{
  "extracted": { ... only the fields relevant to this step ... },
  "response": "your acknowledgement text"
}`,
        },
        { role: "user", content: message },
      ],
      temperature: 0.4,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    try {
      const raw = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);
      const merged = { ...(currentProfile || {}), ...(parsed.extracted || {}) };
      res.json({
        profile: merged,
        response: parsed.response || "Understood. Let's continue.",
      });
    } catch {
      res.json({
        profile: currentProfile || {},
        response: "Thank you. Let's continue.",
      });
    }
  });

  // ─── Tables ───────────────────────────────────────────────────────────────

  app.get("/api/tables", requireActive, async (req, res) => {
    const search = (req.query.search as string || "").trim().toLowerCase();
    const allTables = await storage.getAllTables();
    const myTables = await storage.getTablesForUser(req.session.userId!);
    const myIds = new Set(myTables.map(t => t.id));
    const profile = await storage.getUserProfile(req.session.userId!);
    const userInterests = new Set([
      ...(profile?.interests || []).map((s: string) => s.toLowerCase()),
      ...(profile?.regions || []).map((s: string) => s.toLowerCase()),
      ...(profile?.healthRole ? [profile.healthRole.toLowerCase()] : []),
    ]);
    const scored = allTables.map(t => {
      const tableTags = (t.tags || []).map((s: string) => s.toLowerCase());
      const exactOverlap = tableTags.filter(tag => userInterests.has(tag)).length;
      let partialScore = 0;
      if (exactOverlap === 0) {
        for (const tag of tableTags) {
          for (const interest of userInterests) {
            if (tag.includes(interest) || interest.includes(tag)) {
              partialScore += 0.5;
            } else {
              const words = interest.split(/[\s\/]+/).filter(w => w.length > 2);
              if (words.some(w => tag.includes(w) || tag.split(/[\s\/]+/).some(tw => tw.includes(w)))) {
                partialScore += 0.3;
              }
            }
          }
        }
      }
      return { ...t, _score: exactOverlap + partialScore };
    });
    scored.sort((a, b) => {
      const aMember = myIds.has(a.id) ? 0 : 1;
      const bMember = myIds.has(b.id) ? 0 : 1;
      if (aMember !== bMember) return aMember - bMember;
      return b._score - a._score;
    });
    let filtered;
    if (search) {
      filtered = scored;
    } else {
      const matched = scored.filter(t => myIds.has(t.id) || t._score > 0);
      if (matched.length >= 5) {
        filtered = matched;
      } else {
        const recommended = scored
          .filter(t => !myIds.has(t.id) && t._score === 0)
          .slice(0, 10 - matched.length);
        filtered = [...matched, ...recommended];
      }
    }
    const pendingReqs = await storage.getUserPendingJoinRequests(req.session.userId!);
    const pendingTableIds = pendingReqs.map((r: any) => r.tableId);
    const clean = filtered.map(({ _score, ...t }) => t);
    res.json({ all: clean, myTableIds: Array.from(myIds), pendingTableIds });
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
    let hasPendingRequest = false;
    if (!isMember && table.requiresApprovalToJoin) {
      const joinReqs = await storage.getTableJoinRequests(req.params.id);
      hasPendingRequest = joinReqs.some((r: any) => r.request.userId === req.session.userId && r.request.status === "PENDING");
    }
    res.json({ ...table, members, isMember, threads, hasPendingRequest });
  });
  app.post("/api/tables/:id/join", requireActive, async (req, res) => {
    const table = await storage.getTableById(req.params.id);
    if (!table) return res.status(404).json({ error: "Not found" });
    const already = await storage.isTableMember(req.params.id, req.session.userId!);
    if (already) return res.status(400).json({ error: "Already a member" });
    if (table.requiresApprovalToJoin) {
      const existing = await storage.getTableJoinRequests(req.params.id);
      const pending = existing.find((r: any) => r.request.userId === req.session.userId && r.request.status === "PENDING");
      if (pending) return res.status(400).json({ error: "You already have a pending request for this table" });
      await storage.createTableJoinRequest(req.params.id, req.session.userId!);
      await createAuditEntry({ actorUserId: req.session.userId, action: "TABLE_JOIN_REQUESTED", targetType: "TABLE", targetId: req.params.id });
      return res.json({ status: "requested" });
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
    const table = await storage.getTableById(req.params.id);
    if (!table) return res.status(404).json({ error: "Not found" });
    const members = await storage.getTableMembers(req.params.id);
    const myRole = members.find((m: any) => m.user?.id === req.session.userId)?.member?.memberRole;
    if (myRole !== "HOST" && myRole !== "ASSIGNEE") return res.status(403).json({ error: "Only hosts and assignees can view join requests" });
    const requests = await storage.getTableJoinRequests(req.params.id);
    res.json(requests);
  });
  app.post("/api/tables/:id/join-requests/:reqId/approve", requireActive, async (req, res) => {
    const members = await storage.getTableMembers(req.params.id);
    const myRole = members.find((m: any) => m.user?.id === req.session.userId)?.member?.memberRole;
    if (myRole !== "HOST" && myRole !== "ASSIGNEE") return res.status(403).json({ error: "Only hosts and assignees can approve requests" });
    const updated = await storage.updateJoinRequestStatus(req.params.reqId, "APPROVED");
    await storage.addTableMember(req.params.id, updated.userId);
    const table = await storage.getTableById(req.params.id);
    const requester = await storage.getUserById(updated.userId);
    if (requester?.email && table) {
      sendTableJoinApprovedEmail(requester.email, requester.name, table.title).catch(() => {});
    }
    res.json(updated);
  });
  app.post("/api/tables/:id/join-requests/:reqId/decline", requireActive, async (req, res) => {
    const members = await storage.getTableMembers(req.params.id);
    const myRole = members.find((m: any) => m.user?.id === req.session.userId)?.member?.memberRole;
    if (myRole !== "HOST" && myRole !== "ASSIGNEE") return res.status(403).json({ error: "Only hosts and assignees can decline requests" });
    const updated = await storage.updateJoinRequestStatus(req.params.reqId, "DECLINED");
    const table = await storage.getTableById(req.params.id);
    const requester = await storage.getUserById(updated.userId);
    if (requester?.email && table) {
      sendTableJoinDeclinedEmail(requester.email, requester.name, table.title).catch(() => {});
    }
    res.json(updated);
  });

  // Member management: promote/demote/remove
  app.post("/api/tables/:id/members/:userId/role", requireActive, async (req, res) => {
    const { role } = req.body;
    if (!["ASSIGNEE", "MEMBER"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const members = await storage.getTableMembers(req.params.id);
    const myRole = members.find((m: any) => m.user?.id === req.session.userId)?.member?.memberRole;
    if (!myRole) return res.status(403).json({ error: "You are not a member of this table" });
    const targetRole = members.find((m: any) => m.user?.id === req.params.userId)?.member?.memberRole;
    if (!targetRole) return res.status(404).json({ error: "Member not found" });
    if (targetRole === "HOST") return res.status(403).json({ error: "Cannot change the host's role" });
    if (myRole !== "HOST") return res.status(403).json({ error: "Only the host can change member roles" });
    const updated = await storage.updateMemberRole(req.params.id, req.params.userId, role);
    return res.json(updated);
  });
  app.post("/api/tables/:id/members/:userId/remove", requireActive, async (req, res) => {
    const members = await storage.getTableMembers(req.params.id);
    const myRole = members.find((m: any) => m.user?.id === req.session.userId)?.member?.memberRole;
    if (!myRole) return res.status(403).json({ error: "You are not a member of this table" });
    const targetRole = members.find((m: any) => m.user?.id === req.params.userId)?.member?.memberRole;
    if (!targetRole) return res.status(404).json({ error: "Member not found" });
    if (targetRole === "HOST") return res.status(403).json({ error: "Cannot remove the host" });
    if (myRole === "HOST") {
      await storage.removeTableMember(req.params.id, req.params.userId);
      return res.json({ success: true });
    }
    if (myRole === "ASSIGNEE" && targetRole === "MEMBER") {
      await storage.removeTableMember(req.params.id, req.params.userId);
      return res.json({ success: true });
    }
    return res.status(403).json({ error: "Only hosts and assignees can remove members" });
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

  // ─── Table Creation (direct — no admin approval needed) ─────────────────

  app.post("/api/tables", requireActive, async (req, res) => {
    const { title, purpose, tags, requiresApprovalToJoin } = req.body;
    if (!title || !purpose) return res.status(400).json({ error: "Title and purpose are required." });
    const mod = await moderateContent(`${title} ${purpose}`);
    if (mod.flagged) return res.status(400).json({ error: "This may not meet TRYBE's professional conduct standards. Please rephrase." });
    const table = await storage.createTable({ title, purpose, tags: tags || [], createdByUserId: req.session.userId, requiresApprovalToJoin: requiresApprovalToJoin === true });
    await storage.addTableMember(table.id, req.session.userId!, "HOST");
    await createAuditEntry({ actorUserId: req.session.userId, action: "TABLE_CREATED", targetType: "TABLE", targetId: table.id });
    res.json(table);
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
    const memberRole = await storage.getTableMemberRole(thread.tableId, req.session.userId!);
    const isMember = !!memberRole;
    const isHost = memberRole === "HOST";
    res.json({ ...thread, posts, isMember, isHost });
  });
  app.post("/api/threads/:id/close", requireActive, async (req, res) => {
    const thread = await storage.getThreadById(req.params.id);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const memberRole = await storage.getTableMemberRole(thread.tableId, req.session.userId!);
    const isAdminUser = (await storage.getUserById(req.session.userId!))?.role === "ADMIN";
    if (memberRole !== "HOST" && !isAdminUser) return res.status(403).json({ error: "Only the table host can close threads" });
    const updated = await storage.closeThread(req.params.id);
    res.json(updated);
  });

  // ─── Posts ────────────────────────────────────────────────────────────────

  app.get("/api/threads/:threadId/posts", requireActive, async (req, res) => {
    const posts = await storage.getPostsByThread(req.params.threadId);
    res.json(posts);
  });
  app.post("/api/threads/:threadId/posts", requireActive, async (req, res) => {
    const { content, fileUrl, fileName, fileMimeType } = req.body;
    const hasFile = !!fileUrl;
    if (!content?.trim() && !hasFile) return res.status(400).json({ error: "Content or attachment required" });
    const thread = await storage.getThreadById(req.params.threadId);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const isMember = await storage.isTableMember(thread.tableId, req.session.userId!);
    if (!isMember) return res.status(403).json({ error: "You must be a table member to post in this thread" });
    if (content?.trim()) {
      const mod = await moderateContent(content);
      if (mod.flagged) {
        await storage.createModerationItem({ contentType: "POST_ATTEMPT", contentId: req.params.threadId, reason: mod.reason || "Flagged by moderation", reportedByUserId: req.session.userId });
        return res.status(400).json({ error: "This may not meet TRYBE's professional conduct standards. Please rephrase and try again." });
      }
    }
    const post = await storage.createPost({
      threadId: req.params.threadId,
      userId: req.session.userId,
      content: content?.trim() || "",
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileMimeType: fileMimeType || null,
      moderationStatus: "CLEAN",
    });
    const poster = await storage.getUserById(req.session.userId!);
    const tableMembers = await storage.getTableMembers(thread.tableId);
    const recipientIds = tableMembers
      .filter((m: any) => m.user?.id !== req.session.userId)
      .map((m: any) => m.user?.id)
      .filter(Boolean);
    if (recipientIds.length > 0) {
      const table = await storage.getTableById(thread.tableId);
      sendPushToMultipleUsers(recipientIds, {
        title: `${poster?.name || "Someone"} posted in ${thread.title}`,
        body: content?.trim()?.slice(0, 100) || "Shared an attachment",
        tag: `thread-${thread.id}`,
        url: `/app/tables/${thread.tableId}/threads/${thread.id}`,
      }).catch(() => {});
    }
    res.json(post);
  });
  app.post("/api/posts/:id/flag", requireActive, async (req, res) => {
    const post = await storage.getPostById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    await storage.createModerationItem({ contentType: "POST", contentId: post.id, reason: "User flagged", reportedByUserId: req.session.userId });
    res.json({ success: true });
  });
  app.patch("/api/posts/:id", requireActive, async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });
    const post = await storage.getPostById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.userId !== req.session.userId) return res.status(403).json({ error: "You can only edit your own posts" });
    const mod = await moderateContent(content);
    if (mod.flagged) return res.status(400).json({ error: "This may not meet TRYBE's professional conduct standards. Please rephrase." });
    const updated = await storage.updatePostContent(post.id, content.trim());
    res.json(updated);
  });
  app.delete("/api/posts/:id", requireActive, async (req, res) => {
    const post = await storage.getPostById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    const user = await storage.getUserById(req.session.userId!);
    if (post.userId !== req.session.userId && user?.role !== "ADMIN") return res.status(403).json({ error: "You can only delete your own posts" });
    await storage.deletePost(post.id);
    res.json({ success: true });
  });
  app.post("/api/admin/posts/:id/moderation", requireAdmin, async (req, res) => {
    const { status } = req.body;
    const post = await storage.updatePostModeration(req.params.id, status);
    res.json(post);
  });

  // ─── DMs ─────────────────────────────────────────────────────────────────

  app.get("/api/messages", requireActive, async (req, res) => {
    const convs = await storage.getDmConversationsForUser(req.session.userId!);
    const enriched = await Promise.all(convs.map(async (conv) => {
      const otherId = conv.userAId === req.session.userId ? conv.userBId : conv.userAId;
      const other = otherId ? await storage.getUserById(otherId) : null;
      return { ...conv, otherUser: other ? { id: other.id, name: other.name, organisation: other.organisation } : null };
    }));
    res.json(enriched);
  });

  app.get("/api/messages/eligible-contacts", requireActive, async (req, res) => {
    const sharedMembers = await storage.getSharedTableMembersWithContext(req.session.userId!);
    const existingConvs = await storage.getDmConversationsForUser(req.session.userId!);
    const existingPartnerIds = new Set(existingConvs.map(c =>
      c.userAId === req.session.userId ? c.userBId : c.userAId
    ));
    const sharedMap = new Map(sharedMembers.map(u => [u.id, u.sharedTables]));
    const allIds = new Set([...sharedMembers.map(u => u.id), ...existingPartnerIds]);
    allIds.delete(req.session.userId!);
    if (allIds.size === 0) return res.json([]);
    const allContacts = await Promise.all([...allIds].map(id => storage.getUserById(id)));
    res.json(allContacts.filter(Boolean).map(u => ({
      id: u!.id,
      name: u!.name,
      organisation: u!.organisation,
      roleTitle: u!.roleTitle,
      sharedTables: sharedMap.get(u!.id) || [],
      isExistingContact: existingPartnerIds.has(u!.id),
    })));
  });

  app.post("/api/messages", requireActive, async (req, res) => {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: "Target user required" });
    if (targetUserId === req.session.userId) return res.status(400).json({ error: "Cannot message yourself" });
    const existingConvs = await storage.getDmConversationsForUser(req.session.userId!);
    const alreadyConnected = existingConvs.some(c => c.userAId === targetUserId || c.userBId === targetUserId);
    if (!alreadyConnected) {
      const sharesTable = await storage.doUsersShareTable(req.session.userId!, targetUserId);
      if (!sharesTable) return res.status(403).json({ error: "You can only message people you share a table with." });
    }
    const conv = await storage.createDmConversation(req.session.userId!, targetUserId);
    res.json(conv);
  });

  app.get("/api/messages/:id", requireActive, async (req, res) => {
    const conv = await storage.getDmConversationById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Not found" });
    if (conv.userAId !== req.session.userId && conv.userBId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    const messages = await storage.getDmMessages(req.params.id);
    const otherId = conv.userAId === req.session.userId ? conv.userBId : conv.userAId;
    const other = otherId ? await storage.getUserById(otherId) : null;
    res.json({ ...conv, messages, otherUser: other ? { id: other.id, name: other.name, organisation: other.organisation } : null });
  });
  app.post("/api/messages/:id/send", requireActive, async (req, res) => {
    const { content, messageType, fileUrl, fileName, fileMimeType, isOneTime, replyToId } = req.body;
    const type = messageType || "TEXT";
    if (type === "TEXT" || type === "EMOJI") {
      if (!content?.trim()) return res.status(400).json({ error: "Content required" });
      if (type === "TEXT") {
        const mod = await moderateContent(content);
        if (mod.flagged) return res.status(400).json({ error: "This may not meet TRYBE's professional conduct standards. Please rephrase." });
      }
    }
    const msg = await storage.createDmMessage({
      conversationId: req.params.id,
      senderId: req.session.userId,
      content: content || "",
      messageType: type,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileMimeType: fileMimeType || null,
      isOneTime: !!isOneTime,
      viewedOnce: false,
      replyToId: replyToId || null,
      moderationStatus: "CLEAN",
    });
    const conv = await storage.getDmConversationById(req.params.id);
    if (conv) {
      const recipientId = conv.userAId === req.session.userId ? conv.userBId : conv.userAId;
      const sender = await storage.getUserById(req.session.userId!);
      sendPushToUser(recipientId, {
        title: `${sender?.name || "Someone"} sent you a message`,
        body: type === "TEXT" ? (content?.trim()?.slice(0, 100) || "") : "Sent an attachment",
        tag: `dm-${req.params.id}`,
        url: `/app/messages/${req.params.id}`,
      }).catch(() => {});
    }
    res.json(msg);
  });

  // File upload for DMs (images, video, audio, voice)
  app.post("/api/upload", requireActive, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, fileName: req.file.originalname, mimeType: req.file.mimetype });
  });

  // Toggle emoji reaction on a DM message
  app.post("/api/messages/:convId/reactions", requireActive, async (req, res) => {
    const { messageId, emoji } = req.body;
    if (!messageId || !emoji) return res.status(400).json({ error: "messageId and emoji required" });
    const result = await storage.toggleDmReaction(messageId, req.session.userId!, emoji);
    res.json(result);
  });

  // Mark a one-time message as viewed
  app.post("/api/messages/:convId/view-once/:msgId", requireActive, async (req, res) => {
    const msg = await storage.getDmMessageById(req.params.msgId);
    if (!msg) return res.status(404).json({ error: "Not found" });
    const updated = await storage.markMessageViewedOnce(req.params.msgId);
    res.json(updated);
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
    const { title, organiser, sourceNote } = req.body;
    const textToCheck = [title, organiser, sourceNote].filter(Boolean).join(" ");
    if (textToCheck.trim()) {
      const mod = await moderateContent(textToCheck);
      if (mod.flagged) return res.status(400).json({ error: "Event content may not meet TRYBE's professional conduct standards. Please rephrase." });
    }
    const event = await storage.createCalendarEvent(req.body);
    res.json(event);
  });
  app.delete("/api/admin/calendar/:id", requireAdmin, async (req, res) => {
    await storage.deleteCalendarEvent(req.params.id);
    res.json({ success: true });
  });

  // ─── Community Events (User-Created Milestones) ───────────────────────────

  app.get("/api/milestones", requireActive, async (req, res) => {
    const userId = req.session.userId!;
    const allEvents = await storage.getAllCommunityEvents();

    const tableCoMemberIds = new Set((await storage.getSharedTableMembersForUser(userId)).map(u => u.userId));
    const contactIds = new Set((await storage.getUserConversationPartnerIds(userId)));

    const events = allEvents.filter(e => {
      if (e.visibility !== "PRIVATE") return true;
      if (e.createdByUserId === userId) return true;
      if (e.createdByUserId && tableCoMemberIds.has(e.createdByUserId)) return true;
      if (e.createdByUserId && contactIds.has(e.createdByUserId)) return true;
      return false;
    });

    const signals = await storage.getUserCommunitySignals(userId);
    const allSignals = await Promise.all(events.map(async (e) => {
      const counts = await storage.getCommunityEventSignalCounts(e.id);
      return { eventId: e.id, ...counts };
    }));
    const creators = await Promise.all(events.map(async (e) => {
      if (!e.createdByUserId) return null;
      const u = await storage.getUserById(e.createdByUserId);
      return u ? { id: u.id, name: u.name, organisation: u.organisation } : null;
    }));
    const enriched = events.map((e, i) => ({
      ...e,
      creator: creators[i],
      counts: allSignals.find(s => s.eventId === e.id) || { interested: 0, attending: 0 },
    }));
    res.json({ events: enriched, signals });
  });

  app.post("/api/milestones", requireActive, async (req, res) => {
    const { title, description, eventDate, endDate, location, virtualLink, tags, visibility } = req.body;
    if (!title?.trim() || !eventDate) return res.status(400).json({ error: "Title and date are required" });
    const textToCheck = [title, description, location].filter(Boolean).join(" ");
    if (textToCheck.trim()) {
      const mod = await moderateContent(textToCheck);
      if (mod.flagged) return res.status(400).json({ error: "Content may not meet TRYBE's professional conduct standards. Please rephrase." });
    }
    const event = await storage.createCommunityEvent({
      title: title.trim(),
      description: description?.trim() || null,
      eventDate,
      endDate: endDate || null,
      location: location?.trim() || null,
      virtualLink: virtualLink?.trim() || null,
      tags: tags || [],
      visibility: visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      createdByUserId: req.session.userId!,
    });
    await createAuditEntry({ actorUserId: req.session.userId, action: "MILESTONE_CREATED", targetType: "COMMUNITY_EVENT", targetId: event.id });
    res.json(event);
  });

  app.post("/api/milestones/:id/signal", requireActive, async (req, res) => {
    const { signalType } = req.body;
    if (!signalType || !["INTERESTED", "ATTENDING"].includes(signalType)) return res.status(400).json({ error: "Invalid signal type" });
    const signal = await storage.upsertCommunitySignal(req.session.userId!, req.params.id, signalType);
    let emailSent = false;
    if (signal && signalType === "ATTENDING") {
      const [usr, evt] = await Promise.all([
        storage.getUserById(req.session.userId!),
        storage.getCommunityEventById(req.params.id),
      ]);
      if (usr?.email && evt) {
        sendMilestoneAttendingEmail(usr.email, usr.name, evt).then(sent => {
          if (sent) console.log(`[Email] Attending confirmation sent to ${usr.email} for "${evt.title}"`);
        }).catch(() => {});
        emailSent = true;
      }
      if (evt && evt.createdByUserId && evt.createdByUserId !== req.session.userId) {
        sendPushToUser(evt.createdByUserId, {
          title: `${usr?.name || "Someone"} is attending your event`,
          body: evt.title,
          tag: `milestone-${evt.id}`,
          url: "/app/moments",
        }).catch(() => {});
      }
    }
    res.json(signal ? { ...signal, emailSent } : { removed: true });
  });

  app.delete("/api/milestones/:id", requireActive, async (req, res) => {
    const event = await storage.getCommunityEventById(req.params.id);
    if (!event) return res.status(404).json({ error: "Not found" });
    const user = await storage.getUserById(req.session.userId!);
    if (event.createdByUserId !== req.session.userId && user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only the creator or admin can delete this event" });
    }
    await storage.deleteCommunityEvent(req.params.id);
    await createAuditEntry({ actorUserId: req.session.userId, action: "MILESTONE_DELETED", targetType: "COMMUNITY_EVENT", targetId: req.params.id });
    res.json({ success: true });
  });

  // ─── Feedback ─────────────────────────────────────────────────────────────

  app.post("/api/feedback", requireActive, async (req, res) => {
    const { contextType, contextId, category, rating, message } = req.body;
    if (!message || !category) return res.status(400).json({ error: "Required fields missing" });
    const mod = await moderateContent(message);
    if (mod.flagged) return res.status(400).json({ error: "Feedback content may not meet TRYBE's professional conduct standards. Please rephrase." });
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
    const enriched = await Promise.all(items.map(async (item) => {
      let postContent: string | null = null;
      let authorId: string | null = null;
      let authorName: string | null = null;
      let authorEmail: string | null = null;
      let threadTitle: string | null = null;
      let tableTitle: string | null = null;
      let reporterName: string | null = null;
      if (item.contentType === "POST" && item.contentId) {
        const post = await storage.getPostById(item.contentId);
        if (post) {
          postContent = post.content;
          authorId = post.userId;
          const author = post.userId ? await storage.getUserById(post.userId) : null;
          if (author) { authorName = author.name; authorEmail = author.email; }
          const thread = await storage.getThreadById(post.threadId);
          if (thread) {
            threadTitle = thread.title;
            const tables = await storage.getAllTables();
            const table = tables.find(t => t.id === thread.tableId);
            if (table) tableTitle = table.title;
          }
        }
      }
      if (item.reportedByUserId) {
        const reporter = await storage.getUserById(item.reportedByUserId);
        if (reporter) reporterName = reporter.name;
      }
      return { ...item, postContent, authorId, authorName, authorEmail, threadTitle, tableTitle, reporterName };
    }));
    res.json(enriched);
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

  // ─── AI Content Generation ────────────────────────────────────────────────

  app.post("/api/ai/generate-post", requireActive, async (req, res) => {
    const { threadId, prompt } = req.body;
    if (!threadId) return res.status(400).json({ error: "threadId required" });
    const thread = await storage.getThreadById(threadId);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const isMember = await storage.isTableMember(thread.tableId, req.session.userId!);
    if (!isMember) return res.status(403).json({ error: "Must be a table member" });
    const posts = await storage.getPostsByThread(threadId);
    const recentPosts = posts.slice(-5).map(({ post, user: u }: any) => `${u?.name || "Member"}: ${post.content}`).join("\n");
    const user = await storage.getUserById(req.session.userId!);
    if (!openai) return res.status(503).json({ error: "AI generation unavailable" });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional health sector communicator writing a contribution to a TRYBE collaboration table thread. 
TRYBE is a private global health platform for senior professionals — researchers, clinicians, policymakers, and advocates.
Write in a calm, evidence-informed, collaborative tone. Be substantive but concise (150–250 words). 
Do not use bullet points or headers — write in flowing paragraphs. Do not start with "I" or greetings.
The author is ${user?.name || "a member"} (${user?.roleTitle || user?.organisation || "health professional"}).`,
        },
        {
          role: "user",
          content: `Thread title: "${thread.title}"\n\n${recentPosts ? `Recent discussion:\n${recentPosts}\n\n` : ""}${prompt ? `Additional direction: ${prompt}\n\n` : ""}Write a professional contribution to this thread that adds value to the discussion.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });
    const content = completion.choices[0]?.message?.content?.trim() || "";
    res.json({ content });
  });

  app.post("/api/ai/generate-event", requireAdmin, async (req, res) => {
    const { description } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: "Description required" });
    if (!openai) return res.status(503).json({ error: "AI generation unavailable" });
    const today = new Date().toISOString().split("T")[0];
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an assistant that creates structured global health calendar events for TRYBE, a private health collaboration platform.
Return ONLY a valid JSON object with these fields:
- title: string (concise event name, max 80 chars)
- organiser: string (organisation or body running the event)
- startDate: string (YYYY-MM-DD format, must be ${today} or later)
- endDate: string (YYYY-MM-DD format, optional, same or after startDate)
- regionScope: string (e.g. "Global", "Africa", "Europe", "Asia", "North America")
- tags: array of strings (2–5 relevant health tags from: rare-disease, cancer, diabetes, mental-health, HIV/AIDS, TB, AMR, policy, research, advocacy, nutrition, maternal-health, NTDs, UHC)
- sourceNote: string (brief description of the event, 1–2 sentences)
Return ONLY the JSON, no markdown, no explanation.`,
        },
        { role: "user", content: description },
      ],
      temperature: 0.4,
      max_tokens: 350,
      response_format: { type: "json_object" },
    });
    try {
      const raw = completion.choices[0]?.message?.content || "{}";
      const event = JSON.parse(raw);
      res.json(event);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
    }
  });

  app.post("/api/ai/generate-table", requireActive, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: "Prompt required" });
    if (!openai) return res.status(503).json({ error: "AI generation unavailable" });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an assistant that creates structured collaboration table proposals for TRYBE, a private global health platform.
Return ONLY a valid JSON object with these fields:
- title: string (clear, professional table name, max 80 chars)
- purpose: string (1–3 sentence purpose statement, max 240 chars, explains focus and goals)
- tags: array of strings (2–5 relevant tags from: rare-disease, cancer, diabetes, mental-health, HIV/AIDS, TB, AMR, policy, research, advocacy, nutrition, maternal-health, NTDs, UHC, Global, Europe, Africa, Asia)
- reason: string (1–2 sentences explaining why this table is needed now)
Return ONLY the JSON, no markdown, no explanation.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });
    try {
      const raw = completion.choices[0]?.message?.content || "{}";
      const proposal = JSON.parse(raw);
      if (proposal.purpose && proposal.purpose.length > 240) {
        proposal.purpose = proposal.purpose.slice(0, 237) + "...";
      }
      res.json(proposal);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
    }
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

    if (!openai) {
      return res.json({
        assistantText: "I'm here to support your work. Explore the Tables section to find tables relevant to your focus.",
        suggestedActions: [
          { type: "NAVIGATE", label: "Browse Tables", url: "/app/tables" },
          { type: "NAVIGATE", label: "View Moments", url: "/app/moments" },
        ],
      });
    }

    // ── 1. Classify intent (for tool selection) ────────────────────────────
    const intent = classifyIntent(message, context);
    console.log(`[Assistant] Intent: ${intent} | Message: "${message.slice(0, 60)}"`);

    // ── 2. Build full user profile ───────────────────────────────────────────
    const userProfile = buildUserProfile(user, profile);

    // ── 3. Fetch platform data ───────────────────────────────────────────────
    const allTables = await storage.getAllTables();
    const userTables = await storage.getTablesForUser(req.session.userId!);
    const userTableIds = new Set(userTables.map(t => t.id));
    const myTablesSummary = buildMyTablesSummary(userTables);
    const availableTablesSummary = buildAvailableTablesSummary(allTables, userTableIds);

    let calendarContext = "";
    try {
      const allEvents = await storage.getAllCalendarEvents();
      const eventsSummary = buildUpcomingEventsSummary(allEvents);
      calendarContext = `\nUpcoming health milestones (next 90 days):\n${eventsSummary}`;
    } catch {}

    // ── 4. Always load page-specific context (thread/table) ──────────────────
    let threadContext = "";
    let tableContext = "";

    if (context?.threadId) {
      try {
        threadContext = await getOrBuildThreadSummary(context.threadId, storage, openai);
        if (threadContext) threadContext = `\n━━━ ACTIVE THREAD ━━━\n${threadContext}`;
      } catch {}
    }

    if (context?.tableId) {
      try {
        const table = await storage.getTableById(context.tableId);
        if (table) {
          const threads = await storage.getThreadsByTable(context.tableId);
          const threadList = threads.length > 0
            ? threads.map((t: any) => `"${t.title}"`).join(", ")
            : "None yet";
          tableContext = `\n━━━ CURRENT TABLE ━━━\n"${table.title}" | Purpose: ${table.purpose}\nThreads: ${threadList}`;
        }
      } catch {}
    }

    // ── 5. Compress conversation history ─────────────────────────────────────
    const rawHistory = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));
    const { recentMessages, summaryPrefix } = compressConversationHistory(rawHistory);

    // ── 6. Select tools for this intent ──────────────────────────────────────
    const intentTools = getToolsForIntent(intent);

    // ── 7. Build system prompt with complete data ────────────────────────────
    const systemPrompt = `You are TRYBE Assistant — a calm, professional, neutral AI assistant embedded in TRYBE, a private invite-only global health collaboration platform.

TRYBE's philosophy: Human-led. AI-supported. You are the user's intelligent companion within the platform. You can both advise and take actions on behalf of the user.

━━━ YOUR IDENTITY & TONE ━━━
- LANGUAGE RULE: Always detect the language the user writes in and reply in that same language. If the user writes in Turkish, reply in Turkish. If in French, reply in French. If in Spanish, reply in Spanish. Match the user's language exactly — do not default to English unless the user writes in English.
- Warm but restrained. No hype or jargon.
- Professional, like a well-informed colleague — not a chatbot.
- Concise. 2–4 sentences for conversational replies. Longer when summarising, drafting, or reflecting.
- Never use emoji. Never be sycophantic.
- Avoid exclamation marks, motivational tone, inspirational language, rhetorical flourish, and corporate jargon.
- Use clear sentences, measured phrasing, and a neutral analytical tone.

━━━ ABSOLUTE LIMITS ━━━
- Never provide medical advice, clinical guidance, or diagnoses.
- Never take political or policy positions on behalf of TRYBE.
- Never advocate or take policy positions. Never use persuasive or emotional manipulation language.
- Never fabricate table IDs, thread IDs, event IDs, or user IDs. Use only IDs from the data provided or from tool results.
- If you do not know something, say so plainly.

━━━ MUST REFUSE ━━━
Refuse these requests with: "I'm here to support structured collaboration within global health topics."
- "Write a political position"
- "Draft a press release advocating for..."
- "Recommend policy stance"
- "Help me attack this organisation"
- Any non-global health topics

━━━ WHAT YOU CAN DO ━━━
You have tools that let you take real actions in the platform. Use them when the user asks you to do something.

TABLES (collaboration working areas):
- Join or leave tables on behalf of the user
- Search for tables by topic/keyword
- List all available tables on the platform
- Get detailed information about any table (members, threads, purpose)
- List the user's current tables
- Suggest tables based on the user's profile (interests, regions, role, goals) — use suggest_tables_for_me
- Request creation of a new table (submitted for admin review)
- Create discussion threads inside tables
- Post messages in discussion threads

DIRECT MESSAGES:
- Send direct messages to other members (must share a table)
- List the user's active conversations
- Search for members by name, interest, region, or role

MILESTONES & CALENDAR:
- Search for upcoming health milestones/events
- List upcoming milestones in the next 90 days
- Signal interest in events (attending, presenting, watching)

INVITATIONS:
- Send invitations to colleagues by email (uses the user's monthly quota)

PROFILE & SETTINGS:
- View the user's current profile, interests, and settings
- Update the user's interests, regions, collaboration mode, assistant activity level, or goals

FEEDBACK:
- Submit platform feedback on behalf of the user

ANALYSIS & DRAFTING:
- Summarise discussion threads (Key Themes, Areas of Agreement, Open Questions)
- Provide strategic reflections on discussions
- Help prepare for upcoming health milestones
- Draft professional posts and messages for review
- Surface relevant calendar moments

━━━ HOW TO USE TOOLS ━━━
- When the user asks you to DO something (join, post, send, invite, etc.), call the appropriate tool. Write actions will be presented to the user for confirmation before executing.
- When you need information to answer a question, use search/list/get tools first, then respond. Read-only tools execute immediately without confirmation.
- You can chain multiple tools if needed (e.g., search for a table, then join it).
- For drafts: if the user asks you to draft AND post, first draft it and show it, then post using the tool. If they just ask to draft, put it in "draftContent" for review.
- When the user asks for table suggestions, recommendations, or "what should I join?", always use the suggest_tables_for_me tool. It scores tables against the user's profile automatically.
- All content you post, send, or submit goes through platform moderation. If moderation flags the content, explain that clearly and ask the user to rephrase.

━━━ USER PROFILE ━━━
${userProfile}

━━━ PLATFORM DATA ━━━
Tables I belong to:
${myTablesSummary}

Available tables to suggest (not yet a member):
${availableTablesSummary}
${calendarContext}${threadContext}${tableContext}

━━━ CURRENT CONTEXT ━━━
Page: ${context?.page || "/app"}${context?.threadId ? ` | Thread ID: ${context.threadId}` : ""}${context?.tableId ? ` | Table ID: ${context.tableId}` : ""}

━━━ RESPONSE FORMAT ━━━
Always respond with valid JSON:
{
  "assistantText": "Your main response (2–4 sentences for conversational, longer for analysis)",
  "summaryContent": "Structured thread summary — only include if user asked to summarise",
  "reflectionContent": "Structured strategic reflection — only include if user asked for reflection/analysis",
  "milestoneContent": "Structured milestone preparation — only include if user asked to prepare for an event",
  "draftContent": "Full draft post or message — only include if user asked to draft something",
  "actionsPerformed": [{"tool": "tool_name", "result": "brief description of what was done"}],
  "suggestedActions": [
    {"type": "SUGGEST_JOIN_TABLE", "tableId": "exact-id-from-list", "label": "View: Table Name"},
    {"type": "NAVIGATE", "label": "Go to Moments", "url": "/app/moments"},
    {"type": "NAVIGATE", "label": "Go to Settings", "url": "/app/settings"}
  ]
}
Rules:
- suggestedActions: 0–3 items, only genuinely relevant ones. Never fabricate IDs.
- summaryContent: only when summarising — structured with Key Themes, Areas of Agreement, Open Questions. Max 400 words.
- reflectionContent: only when reflecting — structured with Key Themes, Areas of Agreement, Open Questions, Suggested Next Step. Max 4 bullets per section.
- milestoneContent: only when preparing for milestone — structured with Context, Potential Focus Areas, Stakeholder Types, Optional Suggestion.
- draftContent: only when drafting — ready to use but clearly a draft. Max 400 words.
- actionsPerformed: list of tools you called and their outcomes. Omit if no tools were called.
- Omit any field that is not needed (no empty strings).`;

    // ── 8. Build message array with compressed history ────────────────────────
    const conversationMessages: any[] = [];
    if (summaryPrefix) {
      conversationMessages.push({ role: "system", content: summaryPrefix });
    }
    for (const msg of recentMessages) {
      conversationMessages.push(msg);
    }
    conversationMessages.push({ role: "user", content: message });

    try {
      const messages: any[] = [
        { role: "system", content: systemPrompt },
        ...conversationMessages,
      ];

      let completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: intentTools as any,
        tool_choice: "auto",
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      let assistantMessage = completion.choices[0]?.message;
      const toolResults: { tool: string; result: string; success: boolean }[] = [];
      const pendingActions: { tool: string; args: any; label: string; description: string }[] = [];

      let iterations = 0;
      const maxIterations = 5;

      while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
        iterations++;
        messages.push(assistantMessage);

        let hasWriteTools = false;
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: any = {};
          try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}

          if (READ_ONLY_TOOLS.has(toolName)) {
            console.log(`[Assistant/Tool:read] ${toolName}`, JSON.stringify(toolArgs));
            const toolResult = await executeTool(toolName, toolArgs, req.session.userId!, storage, {
              moderateContent,
              sendMemberInviteEmail,
            });
            toolResults.push({ tool: toolName, result: toolResult.message, success: toolResult.success });
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult),
            });
          } else {
            hasWriteTools = true;
            const label = TOOL_LABELS[toolName] || toolName;
            let description = "";
            if (toolName === "join_table") description = `Join the table`;
            else if (toolName === "leave_table") description = `Leave the table`;
            else if (toolName === "create_thread") description = `Create discussion: "${toolArgs.title || ""}"`;
            else if (toolName === "post_in_thread") description = `Post: "${(toolArgs.content || "").slice(0, 80)}${(toolArgs.content || "").length > 80 ? "..." : ""}"`;
            else if (toolName === "send_direct_message") description = `Send message: "${(toolArgs.content || "").slice(0, 80)}${(toolArgs.content || "").length > 80 ? "..." : ""}"`;
            else if (toolName === "signal_milestone") description = `Signal "${toolArgs.signalType || ""}" for an event`;
            else if (toolName === "create_table") description = `Create new table: "${toolArgs.title || ""}"`;
            else if (toolName === "send_invite") description = `Send invitation to ${toolArgs.email || ""}`;
            else if (toolName === "update_profile") description = `Update profile settings`;
            else if (toolName === "submit_feedback") description = `Submit feedback (${toolArgs.category || "GENERAL"})`;
            else description = label;

            pendingActions.push({ tool: toolName, args: toolArgs, label, description });
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: true, message: "Action queued — awaiting user confirmation before executing.", pending: true }),
            });
          }
        }

        if (hasWriteTools && pendingActions.length > 0) {
          completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            response_format: { type: "json_object" },
            max_tokens: 1500,
          });
          assistantMessage = completion.choices[0]?.message;
          break;
        }

        completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          tools: intentTools as any,
          tool_choice: "auto",
          response_format: { type: "json_object" },
          max_tokens: 1500,
        });
        assistantMessage = completion.choices[0]?.message;
      }

      let result: any = { assistantText: "", suggestedActions: [] };
      const rawContent = assistantMessage?.content || "{}";
      try { result = JSON.parse(rawContent); } catch {
        result = { assistantText: rawContent };
      }

      if (toolResults.length > 0) {
        result.actionsPerformed = toolResults.map(r => ({
          tool: r.tool,
          result: r.result,
          success: r.success,
        }));
      }

      if (pendingActions.length > 0) {
        result.pendingActions = pendingActions;
        req.session.pendingActions = pendingActions;
      } else {
        req.session.pendingActions = undefined;
      }

      const moderatableContent = [result.draftContent, result.summaryContent, result.reflectionContent, result.milestoneContent].filter(Boolean).join("\n\n");
      if (moderatableContent && openai) {
        try {
          const modCheck = await openai.moderations.create({ input: moderatableContent });
          if (modCheck.results[0]?.flagged) {
            result.draftContent = undefined;
            result.summaryContent = undefined;
            result.reflectionContent = undefined;
            result.milestoneContent = undefined;
            result.assistantText = "I'm unable to assist with that request.";
          }
        } catch {}
      }

      res.json(result);
    } catch (err: any) {
      console.error("[Assistant]", err?.message);
      res.json({ assistantText: "I'm having trouble right now. Please try again in a moment.", suggestedActions: [] });
    }
  });

  // ─── OMNI: Execute Confirmed Actions ─────────────────────────────────────

  app.post("/api/assistant/execute", requireActive, async (req, res) => {
    const sessionPending = req.session.pendingActions;
    if (!sessionPending || sessionPending.length === 0) {
      return res.status(400).json({ error: "No pending actions to execute." });
    }

    const results: { tool: string; result: string; success: boolean }[] = [];
    for (const action of sessionPending) {
      if (READ_ONLY_TOOLS.has(action.tool)) continue;
      console.log(`[Assistant/Execute] ${action.tool}`, JSON.stringify(action.args || {}));
      const toolResult = await executeTool(action.tool, action.args || {}, req.session.userId!, storage, {
        moderateContent,
        sendMemberInviteEmail,
      });
      results.push({ tool: action.tool, result: toolResult.message, success: toolResult.success });
    }

    req.session.pendingActions = undefined;
    res.json({ actionsPerformed: results });
  });

  app.post("/api/assistant/decline", requireActive, async (req, res) => {
    req.session.pendingActions = undefined;
    res.json({ ok: true });
  });

  // ─── OMNI: Activity Pattern Nudges ───────────────────────────────────────

  const nudgeThrottle = new Map<string, { lastNudgeAt: number; weeklyCount: number; weekStart: number }>();

  app.get("/api/assistant/nudges", requireActive, async (req, res) => {
    const userId = req.session.userId!;
    const profile = await storage.getUserProfile(userId);

    if (profile?.assistantActivityLevel === "QUIET") {
      return res.json({ nudges: [], focusReviewDue: false });
    }

    const now = Date.now();
    const throttle = nudgeThrottle.get(userId) || { lastNudgeAt: 0, weeklyCount: 0, weekStart: now };
    const weekMs = 7 * 86400000;
    if (now - throttle.weekStart > weekMs) {
      throttle.weeklyCount = 0;
      throttle.weekStart = now;
    }

    if (throttle.weeklyCount >= 3) {
      const focusReviewDue = !profile?.lastFocusReviewAt || (now - new Date(profile.lastFocusReviewAt).getTime() > 30 * 86400000);
      return res.json({ nudges: [], focusReviewDue });
    }

    const nudges: { type: string; message: string; tableId?: string; eventTitle?: string }[] = [];

    try {
      const userTables = await storage.getTablesForUser(userId);
      if (userTables.length > 0) {
        const tableIds = userTables.map(t => t.id);
        const activityData = await storage.getTableLastActivity(tableIds);

        for (const table of userTables) {
          const activity = activityData.find(a => a.tableId === table.id);
          const lastPost = activity?.lastPostAt ? new Date(activity.lastPostAt).getTime() : 0;
          if (!lastPost || now - lastPost > 10 * 86400000) {
            nudges.push({
              type: "INACTIVE_TABLE",
              message: `The "${table.title}" table has been quiet recently. Would you like to re-engage?`,
              tableId: table.id,
            });
          }
        }
      }
    } catch {}

    try {
      const allEvents = await storage.getAllCalendarEvents();
      const today = new Date();
      const cutoff = new Date(now + 30 * 86400000);
      const upcoming = allEvents.filter(e => {
        const d = new Date(e.startDate);
        return d >= today && d <= cutoff;
      });

      for (const event of upcoming.slice(0, 2)) {
        const daysAway = Math.ceil((new Date(event.startDate).getTime() - now) / 86400000);
        const weeksText = daysAway > 7 ? `${Math.ceil(daysAway / 7)} weeks` : `${daysAway} days`;
        nudges.push({
          type: "UPCOMING_MILESTONE",
          message: `${event.title} is in ${weeksText}. Would preparation be useful?`,
          eventTitle: event.title,
        });
      }
    } catch {}

    const limitedNudges = nudges.slice(0, 1);
    if (limitedNudges.length > 0) {
      throttle.lastNudgeAt = now;
      throttle.weeklyCount++;
      nudgeThrottle.set(userId, throttle);
    }

    const focusReviewDue = profile?.onboardingComplete && (!profile?.lastFocusReviewAt || (now - new Date(profile.lastFocusReviewAt).getTime() > 30 * 86400000));

    res.json({ nudges: limitedNudges, focusReviewDue: !!focusReviewDue });
  });

  app.post("/api/assistant/dismiss-focus-review", requireActive, async (req, res) => {
    await storage.upsertUserProfile(req.session.userId!, { lastFocusReviewAt: new Date() });
    res.json({ ok: true });
  });

  // ─── Admin: Unified Action Endpoints ────────────────────────────────────

  app.get("/api/admin/invites", requireAdmin, async (req, res) => {
    const invites = await storage.getAllInvites();
    res.json(invites);
  });
  app.post("/api/admin/invites", requireAdmin, async (req, res) => {
    const { email, recipientName, expiresInDays } = req.body;
    const expiresAt = new Date(Date.now() + (expiresInDays || 30) * 86400000);
    const invite = await storage.createInvite({
      email,
      createdByUserId: req.session.userId,
      expiresAt,
      inviteType: "ADMIN_CODE",
      autoApproveOnUse: true,
      requiresManualApproval: false,
    });
    await createAuditEntry({ actorUserId: req.session.userId, action: "INVITE_CREATED", targetType: "INVITE", targetId: invite.id, metadata: { email, inviteType: "ADMIN_CODE" } });
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
      if (user?.email) sendAccountSuspendedEmail(user.email, user.name).catch(() => {});
    } else if (action === "REACTIVATE") {
      user = await storage.updateUserStatus(userId, "ACTIVE");
      await createAuditEntry({ actorUserId: req.session.userId, action: "USER_REACTIVATED", targetType: "USER", targetId: userId });
      if (user?.email) sendAccountReactivatedEmail(user.email, user.name).catch(() => {});
      const userAppeals = await storage.getReactivationAppealsByUser(userId);
      const pendingAppeal = userAppeals.find(a => a.status === "PENDING");
      if (pendingAppeal) {
        await storage.updateAppealStatus(pendingAppeal.id, "APPROVED", req.session.userId!);
      }
    } else {
      return res.status(400).json({ error: "Unknown action" });
    }
    res.json({ ...user, passwordHash: undefined });
  });

  app.get("/api/admin/reactivation-appeals", requireAdmin, async (req, res) => {
    const appeals = await storage.getAllAppeals();
    const appealUsers = await Promise.all(appeals.map(async (a) => {
      const user = await storage.getUserById(a.userId);
      return { ...a, user: user ? { id: user.id, name: user.name, email: user.email, status: user.status, organisation: user.organisation } : null };
    }));
    res.json(appealUsers);
  });

  app.post("/api/admin/reactivation-appeals/:id/action", requireAdmin, async (req, res) => {
    const { action } = req.body;
    const appealId = req.params.id;

    if (action === "APPROVE") {
      const appeal = await storage.updateAppealStatus(appealId, "APPROVED", req.session.userId!);
      if (appeal) {
        const user = await storage.updateUserStatus(appeal.userId, "ACTIVE");
        await createAuditEntry({ actorUserId: req.session.userId, action: "USER_REACTIVATED", targetType: "USER", targetId: appeal.userId, metadata: { via: "appeal" } });
        if (user?.email) sendAccountReactivatedEmail(user.email, user.name).catch(() => {});
        return res.json({ appeal, user: { ...user, passwordHash: undefined } });
      }
      return res.status(404).json({ error: "Appeal not found" });
    } else if (action === "REJECT") {
      const appeal = await storage.updateAppealStatus(appealId, "REJECTED", req.session.userId!);
      if (appeal) {
        await createAuditEntry({ actorUserId: req.session.userId, action: "REACTIVATION_APPEAL_REJECTED", targetType: "USER", targetId: appeal.userId });
        return res.json({ appeal });
      }
      return res.status(404).json({ error: "Appeal not found" });
    }
    return res.status(400).json({ error: "Unknown action" });
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


  app.post("/api/admin/users/:userId/invite-privileges", requireAdmin, async (req, res) => {
    const { canInvite, quota } = req.body;
    const updated = await storage.updateUserInvitePrivileges(req.params.userId, canInvite, quota);
    await createAuditEntry({
      actorUserId: req.session.userId,
      action: canInvite ? "INVITE_PRIVILEGES_RESTORED" : "INVITE_PRIVILEGES_REMOVED",
      targetType: "USER",
      targetId: req.params.userId,
      metadata: { canInvite, quota },
    });
    res.json({ ...updated, passwordHash: undefined });
  });

  app.post("/api/admin/moderation/:id/review", requireAdmin, async (req, res) => {
    const { action, adminNote, warningMessage, targetUserId } = req.body;
    const validActions = ["DISMISS", "WARN", "SUSPEND", "REMOVE_POST"];
    if (!action || !validActions.includes(action)) return res.status(400).json({ error: "Invalid action" });
    if (action === "WARN" && (!targetUserId || !warningMessage?.trim())) return res.status(400).json({ error: "Warning message and target user required" });
    if (action === "SUSPEND" && !targetUserId) return res.status(400).json({ error: "Target user required" });
    if (action === "WARN" && targetUserId && warningMessage) {
      const conv = await storage.createDmConversation(req.session.userId!, targetUserId);
      await storage.createDmMessage({ conversationId: conv.id, senderId: req.session.userId!, content: `⚠️ Conduct Warning\n\n${warningMessage}`, messageType: "TEXT" });
      await createAuditEntry({ actorUserId: req.session.userId, action: "CONDUCT_WARNING_SENT", targetType: "USER", targetId: targetUserId, metadata: { moderationItemId: req.params.id, warningMessage } });
    }
    if (action === "SUSPEND" && targetUserId) {
      await storage.updateUserStatus(targetUserId, "SUSPENDED");
      const user = await storage.getUserById(targetUserId);
      if (user?.email) sendAccountSuspendedEmail(user.email, user.name).catch(() => {});
      await createAuditEntry({ actorUserId: req.session.userId, action: "USER_SUSPENDED", targetType: "USER", targetId: targetUserId, metadata: { moderationItemId: req.params.id } });
    }
    if (action === "REMOVE_POST") {
      const items = await storage.getAllModerationItems();
      const item = items.find(i => i.id === req.params.id);
      if (item?.contentId && item.contentType === "POST") {
        await storage.updatePostModeration(item.contentId, "REMOVED");
      }
    }
    const resolved = await storage.resolveModerationItem(req.params.id);
    await createAuditEntry({ actorUserId: req.session.userId, action: "MODERATION_ACTION", targetType: "MODERATION", targetId: req.params.id, metadata: { action, adminNote } });
    res.json(resolved);
  });

  // ─── Admin Metrics ────────────────────────────────────────────────────────

  app.get("/api/admin/metrics", requireAdmin, async (req, res) => {
    const [users, tables, feedback, modItems, counts] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllTables(),
      storage.getAllFeedback(),
      storage.getAllModerationItems(),
      storage.getPlatformCounts(),
    ]);
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === "ACTIVE").length;
    const pendingApproval = users.filter(u => u.status === "PENDING_APPROVAL").length;
    const everActivated = users.filter(u => u.status === "ACTIVE" || u.status === "SUSPENDED").length;
    const activationRate = totalUsers > 0 ? Math.round((everActivated / totalUsers) * 100) : 0;
    const avgThreadsPerTable = tables.length > 0 ? Math.round((Number(counts.totalThreads) / tables.length) * 10) / 10 : 0;
    const avgPostsPerThread = Number(counts.totalThreads) > 0 ? Math.round((Number(counts.totalPosts) / Number(counts.totalThreads)) * 10) / 10 : 0;
    res.json({
      totalUsers,
      activeUsers,
      pendingApproval,
      activationRate,
      totalTables: tables.length,
      totalThreads: Number(counts.totalThreads),
      totalPosts: Number(counts.totalPosts),
      totalMemberships: Number(counts.totalMemberships),
      avgThreadsPerTable,
      avgPostsPerThread,
      totalFeedback: feedback.length,
      openModerationItems: modItems.filter(m => m.status === "OPEN").length,
    });
  });

  // ─── Scheduled: Cleanup + WHO Health Days Sync ──────────────────────────
  const { generateEventsForYear } = await import("./who-health-days");

  const runCleanup = async () => {
    try {
      const removedTables = await storage.cleanupInactiveTables(14);
      const removedEvents = await storage.cleanupPastEvents();
      if (removedTables.length > 0 || removedEvents > 0) {
        console.log(`[Cleanup] Removed ${removedTables.length} inactive table(s), ${removedEvents} past event(s)`);
      }

      const expiredSuspended = await storage.getSuspendedUsersForAutoDelete(14);
      for (const u of expiredSuspended) {
        if (u.role === "ADMIN") continue;
        await storage.deleteUserCompletely(u.id);
        await createAuditEntry({ actorUserId: null, action: "USER_AUTO_DELETED", targetType: "USER", targetId: u.id, metadata: { email: u.email, reason: "14-day suspension expiry" } });
        console.log(`[Cleanup] Auto-deleted suspended user ${u.email} (14-day expiry)`);
      }

      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const currentYearEvents = generateEventsForYear(currentYear);
      const nextYearEvents = generateEventsForYear(nextYear);
      const addedCurrent = await storage.syncWHOHealthDays(currentYearEvents);
      const addedNext = await storage.syncWHOHealthDays(nextYearEvents);
      if (addedCurrent > 0 || addedNext > 0) {
        console.log(`[WHO Sync] Added ${addedCurrent} event(s) for ${currentYear}, ${addedNext} event(s) for ${nextYear}`);
      }
    } catch (err) {
      console.error("[Cleanup/Sync] Error:", err);
    }
  };
  runCleanup();
  setInterval(runCleanup, 6 * 60 * 60 * 1000);

  return httpServer;
}

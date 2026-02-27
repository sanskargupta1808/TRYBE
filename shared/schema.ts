import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  handle: text("handle").unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at"),
  emailVerifyToken: text("email_verify_token"),
  status: text("status").notNull().default("PENDING_APPROVAL"),
  role: text("role").notNull().default("USER"),
  organisation: text("organisation"),
  roleTitle: text("role_title"),
  inviteQuotaMonthly: integer("invite_quota_monthly").notNull().default(5),
  inviteQuotaUsedThisMonth: integer("invite_quota_used_this_month").notNull().default(0),
  inviteQuotaResetAt: timestamp("invite_quota_reset_at"),
  canInvite: boolean("can_invite").notNull().default(true),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at"),
  suspendedAt: timestamp("suspended_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastLoginAt: true, emailVerifiedAt: true, inviteQuotaMonthly: true, inviteQuotaUsedThisMonth: true, inviteQuotaResetAt: true, canInvite: true, suspendedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Invites ──────────────────────────────────────────────────────────────────
export const invites = pgTable("invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  email: text("email"),
  status: text("status").notNull().default("UNUSED"),
  inviteType: text("invite_type").notNull().default("ADMIN_CODE"),
  autoApproveOnUse: boolean("auto_approve_on_use").notNull().default(false),
  requiresManualApproval: boolean("requires_manual_approval").notNull().default(true),
  maxUses: integer("max_uses").notNull().default(1),
  usesCount: integer("uses_count").notNull().default(0),
  recipientNote: text("recipient_note"),
  expiresAt: timestamp("expires_at"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  usedByUserId: varchar("used_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertInviteSchema = createInsertSchema(invites).omit({ id: true, createdAt: true });
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invites.$inferSelect;

// ─── Invitation Requests ──────────────────────────────────────────────────────
export const inviteRequests = pgTable("invite_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  organisation: text("organisation").notNull(),
  roleTitle: text("role_title").notNull(),
  email: text("email").notNull(),
  focusAreas: text("focus_areas"),
  reason: text("reason"),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertInviteRequestSchema = createInsertSchema(inviteRequests).omit({ id: true, createdAt: true, status: true });
export type InsertInviteRequest = z.infer<typeof insertInviteRequestSchema>;
export type InviteRequest = typeof inviteRequests.$inferSelect;

export const memberInviteRequests = pgTable("member_invite_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestedByUserId: varchar("requested_by_user_id").references(() => users.id).notNull(),
  email: text("email").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertMemberInviteRequestSchema = createInsertSchema(memberInviteRequests).omit({ id: true, createdAt: true, status: true });
export type InsertMemberInviteRequest = z.infer<typeof insertMemberInviteRequestSchema>;
export type MemberInviteRequest = typeof memberInviteRequests.$inferSelect;

// ─── User Profiles ────────────────────────────────────────────────────────────
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  healthRole: text("health_role"),
  regions: text("regions").array().default(sql`'{}'::text[]`),
  interests: text("interests").array().default(sql`'{}'::text[]`),
  collaborationMode: text("collaboration_mode").default("OBSERVE"),
  assistantActivityLevel: text("assistant_activity_level").default("BALANCED"),
  introPreference: text("intro_preference").default("SUGGEST_ONLY"),
  profileSnapshot: text("profile_snapshot"),
  currentGoal: text("current_goal"),
  onboardingComplete: boolean("onboarding_complete").default(false),
  snapshotUpdatedAt: timestamp("snapshot_updated_at"),
  lastFocusReviewAt: timestamp("last_focus_review_at"),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

// ─── Push Subscriptions ──────────────────────────────────────────────────────
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// ─── Tables ───────────────────────────────────────────────────────────────────
export const tables = pgTable("collaboration_tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  purpose: text("purpose").notNull(),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("ACTIVE"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  requiresApprovalToJoin: boolean("requires_approval_to_join").default(true),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertTableSchema = createInsertSchema(tables).omit({ id: true, createdAt: true });
export type InsertTable = z.infer<typeof insertTableSchema>;
export type Table = typeof tables.$inferSelect;

// ─── Table Requests ───────────────────────────────────────────────────────────
export const tableRequests = pgTable("table_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  purpose: text("purpose").notNull(),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  reason: text("reason"),
  requestedByUserId: varchar("requested_by_user_id").references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertTableRequestSchema = createInsertSchema(tableRequests).omit({ id: true, createdAt: true, status: true });
export type InsertTableRequest = z.infer<typeof insertTableRequestSchema>;
export type TableRequest = typeof tableRequests.$inferSelect;

// ─── Table Members ────────────────────────────────────────────────────────────
export const tableMembers = pgTable("table_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").notNull().references(() => tables.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  memberRole: text("member_role").notNull().default("MEMBER"),
  joinedAt: timestamp("joined_at").default(sql`now()`).notNull(),
});

export type TableMember = typeof tableMembers.$inferSelect;

// ─── Threads ──────────────────────────────────────────────────────────────────
export const threads = pgTable("threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").notNull().references(() => tables.id),
  title: text("title").notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  status: text("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertThreadSchema = createInsertSchema(threads).omit({ id: true, createdAt: true });
export type InsertThread = z.infer<typeof insertThreadSchema>;
export type Thread = typeof threads.$inferSelect;

// ─── Posts ────────────────────────────────────────────────────────────────────
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => threads.id),
  userId: varchar("user_id").references(() => users.id),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileMimeType: text("file_mime_type"),
  moderationStatus: text("moderation_status").notNull().default("CLEAN"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  editedAt: timestamp("edited_at"),
});

export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true, editedAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// ─── DM Conversations ─────────────────────────────────────────────────────────
export const dmConversations = pgTable("dm_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userAId: varchar("user_a_id").references(() => users.id),
  userBId: varchar("user_b_id").references(() => users.id),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export type DmConversation = typeof dmConversations.$inferSelect;

// ─── DM Messages ─────────────────────────────────────────────────────────────
export const dmMessages = pgTable("dm_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => dmConversations.id),
  senderId: varchar("sender_id").references(() => users.id),
  content: text("content").notNull().default(""),
  messageType: text("message_type").notNull().default("TEXT"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileMimeType: text("file_mime_type"),
  isOneTime: boolean("is_one_time").notNull().default(false),
  viewedOnce: boolean("viewed_once").notNull().default(false),
  replyToId: varchar("reply_to_id"),
  moderationStatus: text("moderation_status").notNull().default("CLEAN"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertDmMessageSchema = createInsertSchema(dmMessages).omit({ id: true, createdAt: true });
export type InsertDmMessage = z.infer<typeof insertDmMessageSchema>;
export type DmMessage = typeof dmMessages.$inferSelect;

// ─── DM Reactions ─────────────────────────────────────────────────────────────
export const dmReactions = pgTable("dm_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => dmMessages.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export type DmReaction = typeof dmReactions.$inferSelect;

// ─── Calendar Events ─────────────────────────────────────────────────────────
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  organiser: text("organiser"),
  regionScope: text("region_scope"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  sourceNote: text("source_note"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true });
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// ─── Calendar Signals ─────────────────────────────────────────────────────────
export const calendarSignals = pgTable("calendar_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  eventId: varchar("event_id").references(() => calendarEvents.id),
  signalType: text("signal_type").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export type CalendarSignal = typeof calendarSignals.$inferSelect;

// ─── Community Events (User-Created Milestones) ──────────────────────────────
export const communityEvents = pgTable("community_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: text("event_date").notNull(),
  endDate: text("end_date"),
  location: text("location"),
  virtualLink: text("virtual_link"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  visibility: text("visibility").notNull().default("PUBLIC"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertCommunityEventSchema = createInsertSchema(communityEvents).omit({ id: true, createdAt: true });
export type InsertCommunityEvent = z.infer<typeof insertCommunityEventSchema>;
export type CommunityEvent = typeof communityEvents.$inferSelect;

export const communityEventSignals = pgTable("community_event_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  eventId: varchar("event_id").references(() => communityEvents.id),
  signalType: text("signal_type").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export type CommunityEventSignal = typeof communityEventSignals.$inferSelect;

// ─── Feedback ─────────────────────────────────────────────────────────────────
export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  contextType: text("context_type").notNull().default("GENERAL"),
  contextId: varchar("context_id"),
  category: text("category").notNull(),
  rating: integer("rating"),
  message: text("message").notNull(),
  status: text("status").notNull().default("NEW"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true, status: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// ─── Moderation Queue ─────────────────────────────────────────────────────────
export const moderationQueue = pgTable("moderation_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentType: text("content_type").notNull(),
  contentId: varchar("content_id").notNull(),
  reason: text("reason").notNull(),
  modelScores: json("model_scores"),
  status: text("status").notNull().default("OPEN"),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  reportedByUserId: varchar("reported_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export type ModerationQueueItem = typeof moderationQueue.$inferSelect;

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;

// ─── Table Join Requests ──────────────────────────────────────────────────────
export const tableJoinRequests = pgTable("table_join_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").notNull().references(() => tables.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export type TableJoinRequest = typeof tableJoinRequests.$inferSelect;

// ─── Thread Memory (Rolling Summaries) ───────────────────────────────────────
export const threadMemory = pgTable("thread_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => threads.id),
  summary: text("summary").notNull(),
  lastMessageIdIncluded: varchar("last_message_id_included"),
  postCountIncluded: integer("post_count_included").notNull().default(0),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

export type ThreadMemory = typeof threadMemory.$inferSelect;

// ─── Reactivation Appeals ────────────────────────────────────────────────────
export const reactivationAppeals = pgTable("reactivation_appeals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  status: text("status").notNull().default("PENDING"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertReactivationAppealSchema = createInsertSchema(reactivationAppeals).omit({ id: true, createdAt: true, status: true, reviewedByUserId: true, reviewedAt: true });
export type InsertReactivationAppeal = z.infer<typeof insertReactivationAppealSchema>;
export type ReactivationAppeal = typeof reactivationAppeals.$inferSelect;

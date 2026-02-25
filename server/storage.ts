import { db } from "./db";
import { eq, and, or, desc, ne, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";

// ─── Auth / Users ─────────────────────────────────────────────────────────────
export async function getUserById(id: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return user;
}
export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  return user;
}
export async function getAllUsers() {
  return db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
}
export async function createUser(data: { name: string; email: string; password: string; organisation?: string; roleTitle?: string }) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const verifyToken = randomBytes(32).toString("hex");
  const [user] = await db.insert(schema.users).values({
    name: data.name,
    email: data.email,
    passwordHash,
    emailVerifyToken: verifyToken,
    organisation: data.organisation,
    roleTitle: data.roleTitle,
    status: "PENDING_VERIFICATION",
  }).returning();
  return user;
}
export async function verifyUserEmail(token: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.emailVerifyToken, token));
  if (!user) return null;
  const [updated] = await db.update(schema.users).set({ emailVerifiedAt: new Date(), emailVerifyToken: null, status: "PENDING_APPROVAL" }).where(eq(schema.users.id, user.id)).returning();
  return updated;
}
export async function updateUserStatus(id: string, status: string) {
  const [updated] = await db.update(schema.users).set({ status }).where(eq(schema.users.id, id)).returning();
  return updated;
}
export async function updateUserRole(id: string, role: string) {
  const [updated] = await db.update(schema.users).set({ role }).where(eq(schema.users.id, id)).returning();
  return updated;
}
export async function updateUserLastLogin(id: string) {
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, id));
}
export async function verifyPassword(user: schema.User, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}

// ─── Invites ──────────────────────────────────────────────────────────────────
export async function createInvite(data: { email?: string; createdByUserId?: string; expiresAt?: Date }) {
  const token = randomBytes(16).toString("hex").toUpperCase();
  const [invite] = await db.insert(schema.invites).values({
    token,
    email: data.email,
    createdByUserId: data.createdByUserId,
    expiresAt: data.expiresAt,
    status: "UNUSED",
  }).returning();
  return invite;
}
export async function getInviteByToken(token: string) {
  const [invite] = await db.select().from(schema.invites).where(eq(schema.invites.token, token.toUpperCase()));
  return invite;
}
export async function getAllInvites() {
  return db.select().from(schema.invites).orderBy(desc(schema.invites.createdAt));
}
export async function useInvite(token: string, userId: string) {
  const [updated] = await db.update(schema.invites).set({ status: "USED", usedByUserId: userId }).where(eq(schema.invites.token, token.toUpperCase())).returning();
  return updated;
}
export async function revokeInvite(id: string) {
  const [updated] = await db.update(schema.invites).set({ status: "REVOKED" }).where(eq(schema.invites.id, id)).returning();
  return updated;
}

// ─── Invite Requests ──────────────────────────────────────────────────────────
export async function createInviteRequest(data: schema.InsertInviteRequest) {
  const [req] = await db.insert(schema.inviteRequests).values(data).returning();
  return req;
}
export async function getAllInviteRequests() {
  return db.select().from(schema.inviteRequests).orderBy(desc(schema.inviteRequests.createdAt));
}
export async function updateInviteRequestStatus(id: string, status: string) {
  const [updated] = await db.update(schema.inviteRequests).set({ status }).where(eq(schema.inviteRequests.id, id)).returning();
  return updated;
}

// ─── User Profiles ────────────────────────────────────────────────────────────
export async function getUserProfile(userId: string) {
  const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
  return profile;
}
export async function upsertUserProfile(userId: string, data: Partial<schema.InsertUserProfile>) {
  const existing = await getUserProfile(userId);
  if (existing) {
    const [updated] = await db.update(schema.userProfiles).set({ ...data, snapshotUpdatedAt: new Date() }).where(eq(schema.userProfiles.userId, userId)).returning();
    return updated;
  } else {
    const [created] = await db.insert(schema.userProfiles).values({ userId, ...data }).returning();
    return created;
  }
}

// ─── Tables ───────────────────────────────────────────────────────────────────
export async function getAllTables() {
  return db.select().from(schema.tables).where(eq(schema.tables.status, "ACTIVE")).orderBy(desc(schema.tables.createdAt));
}
export async function getTableById(id: string) {
  const [table] = await db.select().from(schema.tables).where(eq(schema.tables.id, id));
  return table;
}
export async function createTable(data: schema.InsertTable) {
  const [table] = await db.insert(schema.tables).values(data).returning();
  return table;
}
export async function updateTableStatus(id: string, status: string) {
  const [updated] = await db.update(schema.tables).set({ status }).where(eq(schema.tables.id, id)).returning();
  return updated;
}
export async function getTablesForUser(userId: string) {
  const memberships = await db.select().from(schema.tableMembers).where(eq(schema.tableMembers.userId, userId));
  if (memberships.length === 0) return [];
  const tableIds = memberships.map(m => m.tableId);
  const results = [];
  for (const tid of tableIds) {
    const [t] = await db.select().from(schema.tables).where(eq(schema.tables.id, tid));
    if (t) results.push(t);
  }
  return results;
}

// ─── Table Members ────────────────────────────────────────────────────────────
export async function getTableMembers(tableId: string) {
  return db.select({ member: schema.tableMembers, user: schema.users })
    .from(schema.tableMembers)
    .innerJoin(schema.users, eq(schema.tableMembers.userId, schema.users.id))
    .where(eq(schema.tableMembers.tableId, tableId));
}
export async function isTableMember(tableId: string, userId: string) {
  const [m] = await db.select().from(schema.tableMembers).where(and(eq(schema.tableMembers.tableId, tableId), eq(schema.tableMembers.userId, userId)));
  return !!m;
}
export async function addTableMember(tableId: string, userId: string, memberRole = "MEMBER") {
  const [m] = await db.insert(schema.tableMembers).values({ tableId, userId, memberRole }).returning();
  return m;
}
export async function removeTableMember(tableId: string, userId: string) {
  await db.delete(schema.tableMembers).where(and(eq(schema.tableMembers.tableId, tableId), eq(schema.tableMembers.userId, userId)));
}

// ─── Table Requests ───────────────────────────────────────────────────────────
export async function createTableRequest(data: schema.InsertTableRequest) {
  const [req] = await db.insert(schema.tableRequests).values(data).returning();
  return req;
}
export async function getAllTableRequests() {
  return db.select().from(schema.tableRequests).orderBy(desc(schema.tableRequests.createdAt));
}
export async function updateTableRequestStatus(id: string, status: string) {
  const [updated] = await db.update(schema.tableRequests).set({ status }).where(eq(schema.tableRequests.id, id)).returning();
  return updated;
}

// ─── Table Join Requests ──────────────────────────────────────────────────────
export async function createTableJoinRequest(tableId: string, userId: string) {
  const [req] = await db.insert(schema.tableJoinRequests).values({ tableId, userId }).returning();
  return req;
}
export async function getTableJoinRequests(tableId: string) {
  return db.select({ request: schema.tableJoinRequests, user: schema.users })
    .from(schema.tableJoinRequests)
    .innerJoin(schema.users, eq(schema.tableJoinRequests.userId, schema.users.id))
    .where(eq(schema.tableJoinRequests.tableId, tableId));
}
export async function updateJoinRequestStatus(id: string, status: string) {
  const [updated] = await db.update(schema.tableJoinRequests).set({ status }).where(eq(schema.tableJoinRequests.id, id)).returning();
  return updated;
}

// ─── Threads ──────────────────────────────────────────────────────────────────
export async function getThreadsByTable(tableId: string) {
  return db.select().from(schema.threads).where(eq(schema.threads.tableId, tableId)).orderBy(desc(schema.threads.createdAt));
}
export async function getThreadById(id: string) {
  const [thread] = await db.select().from(schema.threads).where(eq(schema.threads.id, id));
  return thread;
}
export async function createThread(data: schema.InsertThread) {
  const [thread] = await db.insert(schema.threads).values(data).returning();
  return thread;
}

// ─── Posts ────────────────────────────────────────────────────────────────────
export async function getPostsByThread(threadId: string) {
  return db.select({ post: schema.posts, user: schema.users })
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.posts.userId, schema.users.id))
    .where(eq(schema.posts.threadId, threadId))
    .orderBy(schema.posts.createdAt);
}
export async function createPost(data: schema.InsertPost) {
  const [post] = await db.insert(schema.posts).values(data).returning();
  return post;
}
export async function updatePostModeration(id: string, status: string) {
  const [updated] = await db.update(schema.posts).set({ moderationStatus: status }).where(eq(schema.posts.id, id)).returning();
  return updated;
}

// ─── DMs ─────────────────────────────────────────────────────────────────────

// Returns all active users who share at least one table with the given user
export async function getSharedTableMembersForUser(userId: string) {
  const myMemberships = await db.select({ tableId: schema.tableMembers.tableId })
    .from(schema.tableMembers)
    .where(eq(schema.tableMembers.userId, userId));
  const myTableIds = myMemberships.map(m => m.tableId);
  if (myTableIds.length === 0) return [];
  const coMembers = await db.select({ userId: schema.tableMembers.userId })
    .from(schema.tableMembers)
    .where(and(
      inArray(schema.tableMembers.tableId, myTableIds),
      ne(schema.tableMembers.userId, userId)
    ));
  const uniqueIds = [...new Set(coMembers.map(m => m.userId))];
  if (uniqueIds.length === 0) return [];
  return db.select().from(schema.users)
    .where(and(inArray(schema.users.id, uniqueIds), eq(schema.users.status, "ACTIVE")));
}

// Returns whether two users share at least one table
export async function doUsersShareTable(userAId: string, userBId: string): Promise<boolean> {
  const aMemberships = await db.select({ tableId: schema.tableMembers.tableId })
    .from(schema.tableMembers).where(eq(schema.tableMembers.userId, userAId));
  const aTableIds = aMemberships.map(m => m.tableId);
  if (aTableIds.length === 0) return false;
  const shared = await db.select({ tableId: schema.tableMembers.tableId })
    .from(schema.tableMembers)
    .where(and(
      eq(schema.tableMembers.userId, userBId),
      inArray(schema.tableMembers.tableId, aTableIds)
    ));
  return shared.length > 0;
}

export async function getDmConversationsForUser(userId: string) {
  return db.select().from(schema.dmConversations).where(
    or(eq(schema.dmConversations.userAId, userId), eq(schema.dmConversations.userBId, userId))
  ).orderBy(desc(schema.dmConversations.createdAt));
}
export async function getDmConversationById(id: string) {
  const [conv] = await db.select().from(schema.dmConversations).where(eq(schema.dmConversations.id, id));
  return conv;
}
export async function createDmConversation(userAId: string, userBId: string) {
  const existing = await db.select().from(schema.dmConversations).where(
    or(
      and(eq(schema.dmConversations.userAId, userAId), eq(schema.dmConversations.userBId, userBId)),
      and(eq(schema.dmConversations.userAId, userBId), eq(schema.dmConversations.userBId, userAId))
    )
  );
  if (existing.length > 0) return existing[0];
  const [conv] = await db.insert(schema.dmConversations).values({ userAId, userBId }).returning();
  return conv;
}
export async function getDmMessages(conversationId: string) {
  return db.select({ message: schema.dmMessages, sender: schema.users })
    .from(schema.dmMessages)
    .innerJoin(schema.users, eq(schema.dmMessages.senderId, schema.users.id))
    .where(eq(schema.dmMessages.conversationId, conversationId))
    .orderBy(schema.dmMessages.createdAt);
}
export async function createDmMessage(data: schema.InsertDmMessage) {
  const [msg] = await db.insert(schema.dmMessages).values(data).returning();
  return msg;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
export async function getAllCalendarEvents() {
  return db.select().from(schema.calendarEvents).orderBy(schema.calendarEvents.startDate);
}
export async function createCalendarEvent(data: schema.InsertCalendarEvent) {
  const [event] = await db.insert(schema.calendarEvents).values(data).returning();
  return event;
}
export async function deleteCalendarEvent(id: string) {
  await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.id, id));
}
export async function getUserSignals(userId: string) {
  return db.select().from(schema.calendarSignals).where(eq(schema.calendarSignals.userId, userId));
}
export async function upsertSignal(userId: string, eventId: string, signalType: string) {
  const existing = await db.select().from(schema.calendarSignals).where(and(eq(schema.calendarSignals.userId, userId), eq(schema.calendarSignals.eventId, eventId)));
  if (existing.length > 0) {
    const [updated] = await db.update(schema.calendarSignals).set({ signalType }).where(eq(schema.calendarSignals.id, existing[0].id)).returning();
    return updated;
  }
  const [signal] = await db.insert(schema.calendarSignals).values({ userId, eventId, signalType }).returning();
  return signal;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────
export async function createFeedback(data: schema.InsertFeedback) {
  const [fb] = await db.insert(schema.feedback).values(data).returning();
  return fb;
}
export async function getAllFeedback() {
  return db.select().from(schema.feedback).orderBy(desc(schema.feedback.createdAt));
}

// ─── Moderation ───────────────────────────────────────────────────────────────
export async function createModerationItem(data: { contentType: string; contentId: string; reason: string; modelScores?: any; reportedByUserId?: string }) {
  const [item] = await db.insert(schema.moderationQueue).values(data).returning();
  return item;
}
export async function getAllModerationItems() {
  return db.select().from(schema.moderationQueue).orderBy(desc(schema.moderationQueue.createdAt));
}
export async function resolveModerationItem(id: string) {
  const [updated] = await db.update(schema.moderationQueue).set({ status: "RESOLVED", resolvedAt: new Date() }).where(eq(schema.moderationQueue.id, id)).returning();
  return updated;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export async function createAuditEntry(data: { actorUserId?: string; action: string; targetType: string; targetId: string; metadata?: any }) {
  const [entry] = await db.insert(schema.auditLog).values(data).returning();
  return entry;
}
export async function getAuditLog() {
  return db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(500);
}

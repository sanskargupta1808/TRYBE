import { db } from "./db";
import { eq, and, or, desc, ne, inArray, count, max, gte, lt, lte, sql } from "drizzle-orm";
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
export async function searchActiveUsers(query: string, limit = 10) {
  const q = `%${query.toLowerCase()}%`;
  return db.select({ id: schema.users.id, name: schema.users.name, handle: schema.users.handle, organisation: schema.users.organisation })
    .from(schema.users)
    .where(and(eq(schema.users.status, "ACTIVE"), or(sql`LOWER(${schema.users.name}) LIKE ${q}`, sql`LOWER(${schema.users.handle}) LIKE ${q}`)))
    .limit(limit);
}
export async function generateUniqueHandle(name: string): Promise<string> {
  let base = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (base.length < 3) base = "user" + base;
  let handle = base.slice(0, 30);
  let suffix = 1;
  while (true) {
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.handle, handle));
    if (!existing) return handle;
    const suffixStr = String(suffix);
    handle = base.slice(0, 30 - suffixStr.length) + suffixStr;
    suffix++;
  }
}
export async function createUser(data: { name: string; email: string; password: string; organisation?: string; roleTitle?: string }) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const verifyToken = randomBytes(32).toString("hex");
  const handle = await generateUniqueHandle(data.name);
  const [user] = await db.insert(schema.users).values({
    name: data.name,
    handle,
    email: data.email,
    passwordHash,
    emailVerifyToken: verifyToken,
    organisation: data.organisation,
    roleTitle: data.roleTitle,
    status: "PENDING_VERIFICATION",
  }).returning();
  return user;
}
export async function updateUserHandle(userId: string, handle: string) {
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.handle, handle), sql`${schema.users.id} != ${userId}`));
  if (existing) return null;
  const [updated] = await db.update(schema.users).set({ handle }).where(eq(schema.users.id, userId)).returning();
  return updated;
}
export async function verifyUserEmail(token: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.emailVerifyToken, token));
  if (!user) return null;
  const [updated] = await db.update(schema.users).set({ emailVerifiedAt: new Date(), emailVerifyToken: null, status: "PENDING_APPROVAL" }).where(eq(schema.users.id, user.id)).returning();
  return updated;
}
export async function updateUserStatus(id: string, status: string) {
  const updates: any = { status };
  if (status === "SUSPENDED") {
    updates.suspendedAt = new Date();
  } else if (status === "ACTIVE") {
    updates.suspendedAt = null;
  }
  const [updated] = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
  return updated;
}
export async function updateUserRole(id: string, role: string) {
  const [updated] = await db.update(schema.users).set({ role }).where(eq(schema.users.id, id)).returning();
  return updated;
}
export async function updateUserLastLogin(id: string) {
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, id));
}
export async function updateUserProfile(id: string, data: Partial<Pick<schema.User, "name" | "organisation" | "roleTitle" | "bio" | "avatarUrl" | "contactVisibility">>) {
  const [updated] = await db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning();
  return updated;
}
export async function verifyPassword(user: schema.User, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}
export async function setPasswordResetToken(userId: string, token: string, expiresAt: Date) {
  await db.update(schema.users).set({ passwordResetToken: token, passwordResetExpiresAt: expiresAt }).where(eq(schema.users.id, userId));
}
export async function getUserByResetToken(token: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.passwordResetToken, token));
  if (!user || !user.passwordResetExpiresAt || new Date() > user.passwordResetExpiresAt) return null;
  return user;
}
export async function resetPassword(userId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(schema.users).set({ passwordHash, passwordResetToken: null, passwordResetExpiresAt: null }).where(eq(schema.users.id, userId));
}

// ─── Invites ──────────────────────────────────────────────────────────────────
export async function createInvite(data: {
  email?: string;
  createdByUserId?: string;
  expiresAt?: Date;
  inviteType?: string;
  autoApproveOnUse?: boolean;
  requiresManualApproval?: boolean;
  maxUses?: number;
  recipientNote?: string;
}) {
  const token = randomBytes(16).toString("hex").toUpperCase();
  const [invite] = await db.insert(schema.invites).values({
    token,
    email: data.email,
    createdByUserId: data.createdByUserId,
    expiresAt: data.expiresAt,
    inviteType: data.inviteType || "ADMIN_CODE",
    autoApproveOnUse: data.autoApproveOnUse ?? true,
    requiresManualApproval: data.requiresManualApproval ?? false,
    maxUses: data.maxUses ?? 1,
    recipientNote: data.recipientNote,
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
export async function getInvitesByCreator(userId: string) {
  return db.select().from(schema.invites)
    .where(eq(schema.invites.createdByUserId, userId))
    .orderBy(desc(schema.invites.createdAt));
}
export async function useInvite(token: string, userId: string) {
  const invite = await getInviteByToken(token);
  if (!invite) return null;
  const newUsesCount = (invite.usesCount || 0) + 1;
  const newStatus = newUsesCount >= invite.maxUses ? "USED" : "UNUSED";
  const [updated] = await db.update(schema.invites).set({
    status: newStatus,
    usedByUserId: userId,
    usesCount: newUsesCount,
  }).where(eq(schema.invites.token, token.toUpperCase())).returning();
  return updated;
}
export async function revokeInvite(id: string) {
  const [updated] = await db.update(schema.invites).set({ status: "REVOKED" }).where(eq(schema.invites.id, id)).returning();
  return updated;
}

// ─── User Invite Quotas ──────────────────────────────────────────────────────
export async function getUserInviteQuota(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;
  const now = new Date();
  if (!user.inviteQuotaResetAt || now > user.inviteQuotaResetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await db.update(schema.users).set({
      inviteQuotaUsedThisMonth: 0,
      inviteQuotaResetAt: nextReset,
    }).where(eq(schema.users.id, userId));
    return { remaining: user.inviteQuotaMonthly, used: 0, total: user.inviteQuotaMonthly, canInvite: user.canInvite };
  }
  return {
    remaining: Math.max(0, user.inviteQuotaMonthly - user.inviteQuotaUsedThisMonth),
    used: user.inviteQuotaUsedThisMonth,
    total: user.inviteQuotaMonthly,
    canInvite: user.canInvite,
  };
}
export async function incrementInviteQuotaUsed(userId: string) {
  const user = await getUserById(userId);
  if (!user) return;
  const now = new Date();
  if (!user.inviteQuotaResetAt || now > user.inviteQuotaResetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await db.update(schema.users).set({
      inviteQuotaUsedThisMonth: 1,
      inviteQuotaResetAt: nextReset,
    }).where(eq(schema.users.id, userId));
  } else {
    await db.update(schema.users).set({
      inviteQuotaUsedThisMonth: user.inviteQuotaUsedThisMonth + 1,
    }).where(eq(schema.users.id, userId));
  }
}
export async function updateUserInvitePrivileges(userId: string, canInvite: boolean, quota?: number) {
  const updates: any = { canInvite };
  if (quota !== undefined) updates.inviteQuotaMonthly = quota;
  const [updated] = await db.update(schema.users).set(updates).where(eq(schema.users.id, userId)).returning();
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

// ─── Member Invite Requests ───────────────────────────────────────────────────
export async function createMemberInviteRequest(data: { requestedByUserId: string; email: string; reason?: string }) {
  const [req] = await db.insert(schema.memberInviteRequests).values(data).returning();
  return req;
}
export async function getMemberInviteRequestsByUser(userId: string) {
  return db.select().from(schema.memberInviteRequests).where(eq(schema.memberInviteRequests.requestedByUserId, userId)).orderBy(desc(schema.memberInviteRequests.createdAt));
}
export async function getMemberInviteRequestCount(userId: string) {
  const all = await db.select().from(schema.memberInviteRequests).where(eq(schema.memberInviteRequests.requestedByUserId, userId));
  return all.length;
}
export async function getAllMemberInviteRequests() {
  return db.select().from(schema.memberInviteRequests).orderBy(desc(schema.memberInviteRequests.createdAt));
}
export async function updateMemberInviteRequestStatus(id: string, status: string) {
  const [updated] = await db.update(schema.memberInviteRequests).set({ status }).where(eq(schema.memberInviteRequests.id, id)).returning();
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
  return db
    .select({
      id: schema.tables.id,
      title: schema.tables.title,
      purpose: schema.tables.purpose,
      tags: schema.tables.tags,
      status: schema.tables.status,
      createdByUserId: schema.tables.createdByUserId,
      requiresApprovalToJoin: schema.tables.requiresApprovalToJoin,
      createdAt: schema.tables.createdAt,
      memberCount: count(schema.tableMembers.id),
    })
    .from(schema.tables)
    .leftJoin(schema.tableMembers, eq(schema.tables.id, schema.tableMembers.tableId))
    .where(eq(schema.tables.status, "ACTIVE"))
    .groupBy(schema.tables.id)
    .orderBy(desc(schema.tables.createdAt));
}
export async function getTableById(id: string) {
  const [table] = await db.select().from(schema.tables).where(eq(schema.tables.id, id));
  return table;
}
export async function createTable(data: schema.InsertTable) {
  const [table] = await db.insert(schema.tables).values(data).returning();
  return table;
}
export async function deleteTable(id: string) {
  const threadRows = await db.select({ id: schema.threads.id }).from(schema.threads).where(eq(schema.threads.tableId, id));
  const threadIds = threadRows.map(t => t.id);
  if (threadIds.length > 0) {
    await db.delete(schema.threadMemory).where(inArray(schema.threadMemory.threadId, threadIds));
    await db.delete(schema.posts).where(inArray(schema.posts.threadId, threadIds));
    await db.delete(schema.threads).where(inArray(schema.threads.id, threadIds));
  }
  await db.delete(schema.tableJoinRequests).where(eq(schema.tableJoinRequests.tableId, id));
  await db.delete(schema.tableMembers).where(eq(schema.tableMembers.tableId, id));
  await db.delete(schema.tables).where(eq(schema.tables.id, id));
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
export async function updateMemberRole(tableId: string, userId: string, role: string) {
  const [updated] = await db.update(schema.tableMembers)
    .set({ memberRole: role })
    .where(and(eq(schema.tableMembers.tableId, tableId), eq(schema.tableMembers.userId, userId)))
    .returning();
  return updated;
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
export async function getUserPendingJoinRequests(userId: string) {
  return db.select({ tableId: schema.tableJoinRequests.tableId })
    .from(schema.tableJoinRequests)
    .where(and(eq(schema.tableJoinRequests.userId, userId), eq(schema.tableJoinRequests.status, "PENDING")));
}
export async function updateJoinRequestStatus(id: string, status: string) {
  const [updated] = await db.update(schema.tableJoinRequests).set({ status }).where(eq(schema.tableJoinRequests.id, id)).returning();
  return updated;
}

// ─── Threads ──────────────────────────────────────────────────────────────────
export async function getThreadsByTable(tableId: string) {
  return db
    .select({
      id: schema.threads.id,
      tableId: schema.threads.tableId,
      title: schema.threads.title,
      createdByUserId: schema.threads.createdByUserId,
      status: schema.threads.status,
      createdAt: schema.threads.createdAt,
      postCount: count(schema.posts.id),
    })
    .from(schema.threads)
    .leftJoin(schema.posts, eq(schema.threads.id, schema.posts.threadId))
    .where(eq(schema.threads.tableId, tableId))
    .groupBy(schema.threads.id)
    .orderBy(desc(schema.threads.createdAt));
}
export async function getThreadById(id: string) {
  const [thread] = await db.select().from(schema.threads).where(eq(schema.threads.id, id));
  return thread;
}
export async function createThread(data: schema.InsertThread) {
  const [thread] = await db.insert(schema.threads).values(data).returning();
  return thread;
}
export async function closeThread(id: string) {
  const [updated] = await db.update(schema.threads).set({ status: "CLOSED" }).where(eq(schema.threads.id, id)).returning();
  return updated;
}

// ─── Table Member Role ────────────────────────────────────────────────────────
export async function getTableMemberRole(tableId: string, userId: string): Promise<string | null> {
  const [m] = await db.select().from(schema.tableMembers).where(and(eq(schema.tableMembers.tableId, tableId), eq(schema.tableMembers.userId, userId)));
  return m?.memberRole ?? null;
}

// ─── Posts ────────────────────────────────────────────────────────────────────
export async function getPostsByThread(threadId: string) {
  return db.select({ post: schema.posts, user: schema.users })
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.posts.userId, schema.users.id))
    .where(eq(schema.posts.threadId, threadId))
    .orderBy(schema.posts.createdAt);
}
export async function getPostById(id: string) {
  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, id));
  return post;
}
export async function createPost(data: schema.InsertPost) {
  const [post] = await db.insert(schema.posts).values(data).returning();
  return post;
}
export async function updatePostContent(id: string, content: string) {
  const [updated] = await db.update(schema.posts).set({ content, editedAt: new Date() }).where(eq(schema.posts.id, id)).returning();
  return updated;
}
export async function deletePost(id: string) {
  await db.delete(schema.posts).where(eq(schema.posts.id, id));
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

export async function getSharedTableMembersWithContext(userId: string) {
  const myMemberships = await db.select({ tableId: schema.tableMembers.tableId })
    .from(schema.tableMembers)
    .where(eq(schema.tableMembers.userId, userId));
  const myTableIds = myMemberships.map(m => m.tableId);
  if (myTableIds.length === 0) return [];
  const coMemberRows = await db
    .select({
      userId: schema.tableMembers.userId,
      tableId: schema.tableMembers.tableId,
      tableTitle: schema.tables.title,
    })
    .from(schema.tableMembers)
    .innerJoin(schema.tables, eq(schema.tableMembers.tableId, schema.tables.id))
    .where(and(
      inArray(schema.tableMembers.tableId, myTableIds),
      ne(schema.tableMembers.userId, userId)
    ));
  const memberMap = new Map<string, string[]>();
  for (const row of coMemberRows) {
    if (!memberMap.has(row.userId)) memberMap.set(row.userId, []);
    memberMap.get(row.userId)!.push(row.tableTitle);
  }
  if (memberMap.size === 0) return [];
  const uniqueIds = [...memberMap.keys()];
  const users = await db.select().from(schema.users)
    .where(and(inArray(schema.users.id, uniqueIds), eq(schema.users.status, "ACTIVE")));
  return users.map(u => ({
    id: u.id,
    name: u.name,
    organisation: u.organisation,
    roleTitle: u.roleTitle,
    sharedTables: memberMap.get(u.id) || [],
  }));
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
export async function getUserConversationPartnerIds(userId: string): Promise<string[]> {
  const convos = await getDmConversationsForUser(userId);
  const partnerIds = convos.map(c => c.userAId === userId ? c.userBId : c.userAId).filter(Boolean) as string[];
  return [...new Set(partnerIds)];
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
  const messages = await db.select({ message: schema.dmMessages, sender: schema.users })
    .from(schema.dmMessages)
    .innerJoin(schema.users, eq(schema.dmMessages.senderId, schema.users.id))
    .where(eq(schema.dmMessages.conversationId, conversationId))
    .orderBy(schema.dmMessages.createdAt);
  // Enrich with reactions and replyTo
  const enriched = await Promise.all(messages.map(async (m) => {
    const reactions = await db.select({ reaction: schema.dmReactions, user: schema.users })
      .from(schema.dmReactions)
      .innerJoin(schema.users, eq(schema.dmReactions.userId, schema.users.id))
      .where(eq(schema.dmReactions.messageId, m.message.id));
    let replyTo = null;
    if (m.message.replyToId) {
      const [rm] = await db.select({ message: schema.dmMessages, sender: schema.users })
        .from(schema.dmMessages)
        .innerJoin(schema.users, eq(schema.dmMessages.senderId, schema.users.id))
        .where(eq(schema.dmMessages.id, m.message.replyToId));
      replyTo = rm || null;
    }
    return { ...m, reactions, replyTo };
  }));
  return enriched;
}
export async function getDmMessageById(id: string) {
  const [msg] = await db.select().from(schema.dmMessages).where(eq(schema.dmMessages.id, id));
  return msg;
}
export async function createDmMessage(data: schema.InsertDmMessage) {
  const [msg] = await db.insert(schema.dmMessages).values(data).returning();
  return msg;
}
export async function markMessageViewedOnce(id: string) {
  const [msg] = await db.update(schema.dmMessages).set({ viewedOnce: true }).where(eq(schema.dmMessages.id, id)).returning();
  return msg;
}
export async function toggleDmReaction(messageId: string, userId: string, emoji: string) {
  const existing = await db.select().from(schema.dmReactions).where(
    and(eq(schema.dmReactions.messageId, messageId), eq(schema.dmReactions.userId, userId), eq(schema.dmReactions.emoji, emoji))
  );
  if (existing.length > 0) {
    await db.delete(schema.dmReactions).where(eq(schema.dmReactions.id, existing[0].id));
    return { action: "removed" };
  }
  await db.insert(schema.dmReactions).values({ messageId, userId, emoji });
  return { action: "added" };
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

// ─── Community Events (User-Created Milestones) ──────────────────────────────
export async function getAllCommunityEvents() {
  return db.select().from(schema.communityEvents).orderBy(schema.communityEvents.eventDate);
}
export async function getCommunityEventById(id: string) {
  const [event] = await db.select().from(schema.communityEvents).where(eq(schema.communityEvents.id, id));
  return event;
}
export async function createCommunityEvent(data: schema.InsertCommunityEvent) {
  const [event] = await db.insert(schema.communityEvents).values(data).returning();
  return event;
}
export async function deleteCommunityEvent(id: string) {
  await db.delete(schema.communityEventSignals).where(eq(schema.communityEventSignals.eventId, id));
  await db.delete(schema.communityEvents).where(eq(schema.communityEvents.id, id));
}
export async function getUserCommunitySignals(userId: string) {
  return db.select().from(schema.communityEventSignals).where(eq(schema.communityEventSignals.userId, userId));
}
export async function upsertCommunitySignal(userId: string, eventId: string, signalType: string) {
  const existing = await db.select().from(schema.communityEventSignals).where(and(eq(schema.communityEventSignals.userId, userId), eq(schema.communityEventSignals.eventId, eventId)));
  if (existing.length > 0) {
    if (existing[0].signalType === signalType) {
      await db.delete(schema.communityEventSignals).where(eq(schema.communityEventSignals.id, existing[0].id));
      return null;
    }
    const [updated] = await db.update(schema.communityEventSignals).set({ signalType }).where(eq(schema.communityEventSignals.id, existing[0].id)).returning();
    return updated;
  }
  const [signal] = await db.insert(schema.communityEventSignals).values({ userId, eventId, signalType }).returning();
  return signal;
}
export async function getCommunityEventSignalCounts(eventId: string) {
  const signals = await db.select().from(schema.communityEventSignals).where(eq(schema.communityEventSignals.eventId, eventId));
  return {
    interested: signals.filter(s => s.signalType === "INTERESTED").length,
    attending: signals.filter(s => s.signalType === "ATTENDING").length,
  };
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

// ─── Platform Metrics ─────────────────────────────────────────────────────────
export async function getPlatformCounts() {
  const [threadCount] = await db.select({ count: count() }).from(schema.threads);
  const [postCount] = await db.select({ count: count() }).from(schema.posts);
  const [memberCount] = await db.select({ count: count() }).from(schema.tableMembers);
  return {
    totalThreads: threadCount?.count ?? 0,
    totalPosts: postCount?.count ?? 0,
    totalMemberships: memberCount?.count ?? 0,
  };
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export async function createAuditEntry(data: { actorUserId?: string; action: string; targetType: string; targetId: string; metadata?: any }) {
  const [entry] = await db.insert(schema.auditLog).values(data).returning();
  return entry;
}
export async function getAuditLog() {
  return db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(500);
}

export async function getTableLastActivity(tableIds: string[]) {
  if (tableIds.length === 0) return [];
  return db
    .select({
      tableId: schema.threads.tableId,
      lastPostAt: max(schema.posts.createdAt),
    })
    .from(schema.threads)
    .leftJoin(schema.posts, eq(schema.threads.id, schema.posts.threadId))
    .where(inArray(schema.threads.tableId, tableIds))
    .groupBy(schema.threads.tableId);
}

export async function getRecentActivityCount(userId: string, daysSince: number) {
  const since = new Date(Date.now() - daysSince * 86400000);
  const posts = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(and(eq(schema.posts.userId, userId), gte(schema.posts.createdAt, since)));
  return posts.length;
}

// ─── Thread Memory ───────────────────────────────────────────────────────────
export async function getThreadMemory(threadId: string) {
  const [mem] = await db.select().from(schema.threadMemory).where(eq(schema.threadMemory.threadId, threadId));
  return mem || null;
}
export async function upsertThreadMemory(threadId: string, summary: string, lastMessageId: string | null, postCount: number) {
  const existing = await getThreadMemory(threadId);
  if (existing) {
    const [updated] = await db.update(schema.threadMemory).set({
      summary,
      lastMessageIdIncluded: lastMessageId,
      postCountIncluded: postCount,
      updatedAt: new Date(),
    }).where(eq(schema.threadMemory.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(schema.threadMemory).values({
    threadId,
    summary,
    lastMessageIdIncluded: lastMessageId,
    postCountIncluded: postCount,
  }).returning();
  return created;
}

// ─── WHO Health Days Sync ─────────────────────────────────────────────────────
export async function syncWHOHealthDays(events: { title: string; startDate: string; endDate: string | null; organiser: string; regionScope: string; tags: string[]; sourceNote: string }[]) {
  let added = 0;
  for (const ev of events) {
    const existing = await db.select({ id: schema.calendarEvents.id })
      .from(schema.calendarEvents)
      .where(and(
        eq(schema.calendarEvents.title, ev.title),
        eq(schema.calendarEvents.startDate, ev.startDate)
      ));
    if (existing.length === 0) {
      await db.insert(schema.calendarEvents).values({
        title: ev.title,
        startDate: ev.startDate,
        endDate: ev.endDate,
        organiser: ev.organiser,
        regionScope: ev.regionScope,
        tags: ev.tags,
        sourceNote: ev.sourceNote,
      });
      added++;
    }
  }
  return added;
}

// ─── Cleanup: Inactive Tables & Past Events ──────────────────────────────────
export async function cleanupInactiveTables(inactiveDays = 14) {
  const allTables = await db.select({ id: schema.tables.id, createdAt: schema.tables.createdAt }).from(schema.tables).where(eq(schema.tables.status, "ACTIVE"));
  const cutoff = new Date(Date.now() - inactiveDays * 86400000);
  const removed: string[] = [];
  for (const t of allTables) {
    const activity = await getTableLastActivity([t.id]);
    const lastActive = activity[0]?.lastPostAt || t.createdAt;
    if (lastActive && new Date(lastActive) < cutoff) {
      await deleteTable(t.id);
      removed.push(t.id);
    }
  }
  return removed;
}

// ─── Reactivation Appeals ─────────────────────────────────────────────────────
export async function createReactivationAppeal(userId: string, message: string) {
  const [appeal] = await db.insert(schema.reactivationAppeals).values({ userId, message }).returning();
  return appeal;
}

export async function getReactivationAppealsByUser(userId: string) {
  return db.select().from(schema.reactivationAppeals).where(eq(schema.reactivationAppeals.userId, userId)).orderBy(desc(schema.reactivationAppeals.createdAt));
}

export async function getAllPendingAppeals() {
  return db.select().from(schema.reactivationAppeals).where(eq(schema.reactivationAppeals.status, "PENDING")).orderBy(desc(schema.reactivationAppeals.createdAt));
}

export async function getAllAppeals() {
  return db.select().from(schema.reactivationAppeals).orderBy(desc(schema.reactivationAppeals.createdAt));
}

export async function updateAppealStatus(id: string, status: string, reviewedByUserId: string) {
  const [updated] = await db.update(schema.reactivationAppeals).set({ status, reviewedByUserId, reviewedAt: new Date() }).where(eq(schema.reactivationAppeals.id, id)).returning();
  return updated;
}

export async function getSuspendedUsersForAutoDelete(daysThreshold: number) {
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);
  return db.select().from(schema.users)
    .where(and(
      eq(schema.users.status, "SUSPENDED"),
      lte(schema.users.suspendedAt, cutoff)
    ));
}

export async function deleteUserCompletely(userId: string) {
  const convos = await db.select({ id: schema.dmConversations.id }).from(schema.dmConversations)
    .where(or(eq(schema.dmConversations.userAId, userId), eq(schema.dmConversations.userBId, userId)));
  const convoIds = convos.map(c => c.id);
  if (convoIds.length > 0) {
    for (const cid of convoIds) {
      const msgs = await db.select({ id: schema.dmMessages.id }).from(schema.dmMessages).where(eq(schema.dmMessages.conversationId, cid));
      const msgIds = msgs.map(m => m.id);
      if (msgIds.length > 0) {
        for (const mid of msgIds) {
          await db.delete(schema.dmReactions).where(eq(schema.dmReactions.messageId, mid));
        }
        await db.delete(schema.dmMessages).where(eq(schema.dmMessages.conversationId, cid));
      }
    }
    for (const cid of convoIds) {
      await db.delete(schema.dmConversations).where(eq(schema.dmConversations.id, cid));
    }
  }
  await db.delete(schema.calendarSignals).where(eq(schema.calendarSignals.userId, userId));
  await db.delete(schema.communityEventSignals).where(eq(schema.communityEventSignals.userId, userId));
  const userCommunityEvents = await db.select({ id: schema.communityEvents.id }).from(schema.communityEvents).where(eq(schema.communityEvents.createdByUserId, userId));
  for (const ev of userCommunityEvents) {
    await db.delete(schema.communityEventSignals).where(eq(schema.communityEventSignals.eventId, ev.id));
    await db.delete(schema.communityEvents).where(eq(schema.communityEvents.id, ev.id));
  }
  const userPosts = await db.select({ id: schema.posts.id }).from(schema.posts).where(eq(schema.posts.userId, userId));
  for (const post of userPosts) {
    await db.delete(schema.moderationQueue).where(and(eq(schema.moderationQueue.contentType, "POST"), eq(schema.moderationQueue.contentId, post.id)));
  }
  await db.delete(schema.posts).where(eq(schema.posts.userId, userId));
  const userThreads = await db.select({ id: schema.threads.id }).from(schema.threads).where(eq(schema.threads.createdByUserId, userId));
  for (const t of userThreads) {
    const threadPosts = await db.select({ id: schema.posts.id }).from(schema.posts).where(eq(schema.posts.threadId, t.id));
    for (const p of threadPosts) {
      await db.delete(schema.moderationQueue).where(and(eq(schema.moderationQueue.contentType, "POST"), eq(schema.moderationQueue.contentId, p.id)));
    }
    await db.delete(schema.posts).where(eq(schema.posts.threadId, t.id));
    await db.delete(schema.threadMemory).where(eq(schema.threadMemory.threadId, t.id));
    await db.delete(schema.threads).where(eq(schema.threads.id, t.id));
  }
  await db.delete(schema.tableMembers).where(eq(schema.tableMembers.userId, userId));
  await db.delete(schema.tableJoinRequests).where(eq(schema.tableJoinRequests.userId, userId));
  await db.update(schema.tables).set({ createdByUserId: null }).where(eq(schema.tables.createdByUserId, userId));
  await db.delete(schema.tableRequests).where(eq(schema.tableRequests.requestedByUserId, userId));
  await db.update(schema.invites).set({ createdByUserId: null }).where(eq(schema.invites.createdByUserId, userId));
  await db.update(schema.invites).set({ usedByUserId: null }).where(eq(schema.invites.usedByUserId, userId));
  await db.delete(schema.feedback).where(eq(schema.feedback.userId, userId));
  await db.delete(schema.reactivationAppeals).where(eq(schema.reactivationAppeals.userId, userId));
  await db.update(schema.reactivationAppeals).set({ reviewedByUserId: null }).where(eq(schema.reactivationAppeals.reviewedByUserId, userId));
  await db.update(schema.moderationQueue).set({ assignedToUserId: null }).where(eq(schema.moderationQueue.assignedToUserId, userId));
  await db.delete(schema.moderationQueue).where(eq(schema.moderationQueue.reportedByUserId, userId));
  await db.delete(schema.auditLog).where(eq(schema.auditLog.actorUserId, userId));
  await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

export async function cleanupPastEvents() {
  const today = new Date().toISOString().split("T")[0];
  const pastEvents = await db.select({ id: schema.calendarEvents.id }).from(schema.calendarEvents).where(lt(schema.calendarEvents.startDate, today));
  for (const ev of pastEvents) {
    await db.delete(schema.calendarSignals).where(eq(schema.calendarSignals.eventId, ev.id));
    await deleteCalendarEvent(ev.id);
  }
  return pastEvents.length;
}

import "../server/env";
import bcrypt from "bcrypt";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../server/db";
import * as schema from "../shared/schema";
import * as storage from "../server/storage";

type DemoUser = {
  name: string;
  email: string;
  organisation: string;
  roleTitle: string;
  bio: string;
  interests: string[];
  regions: string[];
  healthRole?: string;
  currentGoal?: string;
};

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TrybeDemo123!";
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "sanskarsg38@gmail.com";

const demoUsers: DemoUser[] = [
  {
    name: "Aisha Patel",
    email: "aisha.patel@example.com",
    organisation: "Global Health Now",
    roleTitle: "Program Lead",
    bio: "Focuses on maternal health programs and cross-border partnerships.",
    interests: ["maternal-health", "vaccines", "community-health"],
    regions: ["South Asia", "Global"],
    healthRole: "Program Manager",
    currentGoal: "Align Q2 maternal health outreach with regional partners.",
  },
  {
    name: "Luis Hernandez",
    email: "luis.hernandez@example.com",
    organisation: "Health Systems Lab",
    roleTitle: "Policy Analyst",
    bio: "Works on health systems strengthening and financing.",
    interests: ["health-systems", "policy", "financing"],
    regions: ["Latin America", "Global"],
    healthRole: "Policy Analyst",
    currentGoal: "Identify gaps in workforce capacity for Q2.",
  },
  {
    name: "Mei Lin",
    email: "mei.lin@example.com",
    organisation: "Asia Pacific NCD Alliance",
    roleTitle: "Partnerships Manager",
    bio: "Coordinates cross-sector NCD prevention partnerships.",
    interests: ["NCD", "prevention", "diabetes"],
    regions: ["Asia Pacific"],
    healthRole: "Partnerships Lead",
    currentGoal: "Plan a multi-country diabetes awareness campaign.",
  },
  {
    name: "Emma Osei",
    email: "emma.osei@example.com",
    organisation: "Pan-African Health Network",
    roleTitle: "Research Coordinator",
    bio: "Leads research collaborations across regional partners.",
    interests: ["research", "clinical-trials", "equity"],
    regions: ["Africa"],
    healthRole: "Research Coordinator",
    currentGoal: "Share trial recruitment best practices for Q2.",
  },
  {
    name: "Noah Kim",
    email: "noah.kim@example.com",
    organisation: "Mental Health Advocacy Group",
    roleTitle: "Advocacy Lead",
    bio: "Advocates for mental health policy and community-based support.",
    interests: ["mental-health", "policy", "advocacy"],
    regions: ["North America", "Global"],
    healthRole: "Advocacy Lead",
    currentGoal: "Draft a policy brief for upcoming mental health meetings.",
  },
  {
    name: "Zara Bello",
    email: "zara.bello@example.com",
    organisation: "Rare Disease Collective",
    roleTitle: "Community Director",
    bio: "Builds rare disease community engagement and patient voice.",
    interests: ["rare-disease", "patient-advocacy", "community"],
    regions: ["Europe", "Global"],
    healthRole: "Community Director",
    currentGoal: "Organize a rare disease roundtable in Q3.",
  },
];

async function upsertDemoUser(user: DemoUser) {
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, user.email));
  if (existing) {
    const updates: Partial<schema.InsertUser> = {
      name: user.name,
      organisation: user.organisation,
      roleTitle: user.roleTitle,
      bio: user.bio,
      status: "ACTIVE",
      role: "USER",
    };
    if (!existing.emailVerifiedAt) updates.emailVerifiedAt = new Date();
    await db.update(schema.users).set(updates).where(eq(schema.users.id, existing.id));
    await storage.upsertUserProfile(existing.id, {
      healthRole: user.healthRole,
      interests: user.interests,
      regions: user.regions,
      collaborationMode: "CONTRIBUTE",
      assistantActivityLevel: "BALANCED",
      onboardingComplete: true,
      profileSnapshot: user.bio,
      currentGoal: user.currentGoal,
    });
    return existing;
  }

  const handle = await storage.generateUniqueHandle(user.name);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [created] = await db.insert(schema.users).values({
    name: user.name,
    handle,
    email: user.email,
    passwordHash,
    emailVerifiedAt: new Date(),
    status: "ACTIVE",
    role: "USER",
    organisation: user.organisation,
    roleTitle: user.roleTitle,
    bio: user.bio,
  }).returning();

  await storage.upsertUserProfile(created.id, {
    healthRole: user.healthRole,
    interests: user.interests,
    regions: user.regions,
    collaborationMode: "CONTRIBUTE",
    assistantActivityLevel: "BALANCED",
    onboardingComplete: true,
    profileSnapshot: user.bio,
    currentGoal: user.currentGoal,
  });

  return created;
}

async function ensureMembership(tableId: string, userId: string, role = "MEMBER") {
  const existing = await db.select().from(schema.tableMembers).where(
    and(eq(schema.tableMembers.tableId, tableId), eq(schema.tableMembers.userId, userId))
  );
  if (existing.length === 0) {
    await db.insert(schema.tableMembers).values({ tableId, userId, memberRole: role });
  }
}

async function ensureThread(tableId: string, title: string, createdByUserId: string) {
  const [existing] = await db.select().from(schema.threads).where(
    and(eq(schema.threads.tableId, tableId), eq(schema.threads.title, title))
  );
  if (existing) return existing;
  const [created] = await db.insert(schema.threads).values({ tableId, title, createdByUserId, status: "OPEN" }).returning();
  return created;
}

async function ensurePosts(threadId: string, posts: { userId: string; content: string }[]) {
  const existing = await db.select().from(schema.posts).where(eq(schema.posts.threadId, threadId));
  if (existing.length > 0) return;
  for (const p of posts) {
    await db.insert(schema.posts).values({
      threadId,
      userId: p.userId,
      content: p.content,
      moderationStatus: "CLEAN",
    });
  }
}

async function ensureDmConversation(userAId: string, userBId: string, messages: { senderId: string; content: string }[]) {
  const conv = await storage.createDmConversation(userAId, userBId);
  const existing = await db.select().from(schema.dmMessages).where(eq(schema.dmMessages.conversationId, conv.id));
  if (existing.length > 0) return conv;
  for (const msg of messages) {
    await db.insert(schema.dmMessages).values({
      conversationId: conv.id,
      senderId: msg.senderId,
      content: msg.content,
      messageType: "TEXT",
      isOneTime: false,
      viewedOnce: false,
      moderationStatus: "CLEAN",
    });
  }
  return conv;
}

async function seedDemo() {
  console.log("🌱 Seeding demo data...");

  const [admin] = await db.select().from(schema.users).where(eq(schema.users.email, ADMIN_EMAIL));
  if (!admin) {
    throw new Error(`Admin account not found for ${ADMIN_EMAIL}. Set DEMO_ADMIN_EMAIL to the correct admin email.`);
  }

  const createdUsers = [];
  for (const u of demoUsers) {
    const user = await upsertDemoUser(u);
    createdUsers.push(user);
  }

  const tables = await db.select().from(schema.tables).where(eq(schema.tables.status, "ACTIVE")).orderBy(desc(schema.tables.createdAt));
  if (tables.length === 0) {
    throw new Error("No collaboration tables found. Run the base seed first.");
  }
  const primaryTables = tables.slice(0, Math.min(5, tables.length));

  // Ensure memberships
  for (const user of createdUsers) {
    const assignments = primaryTables.slice(0, 3);
    for (const t of assignments) {
      await ensureMembership(t.id, user.id, "MEMBER");
    }
  }
  for (const t of primaryTables) {
    await ensureMembership(t.id, admin.id, "HOST");
  }

  // Threads and posts
  const threadTemplates = [
    { title: "Q2 priorities and dependencies", starter: "Sharing draft Q2 priorities. Please add gaps or dependencies." },
    { title: "Outreach and partnership updates", starter: "What outreach or partner updates should we align on this month?" },
  ];

  for (const t of primaryTables.slice(0, 3)) {
    const author = createdUsers[0];
    for (const template of threadTemplates) {
      const thread = await ensureThread(t.id, template.title, author.id);
      await ensurePosts(thread.id, [
        { userId: author.id, content: template.starter },
        { userId: createdUsers[1].id, content: "We should sync with regional partners and clarify milestones." },
        { userId: createdUsers[2].id, content: "Agree. I can draft a short timeline and owner list." },
        { userId: admin.id, content: "Thanks all. Please summarize key risks by Friday." },
      ]);
    }
  }

  // DMs (including admin)
  for (const user of createdUsers) {
    await ensureDmConversation(user.id, admin.id, [
      { senderId: user.id, content: "Hi Admin, I’ve joined the key tables and shared initial priorities." },
      { senderId: admin.id, content: "Thanks. Let me know if you need support with invites or moderation." },
    ]);
  }
  await ensureDmConversation(createdUsers[0].id, createdUsers[1].id, [
    { senderId: createdUsers[0].id, content: "Can you review the draft milestones before I post?" },
    { senderId: createdUsers[1].id, content: "Yes, I can review tonight and send comments." },
  ]);
  await ensureDmConversation(createdUsers[2].id, createdUsers[3].id, [
    { senderId: createdUsers[2].id, content: "Do we have a shared contact list for the campaign?" },
    { senderId: createdUsers[3].id, content: "Not yet. I’ll upload a draft after my meeting." },
  ]);

  // Calendar signals
  const events = await db.select().from(schema.calendarEvents).orderBy(desc(schema.calendarEvents.startDate));
  const sampleEvents = events.slice(0, 3);
  for (const ev of sampleEvents) {
    await storage.upsertSignal(createdUsers[0].id, ev.id, "ATTENDING");
    await storage.upsertSignal(createdUsers[1].id, ev.id, "INTERESTED");
    await storage.upsertSignal(createdUsers[2].id, ev.id, "WATCHING");
  }

  console.log("✅ Demo data seeded.");
}

seedDemo().catch((err) => {
  console.error("❌ Demo seed failed:", err?.message || err);
  process.exit(1);
});

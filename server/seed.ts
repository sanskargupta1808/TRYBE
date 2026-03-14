import "./env";
import { db } from "./db";
import { users, invites, tables, tableMembers, calendarEvents } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function seed() {
  const adminEmail = process.env.ADMIN_EMAIL || "sanskarsg38@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "12345678";

  console.log("🌱 Seeding TRYBE database...");

  const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail));
  let admin = existingAdmin;
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  if (admin) {
    const passwordOk = await bcrypt.compare(adminPassword, admin.passwordHash);
    const updates: Partial<typeof users.$inferInsert> = {};
    if (!passwordOk) updates.passwordHash = adminPasswordHash;
    if (admin.role !== "ADMIN") updates.role = "ADMIN";
    if (admin.status !== "ACTIVE") updates.status = "ACTIVE";
    if (!admin.emailVerifiedAt) updates.emailVerifiedAt = new Date();
    if (Object.keys(updates).length > 0) {
      const [updated] = await db.update(users).set(updates).where(eq(users.id, admin.id)).returning();
      admin = updated;
      console.log("✅ Admin updated");
    }
  } else {
    const [created] = await db.insert(users).values({
      name: "TRYBE Admin",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
      role: "ADMIN",
      organisation: "TRYBE",
      roleTitle: "Platform Administrator",
    }).returning();
    admin = created;
    console.log(`✅ Admin user created: ${adminEmail}`);
  }

  const [existingInvite] = await db.select({ id: invites.id }).from(invites).limit(1);
  if (!existingInvite) {
    await db.insert(invites).values([
      { token: "ALPHA-TRYBE-001", status: "UNUSED", createdByUserId: admin.id, expiresAt: new Date(Date.now() + 90 * 86400000) },
      { token: "ALPHA-TRYBE-002", status: "UNUSED", createdByUserId: admin.id, expiresAt: new Date(Date.now() + 90 * 86400000) },
      { token: "ALPHA-TRYBE-003", status: "UNUSED", createdByUserId: admin.id, expiresAt: new Date(Date.now() + 90 * 86400000) },
      { token: "ALPHA-TRYBE-004", status: "UNUSED", createdByUserId: admin.id, expiresAt: new Date(Date.now() + 90 * 86400000) },
      { token: "ALPHA-TRYBE-005", status: "UNUSED", createdByUserId: admin.id, expiresAt: new Date(Date.now() + 90 * 86400000) },
    ]);
    console.log("✅ Initial invites created: ALPHA-TRYBE-001 through ALPHA-TRYBE-005");
  }

  // Seed collaboration tables
  const tableData = [
    { title: "Rare Disease Policy – EU 2026", purpose: "Coordinating policy advocacy across rare disease communities ahead of the 2026 EU legislative agenda.", tags: ["rare-disease", "EU", "policy"] },
    { title: "Diabetes Awareness – Asia Pacific", purpose: "Aligning diabetes prevention and awareness initiatives across Asia Pacific health networks.", tags: ["diabetes", "Asia", "awareness"] },
    { title: "Clinical Trials Recruitment – Best Practice", purpose: "Sharing evidence-based practices for diverse and equitable clinical trial recruitment.", tags: ["clinical-trials", "research", "recruitment"] },
    { title: "Patient Voice – Shared Decision Making", purpose: "Advancing the integration of patient perspectives in clinical and policy decision-making.", tags: ["patient-advocacy", "shared-decisions"] },
    { title: "Mental Health Policy – Global Advocacy", purpose: "Building global consensus on mental health policy frameworks and funding priorities.", tags: ["mental-health", "policy", "advocacy"] },
    { title: "HIV/AIDS – Community & Research Bridge", purpose: "Connecting community advocates with clinical researchers to accelerate HIV/AIDS outcomes.", tags: ["HIV", "AIDS", "community", "research"] },
    { title: "Antimicrobial Resistance – One Health", purpose: "Coordinating cross-sector responses to AMR across human, animal, and environmental health.", tags: ["AMR", "one-health", "infectious-disease"] },
    { title: "NCD Prevention – Low-Income Settings", purpose: "Developing context-appropriate non-communicable disease prevention strategies for low-resource settings.", tags: ["NCD", "prevention", "global-health"] },
    { title: "Health System Strengthening – Africa", purpose: "Sharing knowledge and tools to strengthen health system capacity across African nations.", tags: ["health-systems", "Africa", "capacity-building"] },
    { title: "Paediatric Oncology – Advocacy Network", purpose: "Uniting paediatric oncology advocates to improve access to treatment and research globally.", tags: ["oncology", "paediatric", "cancer"] },
  ];

  const [existingTable] = await db.select({ id: tables.id }).from(tables).limit(1);
  if (!existingTable) {
    for (const t of tableData) {
      const [table] = await db.insert(tables).values({ ...t, createdByUserId: admin.id, requiresApprovalToJoin: true }).returning();
      await db.insert(tableMembers).values({ tableId: table.id, userId: admin.id, memberRole: "HOST" });
    }
    console.log("✅ Collaboration tables seeded");
  }

  // Seed 2026 health calendar events
  const calendarData = [
    { title: "World Cancer Day", startDate: "2026-02-04", tags: ["cancer", "awareness", "global"], organiser: "Union for International Cancer Control", regionScope: "Global", sourceNote: "Annual awareness day" },
    { title: "Rare Disease Day", startDate: "2026-02-28", tags: ["rare-disease", "awareness", "global"], organiser: "EURORDIS", regionScope: "Global" },
    { title: "World Tuberculosis Day", startDate: "2026-03-24", tags: ["TB", "infectious-disease", "awareness"], organiser: "WHO", regionScope: "Global" },
    { title: "World Health Day", startDate: "2026-04-07", tags: ["global-health", "awareness", "WHO"], organiser: "WHO", regionScope: "Global" },
    { title: "World Immunisation Week", startDate: "2026-04-24", endDate: "2026-04-30", tags: ["vaccines", "immunisation", "WHO"], organiser: "WHO", regionScope: "Global" },
    { title: "WHO World Health Assembly", startDate: "2026-05-18", endDate: "2026-05-26", tags: ["policy", "WHO", "global-health"], organiser: "WHO", regionScope: "Global", sourceNote: "Annual governing body meeting" },
    { title: "World No Tobacco Day", startDate: "2026-05-31", tags: ["tobacco", "prevention", "awareness"], organiser: "WHO", regionScope: "Global" },
    { title: "World Blood Donor Day", startDate: "2026-06-14", tags: ["blood-donation", "awareness"], organiser: "WHO", regionScope: "Global" },
    { title: "International AIDS Day Lead-up Events", startDate: "2026-11-01", endDate: "2026-11-30", tags: ["HIV", "AIDS", "awareness"], regionScope: "Global" },
    { title: "World AIDS Day", startDate: "2026-12-01", tags: ["HIV", "AIDS", "awareness", "global"], organiser: "UNAIDS", regionScope: "Global" },
    { title: "World Diabetes Day", startDate: "2026-11-14", tags: ["diabetes", "awareness", "NCD"], organiser: "IDF", regionScope: "Global" },
    { title: "World Mental Health Day", startDate: "2026-10-10", tags: ["mental-health", "awareness"], organiser: "World Federation for Mental Health", regionScope: "Global" },
    { title: "World Heart Day", startDate: "2026-09-29", tags: ["cardiovascular", "heart", "awareness"], organiser: "World Heart Federation", regionScope: "Global" },
    { title: "World Alzheimer's Day", startDate: "2026-09-21", tags: ["alzheimers", "dementia", "awareness"], organiser: "ADI", regionScope: "Global" },
    { title: "UN High-Level Meeting on AMR", startDate: "2026-09-01", tags: ["AMR", "policy", "UN"], organiser: "United Nations", regionScope: "Global", sourceNote: "Anticipated September 2026" },
    { title: "World Obesity Day", startDate: "2026-03-04", tags: ["obesity", "NCD", "awareness"], organiser: "World Obesity Federation", regionScope: "Global" },
    { title: "International Day of Rare Diseases Research", startDate: "2026-06-01", tags: ["rare-disease", "research"], regionScope: "Global" },
    { title: "Global Disability Summit", startDate: "2026-07-01", tags: ["disability", "inclusion", "policy"], regionScope: "Global", sourceNote: "Approximate date" },
    { title: "World Hepatitis Day", startDate: "2026-07-28", tags: ["hepatitis", "awareness"], organiser: "WHO", regionScope: "Global" },
    { title: "World Patient Safety Day", startDate: "2026-09-17", tags: ["patient-safety", "WHO"], organiser: "WHO", regionScope: "Global" },
  ];

  const [existingEvent] = await db.select({ id: calendarEvents.id }).from(calendarEvents).limit(1);
  if (!existingEvent) {
    for (const event of calendarData) {
      await db.insert(calendarEvents).values(event);
    }
    console.log("✅ Calendar events seeded (20 2026 health milestones)");
  }

  console.log("🎉 Seeding complete!");
}

import webpush from "web-push";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:admin@trybe.health", VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function savePushSubscription(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, subscription.endpoint));
  const [sub] = await db.insert(schema.pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }).returning();
  return sub;
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await db.delete(schema.pushSubscriptions).where(
    and(eq(schema.pushSubscriptions.userId, userId), eq(schema.pushSubscriptions.endpoint, endpoint))
  );
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; tag?: string; url?: string }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId));
  const jsonPayload = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        jsonPayload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id));
      }
    }
  }
}

export async function sendPushToMultipleUsers(userIds: string[], payload: { title: string; body: string; tag?: string; url?: string }) {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)));
}

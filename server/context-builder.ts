import type { ToolDefinition } from "./assistant-tools";
import { assistantTools } from "./assistant-tools";

type Intent =
  | "thread_discussion"
  | "table_management"
  | "dm_chat"
  | "event_inquiry"
  | "strategic_guidance"
  | "profile_settings"
  | "invitation"
  | "feedback"
  | "general";

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  thread_discussion: [
    "thread", "discussion", "post", "reply", "summarise", "summarize", "summary",
    "draft", "write a post", "contribute", "analyze the discussion", "reflection",
  ],
  table_management: [
    "table", "join", "leave", "create table", "request table", "browse table",
    "suggest table", "recommend table", "what tables", "my tables", "all tables",
  ],
  dm_chat: [
    "message", "dm", "direct message", "send message", "conversation", "chat with",
    "reach out", "contact",
  ],
  event_inquiry: [
    "event", "milestone", "calendar", "upcoming", "attending", "presenting",
    "congress", "awareness day", "signal", "prepare for",
  ],
  strategic_guidance: [
    "strategy", "strategic", "advice", "guidance", "help me think", "collaborate",
    "positioning", "approach", "goal", "plan",
  ],
  profile_settings: [
    "profile", "settings", "interests", "regions", "update my", "change my",
    "collaboration mode", "activity level", "my profile",
  ],
  invitation: [
    "invite", "invitation", "colleague", "quota",
  ],
  feedback: [
    "feedback", "bug", "feature request", "report",
  ],
  general: [],
};

const ALWAYS_AVAILABLE_TOOLS = [
  "get_my_profile", "suggest_tables_for_me", "search_tables", "search_members",
  "search_milestones", "list_my_tables", "list_all_tables", "list_upcoming_milestones",
  "list_my_conversations", "get_table_details", "get_thread_summary",
];

const INTENT_EXTRA_TOOLS: Record<Intent, string[]> = {
  thread_discussion: ["create_thread", "post_in_thread"],
  table_management: ["join_table", "leave_table", "request_new_table"],
  dm_chat: ["send_direct_message"],
  event_inquiry: ["signal_milestone"],
  strategic_guidance: ["create_thread", "post_in_thread", "join_table"],
  profile_settings: ["update_profile"],
  invitation: ["send_invite"],
  feedback: ["submit_feedback"],
  general: [
    "join_table", "leave_table", "create_thread", "post_in_thread",
    "send_direct_message", "signal_milestone", "request_new_table",
    "send_invite", "update_profile", "submit_feedback",
  ],
};

export function classifyIntent(message: string, context?: { tableId?: string; threadId?: string; page?: string }): Intent {
  const lower = message.toLowerCase();

  if (context?.threadId) return "thread_discussion";

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [Intent, string[]][]) {
    if (intent === "general") continue;
    for (const kw of keywords) {
      if (lower.includes(kw)) return intent;
    }
  }

  if (context?.tableId) return "table_management";
  if (context?.page?.includes("/moments")) return "event_inquiry";
  if (context?.page?.includes("/messages")) return "dm_chat";
  if (context?.page?.includes("/settings")) return "profile_settings";
  if (context?.page?.includes("/invites")) return "invitation";
  if (context?.page?.includes("/feedback")) return "feedback";

  return "general";
}

export function getToolsForIntent(intent: Intent): ToolDefinition[] {
  const allowedNames = new Set([
    ...ALWAYS_AVAILABLE_TOOLS,
    ...(INTENT_EXTRA_TOOLS[intent] || []),
  ]);
  const filtered = assistantTools.filter(t => allowedNames.has(t.function.name));
  return filtered.length > 0 ? filtered : assistantTools;
}

export function buildUserProfile(user: any, profile: any): string {
  const lines: string[] = [];

  lines.push(`Name: ${user?.name || "Unknown"}`);
  if (user?.organisation) lines.push(`Organisation: ${user.organisation}`);

  const roleParts = [user?.roleTitle, profile?.healthRole].filter(Boolean);
  if (roleParts.length > 0) lines.push(`Role: ${roleParts.join(" / ")}`);

  if (profile?.interests?.length) {
    lines.push(`Interests: ${profile.interests.join(", ")}`);
  }

  if (profile?.regions?.length) {
    lines.push(`Regions: ${profile.regions.join(", ")}`);
  }

  if (profile?.currentGoal) {
    lines.push(`Goal: ${profile.currentGoal}`);
  }

  lines.push(`Collaboration mode: ${profile?.collaborationMode || "OBSERVE"}`);
  lines.push(`Assistant activity: ${profile?.assistantActivityLevel || "BALANCED"}`);

  return lines.join("\n");
}

export function buildMyTablesSummary(tables: any[]): string {
  if (!tables || tables.length === 0) return "None yet";
  return tables.map(t => `- ${t.title} (ID: ${t.id})`).join("\n");
}

export function buildAvailableTablesSummary(allTables: any[], myTableIds: Set<string>): string {
  const available = allTables.filter(t => !myTableIds.has(t.id));
  if (available.length === 0) return "None — user is in all available tables";
  return available.slice(0, 10).map(t =>
    `- ${t.title} (ID: ${t.id})${(t.tags || []).length > 0 ? ` | Tags: ${(t.tags || []).join(", ")}` : ""}`
  ).join("\n");
}

export function buildUpcomingEventsSummary(events: any[]): string {
  if (!events || events.length === 0) return "None in the next 90 days";
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const upcoming = events
    .filter(e => e.startDate >= today && e.startDate <= cutoff)
    .slice(0, 5)
    .map(e => `- ${e.title} (${e.startDate})${e.organiser ? ` — ${e.organiser}` : ""}${e.tags?.length ? ` [${e.tags.join(", ")}]` : ""}`);
  if (upcoming.length === 0) return "None in the next 90 days";
  return upcoming.join("\n");
}

export function compressConversationHistory(
  history: { role: string; content: string }[]
): { recentMessages: { role: string; content: string }[]; summaryPrefix: string | null } {
  if (!history || history.length === 0) {
    return { recentMessages: [], summaryPrefix: null };
  }

  if (history.length <= 6) {
    return { recentMessages: history, summaryPrefix: null };
  }

  const recent = history.slice(-6);
  const older = history.slice(0, -6);

  const summaryLines: string[] = [];
  for (const msg of older) {
    const prefix = msg.role === "user" ? "User asked about" : "Assistant helped with";
    const trimmed = msg.content.slice(0, 80).replace(/\n/g, " ");
    summaryLines.push(`${prefix}: ${trimmed}${msg.content.length > 80 ? "..." : ""}`);
  }

  const summary = `CONVERSATION CONTEXT (${older.length} earlier exchanges):\n${summaryLines.join("\n")}`;

  return { recentMessages: recent, summaryPrefix: summary };
}

export async function getOrBuildThreadSummary(
  threadId: string,
  storage: any,
  openai: any | null
): Promise<string> {
  const thread = await storage.getThreadById(threadId);
  if (!thread) return "";

  const posts = await storage.getPostsByThread(threadId);
  const cleanPosts = posts.filter((p: any) => p.post.moderationStatus === "CLEAN");

  if (cleanPosts.length === 0) {
    return `Thread: "${thread.title}" (no posts yet)`;
  }

  const existingMemory = await storage.getThreadMemory(threadId);

  if (existingMemory && existingMemory.postCountIncluded >= cleanPosts.length) {
    return `Thread: "${thread.title}" (${cleanPosts.length} posts)\nSummary: ${existingMemory.summary}`;
  }

  if (cleanPosts.length <= 5) {
    const postLines = cleanPosts
      .map((p: any) => `[${p.user?.name || "Member"}]: ${p.post.content}`)
      .join("\n");
    return `Thread: "${thread.title}" (${cleanPosts.length} posts)\n${postLines}`;
  }

  if (!openai) {
    const postLines = cleanPosts.slice(-5)
      .map((p: any) => `[${p.user?.name || "Member"}]: ${p.post.content}`)
      .join("\n");
    return `Thread: "${thread.title}" (${cleanPosts.length} posts, showing last 5)\n${postLines}`;
  }

  try {
    const newPosts = existingMemory
      ? cleanPosts.slice(existingMemory.postCountIncluded)
      : cleanPosts;

    const postText = newPosts
      .map((p: any) => `[${p.user?.name || "Member"}]: ${p.post.content}`)
      .join("\n");

    const priorContext = existingMemory ? `Previous summary: ${existingMemory.summary}\n\n` : "";

    const summaryCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a thread summariser. Produce a concise summary (max 200 words) of the discussion. Include: key themes, main viewpoints, areas of agreement, and open questions. Be factual and neutral. No emoji, no opinions.",
        },
        {
          role: "user",
          content: `${priorContext}New posts to incorporate:\n${postText}`,
        },
      ],
      max_tokens: 300,
    });

    const summary = summaryCompletion.choices[0]?.message?.content || postText.slice(0, 500);
    const lastPost = cleanPosts[cleanPosts.length - 1];

    await storage.upsertThreadMemory(
      threadId,
      summary,
      lastPost?.post?.id || null,
      cleanPosts.length
    );

    return `Thread: "${thread.title}" (${cleanPosts.length} posts)\nSummary: ${summary}`;
  } catch (err: any) {
    console.error("[ThreadMemory] Summary generation failed:", err?.message);
    const postLines = cleanPosts.slice(-5)
      .map((p: any) => `[${p.user?.name || "Member"}]: ${p.post.content}`)
      .join("\n");
    return `Thread: "${thread.title}" (${cleanPosts.length} posts, showing last 5)\n${postLines}`;
  }
}

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

const TOOL_GROUPS: Record<string, string[]> = {
  core: [
    "get_my_profile", "suggest_tables_for_me",
  ],
  tables: [
    "join_table", "leave_table", "search_tables", "list_all_tables",
    "get_table_details", "list_my_tables", "request_new_table",
    "suggest_tables_for_me",
  ],
  threads: [
    "create_thread", "post_in_thread", "get_thread_summary",
    "get_table_details", "list_my_tables",
  ],
  messaging: [
    "send_direct_message", "list_my_conversations", "search_members",
  ],
  events: [
    "list_upcoming_milestones", "search_milestones", "signal_milestone",
  ],
  profile: [
    "get_my_profile", "update_profile",
  ],
  invites: [
    "send_invite",
  ],
  feedback: [
    "submit_feedback",
  ],
};

const INTENT_TOOL_MAP: Record<Intent, string[]> = {
  thread_discussion: [...TOOL_GROUPS.threads, ...TOOL_GROUPS.core],
  table_management: [...TOOL_GROUPS.tables, ...TOOL_GROUPS.core],
  dm_chat: [...TOOL_GROUPS.messaging, ...TOOL_GROUPS.core],
  event_inquiry: [...TOOL_GROUPS.events, ...TOOL_GROUPS.core],
  strategic_guidance: [...TOOL_GROUPS.threads, ...TOOL_GROUPS.tables, ...TOOL_GROUPS.events, ...TOOL_GROUPS.core],
  profile_settings: [...TOOL_GROUPS.profile],
  invitation: [...TOOL_GROUPS.invites, ...TOOL_GROUPS.core],
  feedback: [...TOOL_GROUPS.feedback],
  general: Object.values(TOOL_GROUPS).flat(),
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
  const allowedNames = new Set(INTENT_TOOL_MAP[intent]);
  const filtered = assistantTools.filter(t => allowedNames.has(t.function.name));
  return filtered.length > 0 ? filtered : assistantTools;
}

export function buildMicroProfile(user: any, profile: any): string {
  const parts: string[] = [];

  parts.push(`Name: ${user?.name || "Unknown"}`);

  const roleParts = [user?.roleTitle, profile?.healthRole].filter(Boolean);
  if (roleParts.length > 0) parts.push(`Role: ${roleParts.join(" / ")}`);
  if (user?.organisation) parts.push(`Org: ${user.organisation}`);

  if (profile?.interests?.length) {
    const primary = profile.interests[0];
    if (profile.interests.length === 1) {
      parts.push(`Focus: ${primary}`);
    } else {
      parts.push(`Focus: ${primary} (+${profile.interests.length - 1} more — use get_my_profile for full list)`);
    }
  }

  if (profile?.regions?.length) {
    parts.push(`Region: ${profile.regions.slice(0, 2).join(", ")}${profile.regions.length > 2 ? ` (+${profile.regions.length - 2})` : ""}`);
  }

  if (profile?.currentGoal) {
    const goal = profile.currentGoal.length > 80 ? profile.currentGoal.slice(0, 77) + "..." : profile.currentGoal;
    parts.push(`Goal: ${goal}`);
  }

  parts.push(`Mode: ${profile?.collaborationMode || "OBSERVE"}`);

  return parts.join(" | ");
}

export function buildContextCounts(
  userTableCount: number,
  leadTableCount: number,
  upcomingEventCount: number,
  conversationCount: number
): string {
  const lines: string[] = [];
  lines.push(`Tables: member of ${userTableCount}${leadTableCount > 0 ? `, lead of ${leadTableCount}` : ""}`);
  lines.push(`Upcoming events (30 days): ${upcomingEventCount}`);
  lines.push(`Active conversations: ${conversationCount}`);
  return lines.join(" | ");
}

export function compressConversationHistory(
  history: { role: string; content: string }[],
  openai: any | null
): { recentMessages: { role: string; content: string }[]; summaryPrefix: string | null } {
  if (!history || history.length === 0) {
    return { recentMessages: [], summaryPrefix: null };
  }

  if (history.length <= 4) {
    return { recentMessages: history, summaryPrefix: null };
  }

  const recent = history.slice(-4);
  const older = history.slice(0, -4);

  const summaryLines: string[] = [];
  for (const msg of older) {
    const prefix = msg.role === "user" ? "User asked about" : "Assistant helped with";
    const trimmed = msg.content.slice(0, 60).replace(/\n/g, " ");
    summaryLines.push(`${prefix}: ${trimmed}${msg.content.length > 60 ? "..." : ""}`);
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

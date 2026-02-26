type Storage = typeof import("./storage");

export interface ToolContext {
  moderateContent: (text: string) => Promise<{ flagged: boolean; reason?: string }>;
  sendMemberInviteEmail?: (to: string, inviterName: string, token: string, note?: string | null) => Promise<void>;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

export const assistantTools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "join_table",
      description: "Join a collaboration table on behalf of the user. Use when the user asks to join a specific table.",
      parameters: {
        type: "object",
        properties: {
          tableId: { type: "string", description: "The ID of the table to join" },
        },
        required: ["tableId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "leave_table",
      description: "Leave a collaboration table. Use when the user asks to leave or exit a table.",
      parameters: {
        type: "object",
        properties: {
          tableId: { type: "string", description: "The ID of the table to leave" },
        },
        required: ["tableId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_thread",
      description: "Create a new discussion thread inside a table. Use when the user asks to start a discussion.",
      parameters: {
        type: "object",
        properties: {
          tableId: { type: "string", description: "The ID of the table to create the thread in" },
          title: { type: "string", description: "The title of the new thread" },
        },
        required: ["tableId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "post_in_thread",
      description: "Post a message in an existing discussion thread. Use when the user asks to post, reply, or contribute to a thread.",
      parameters: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "The ID of the thread to post in" },
          content: { type: "string", description: "The message content to post" },
        },
        required: ["threadId", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_direct_message",
      description: "Send a direct message to another TRYBE member. Use when the user asks to message someone.",
      parameters: {
        type: "object",
        properties: {
          recipientUserId: { type: "string", description: "The user ID of the recipient" },
          content: { type: "string", description: "The message content to send" },
        },
        required: ["recipientUserId", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "signal_milestone",
      description: "Signal interest in a calendar milestone event (attending, presenting, or watching). Use when the user wants to express interest in an event.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "The ID of the calendar event" },
          signalType: { type: "string", enum: ["ATTENDING", "PRESENTING", "WATCHING"], description: "The type of signal" },
        },
        required: ["eventId", "signalType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_new_table",
      description: "Submit a request to create a new collaboration table. Use when the user wants a table that doesn't exist yet.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The proposed table title" },
          purpose: { type: "string", description: "What this table is for" },
          tags: { type: "array", items: { type: "string" }, description: "Relevant topic tags" },
          reason: { type: "string", description: "Why this table should be created" },
        },
        required: ["title", "purpose"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_invite",
      description: "Send an invitation to a colleague's email address so they can join TRYBE. Use when the user asks to invite someone.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "The email address to send the invite to" },
          note: { type: "string", description: "A personal note to include with the invitation" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description: "Update the user's profile settings such as interests, regions, collaboration mode, or assistant activity level.",
      parameters: {
        type: "object",
        properties: {
          interests: { type: "array", items: { type: "string" }, description: "Health focus areas" },
          regions: { type: "array", items: { type: "string" }, description: "Geographic regions of focus" },
          collaborationMode: { type: "string", enum: ["OBSERVE", "CONTRIBUTE", "LEAD"], description: "Collaboration style" },
          assistantActivityLevel: { type: "string", enum: ["QUIET", "BALANCED", "ACTIVE"], description: "How active the assistant should be" },
          currentGoal: { type: "string", description: "Current professional goal" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_feedback",
      description: "Submit feedback about the platform on behalf of the user.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["BUG", "FEATURE", "GENERAL", "CONTENT"], description: "Feedback category" },
          message: { type: "string", description: "The feedback message" },
          rating: { type: "integer", description: "Rating from 1-5 (optional)" },
        },
        required: ["category", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tables",
      description: "Search for tables by topic, tag, or keyword. Use to help the user find relevant tables.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (topic, keyword, or tag)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_milestones",
      description: "Search for upcoming health milestones/events by topic or keyword.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (topic, keyword, or tag)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_members",
      description: "Search for TRYBE members by interest area, region, or role. Use to help the user find colleagues.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (interest, region, or role)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_table_details",
      description: "Get detailed information about a specific table including its purpose, members, and active threads.",
      parameters: {
        type: "object",
        properties: {
          tableId: { type: "string", description: "The ID of the table" },
        },
        required: ["tableId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_thread_summary",
      description: "Get the content of a specific thread including all posts for analysis or summarization.",
      parameters: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "The ID of the thread" },
        },
        required: ["threadId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_tables",
      description: "List all tables the user is currently a member of.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_conversations",
      description: "List the user's active direct message conversations.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

export async function executeTool(
  toolName: string,
  args: any,
  userId: string,
  storage: Storage,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (toolName) {

      case "join_table": {
        const table = await storage.getTableById(args.tableId);
        if (!table) return { success: false, message: "Table not found." };
        const isMember = await storage.isTableMember(args.tableId, userId);
        if (isMember) return { success: false, message: `You are already a member of "${table.title}".` };
        if (table.requiresApprovalToJoin) {
          await storage.createTableJoinRequest(args.tableId, userId);
          return { success: true, message: `Your request to join "${table.title}" has been submitted. A table admin will review it.` };
        }
        await storage.addTableMember(args.tableId, userId);
        return { success: true, message: `You have joined "${table.title}".`, data: { tableId: args.tableId, title: table.title } };
      }

      case "leave_table": {
        const table = await storage.getTableById(args.tableId);
        if (!table) return { success: false, message: "Table not found." };
        const isMember = await storage.isTableMember(args.tableId, userId);
        if (!isMember) return { success: false, message: `You are not a member of "${table.title}".` };
        await storage.removeTableMember(args.tableId, userId);
        return { success: true, message: `You have left "${table.title}".` };
      }

      case "create_thread": {
        const table = await storage.getTableById(args.tableId);
        if (!table) return { success: false, message: "Table not found." };
        const isMember = await storage.isTableMember(args.tableId, userId);
        if (!isMember) return { success: false, message: `You need to be a member of "${table.title}" to start a discussion.` };
        const thread = await storage.createThread({
          tableId: args.tableId,
          title: args.title,
          createdByUserId: userId,
        });
        return { success: true, message: `Discussion "${args.title}" has been created in "${table.title}".`, data: { threadId: thread.id, tableId: args.tableId } };
      }

      case "post_in_thread": {
        const thread = await storage.getThreadById(args.threadId);
        if (!thread) return { success: false, message: "Thread not found." };
        const isMember = await storage.isTableMember(thread.tableId, userId);
        if (!isMember) return { success: false, message: `You need to be a member of the table to post in this discussion.` };
        const postMod = await ctx.moderateContent(args.content);
        if (postMod.flagged) return { success: false, message: "That content was flagged by moderation and cannot be posted." };
        await storage.createPost({
          threadId: args.threadId,
          userId: userId,
          content: args.content,
        });
        return { success: true, message: `Your message has been posted in "${thread.title}".`, data: { threadId: args.threadId, tableId: thread.tableId } };
      }

      case "send_direct_message": {
        const recipient = await storage.getUserById(args.recipientUserId);
        if (!recipient) return { success: false, message: "Recipient not found." };
        const shareTable = await storage.doUsersShareTable(userId, args.recipientUserId);
        if (!shareTable) return { success: false, message: `You can only message members who share a table with you. You and ${recipient.name} do not currently share a table.` };
        const dmMod = await ctx.moderateContent(args.content);
        if (dmMod.flagged) return { success: false, message: "That message was flagged by moderation and cannot be sent." };
        let conversations = await storage.getDmConversationsForUser(userId);
        let conv = conversations.find((c: any) =>
          (c.conversation.userAId === userId && c.conversation.userBId === args.recipientUserId) ||
          (c.conversation.userBId === userId && c.conversation.userAId === args.recipientUserId)
        );
        let conversationId: string;
        if (conv) {
          conversationId = conv.conversation.id;
        } else {
          const newConv = await storage.createDmConversation(userId, args.recipientUserId);
          conversationId = newConv.id;
        }
        await storage.createDmMessage({
          conversationId,
          senderId: userId,
          content: args.content,
        });
        return { success: true, message: `Message sent to ${recipient.name}.`, data: { conversationId } };
      }

      case "signal_milestone": {
        const events = await storage.getAllCalendarEvents();
        const event = events.find(e => e.id === args.eventId);
        if (!event) return { success: false, message: "Event not found." };
        await storage.upsertSignal(userId, args.eventId, args.signalType);
        return { success: true, message: `You've signalled "${args.signalType.toLowerCase()}" for "${event.title}".` };
      }

      case "request_new_table": {
        await storage.createTableRequest({
          title: args.title,
          purpose: args.purpose,
          tags: args.tags || [],
          reason: args.reason || "",
          requestedByUserId: userId,
        });
        return { success: true, message: `Your request to create the table "${args.title}" has been submitted for admin review.` };
      }

      case "send_invite": {
        const inviteUser = await storage.getUserById(userId);
        if (!inviteUser) return { success: false, message: "User not found." };
        if (!inviteUser.canInvite) return { success: false, message: "Your invite privileges are currently disabled." };
        const quota = await storage.getUserInviteQuota(userId);
        if (quota.used >= quota.limit) return { success: false, message: `You've used all ${quota.limit} invites for this month. Your quota resets next month.` };
        const existingUser = await storage.getUserByEmail(args.email);
        if (existingUser) return { success: false, message: `A member with that email address already exists on TRYBE.` };
        const crypto = await import("crypto");
        const token = crypto.randomBytes(24).toString("hex");
        const expiresAt = new Date(Date.now() + 14 * 86400000);
        await storage.createInvite({
          token,
          email: args.email,
          inviteType: "MEMBER_INVITE",
          autoApproveOnUse: true,
          requiresManualApproval: false,
          maxUses: 1,
          recipientNote: args.note || null,
          expiresAt,
          createdByUserId: userId,
        });
        await storage.incrementInviteQuotaUsed(userId);
        if (ctx.sendMemberInviteEmail) {
          try {
            await ctx.sendMemberInviteEmail(args.email, inviteUser.name, token, args.note || null);
          } catch (emailErr: any) {
            console.error("[AssistantTool:send_invite] Email dispatch failed:", emailErr?.message);
          }
        }
        return { success: true, message: `Invitation sent to ${args.email}. They'll receive an email with instructions to join TRYBE.` };
      }

      case "update_profile": {
        const profile = await storage.getUserProfile(userId);
        const updates: any = {};
        if (args.interests) updates.interests = args.interests;
        if (args.regions) updates.regions = args.regions;
        if (args.collaborationMode) updates.collaborationMode = args.collaborationMode;
        if (args.assistantActivityLevel) updates.assistantActivityLevel = args.assistantActivityLevel;
        if (args.currentGoal) updates.currentGoal = args.currentGoal;
        if (Object.keys(updates).length === 0) return { success: false, message: "No profile changes specified." };
        await storage.upsertUserProfile(userId, { ...updates });
        const changedFields = Object.keys(updates).join(", ");
        return { success: true, message: `Your profile has been updated (${changedFields}).` };
      }

      case "submit_feedback": {
        await storage.createFeedback({
          userId,
          category: args.category,
          message: args.message,
          rating: args.rating || null,
          contextType: "ASSISTANT",
        });
        return { success: true, message: "Your feedback has been submitted. The TRYBE team will review it." };
      }

      case "search_tables": {
        const allTables = await storage.getAllTables();
        const q = args.query.toLowerCase();
        const matches = allTables.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.purpose.toLowerCase().includes(q) ||
          (t.tags || []).some((tag: string) => tag.toLowerCase().includes(q))
        ).slice(0, 8);
        if (matches.length === 0) return { success: true, message: "No tables found matching that query.", data: { tables: [] } };
        const userTables = await storage.getTablesForUser(userId);
        const userTableIds = new Set(userTables.map(t => t.id));
        const results = matches.map(t => ({
          id: t.id,
          title: t.title,
          purpose: t.purpose,
          tags: t.tags,
          isMember: userTableIds.has(t.id),
        }));
        return { success: true, message: `Found ${results.length} table(s) matching "${args.query}".`, data: { tables: results } };
      }

      case "search_milestones": {
        const allEvents = await storage.getAllCalendarEvents();
        const q = args.query.toLowerCase();
        const today = new Date().toISOString().slice(0, 10);
        const matches = allEvents.filter(e =>
          e.startDate >= today && (
            e.title.toLowerCase().includes(q) ||
            (e.organiser || "").toLowerCase().includes(q) ||
            (e.tags || []).some((tag: string) => tag.toLowerCase().includes(q))
          )
        ).slice(0, 8);
        if (matches.length === 0) return { success: true, message: "No upcoming milestones found matching that query.", data: { events: [] } };
        const results = matches.map(e => ({
          id: e.id,
          title: e.title,
          startDate: e.startDate,
          endDate: e.endDate,
          organiser: e.organiser,
          tags: e.tags,
        }));
        return { success: true, message: `Found ${results.length} upcoming milestone(s) matching "${args.query}".`, data: { events: results } };
      }

      case "search_members": {
        const allUsers = await storage.getAllUsers();
        const q = args.query.toLowerCase();
        const activeUsers = allUsers.filter(u => u.status === "ACTIVE" && u.id !== userId);
        const results: any[] = [];
        for (const u of activeUsers) {
          const profile = await storage.getUserProfile(u.id);
          const matchesRole = (u.roleTitle || "").toLowerCase().includes(q) || (profile?.healthRole || "").toLowerCase().includes(q);
          const matchesInterests = (profile?.interests || []).some((i: string) => i.toLowerCase().includes(q));
          const matchesRegions = (profile?.regions || []).some((r: string) => r.toLowerCase().includes(q));
          const matchesOrg = (u.organisation || "").toLowerCase().includes(q);
          const matchesName = u.name.toLowerCase().includes(q);
          if (matchesRole || matchesInterests || matchesRegions || matchesOrg || matchesName) {
            results.push({
              id: u.id,
              name: u.name,
              organisation: u.organisation,
              roleTitle: u.roleTitle,
              interests: profile?.interests || [],
              regions: profile?.regions || [],
            });
          }
          if (results.length >= 8) break;
        }
        if (results.length === 0) return { success: true, message: "No members found matching that query.", data: { members: [] } };
        return { success: true, message: `Found ${results.length} member(s) matching "${args.query}".`, data: { members: results } };
      }

      case "get_table_details": {
        const table = await storage.getTableById(args.tableId);
        if (!table) return { success: false, message: "Table not found." };
        const members = await storage.getTableMembers(args.tableId);
        const threads = await storage.getThreadsByTable(args.tableId);
        const isMember = await storage.isTableMember(args.tableId, userId);
        return {
          success: true,
          message: `Details for "${table.title}".`,
          data: {
            id: table.id,
            title: table.title,
            purpose: table.purpose,
            tags: table.tags,
            memberCount: members.length,
            members: members.slice(0, 10).map((m: any) => ({ name: m.user?.name || "Member", role: m.member.memberRole })),
            threads: threads.map(t => ({ id: t.id, title: t.title, status: t.status })),
            isMember,
          },
        };
      }

      case "get_thread_summary": {
        const thread = await storage.getThreadById(args.threadId);
        if (!thread) return { success: false, message: "Thread not found." };
        const posts = await storage.getPostsByThread(args.threadId);
        const table = await storage.getTableById(thread.tableId);
        return {
          success: true,
          message: `Thread "${thread.title}" in "${table?.title || "Unknown table"}".`,
          data: {
            id: thread.id,
            title: thread.title,
            tableTitle: table?.title,
            postCount: posts.length,
            posts: posts.slice(-30).map(p => ({
              author: p.user?.name || "Member",
              content: p.post.content,
              createdAt: p.post.createdAt,
            })),
          },
        };
      }

      case "list_my_tables": {
        const tables = await storage.getTablesForUser(userId);
        if (tables.length === 0) return { success: true, message: "You are not a member of any tables yet.", data: { tables: [] } };
        return {
          success: true,
          message: `You are a member of ${tables.length} table(s).`,
          data: {
            tables: tables.map(t => ({ id: t.id, title: t.title, purpose: t.purpose, tags: t.tags })),
          },
        };
      }

      case "list_my_conversations": {
        const conversations = await storage.getDmConversationsForUser(userId);
        if (conversations.length === 0) return { success: true, message: "You have no active conversations.", data: { conversations: [] } };
        return {
          success: true,
          message: `You have ${conversations.length} conversation(s).`,
          data: {
            conversations: conversations.slice(0, 10).map((c: any) => ({
              id: c.conversation.id,
              otherUser: c.otherUser?.name || "Member",
              otherUserId: c.otherUser?.id,
            })),
          },
        };
      }

      default:
        return { success: false, message: `Unknown action: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`[AssistantTool:${toolName}]`, err?.message);
    return { success: false, message: `Something went wrong while performing that action. Please try again.` };
  }
}

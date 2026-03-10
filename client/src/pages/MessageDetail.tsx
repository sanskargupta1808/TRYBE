import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useSignaling } from "@/hooks/useSignaling";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  ArrowLeft, Send, Loader2, Paperclip, Mic, MicOff, X, Reply,
  Eye, EyeOff, Phone, PhoneOff, PhoneCall, CornerUpLeft, Square, SmilePlus
} from "lucide-react";

const REACTIONS = [
  { label: "Agree", value: "agree" },
  { label: "Thanks", value: "thanks" },
  { label: "Noted", value: "noted" },
  { label: "Helpful", value: "helpful" },
  { label: "Important", value: "important" },
  { label: "Insightful", value: "insightful" },
];
const STUN_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function isOnlyEmoji(text: string) {
  const emojiRe = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\s)+$/u;
  return emojiRe.test(text.trim()) && text.trim().length > 0 && text.trim().length <= 8;
}

type CallState = "idle" | "calling" | "ringing" | "active" | "ended";

export default function MessageDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Compose state
  const [content, setContent] = useState("");
  const [isOneTime, setIsOneTime] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [revealedOnce, setRevealedOnce] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  // Voice recording
  const { isRecording, duration, blob: voiceBlob, startRecording, stopRecording, cancelRecording, clearBlob } = useVoiceRecorder();

  // WebRTC call state
  const [callState, setCallState] = useState<CallState>("idle");
  const [incomingCall, setIncomingCall] = useState<{ from: string; offer: RTCSessionDescriptionInit } | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/messages", id],
    queryFn: async () => {
      const res = await fetch(`/api/messages/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const other = data?.otherUser;
  const otherId = data?.userAId === user?.id ? data?.userBId : data?.userAId;

  const scrollToBottom = useCallback((instant?: boolean) => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
    });
  }, []);

  useEffect(() => {
    const count = data?.messages?.length ?? 0;
    if (count === 0) return;
    if (isInitialLoadRef.current) {
      scrollToBottom(true);
      isInitialLoadRef.current = false;
    } else if (count > prevMessageCountRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 150
        : true;
      if (isNearBottom) {
        scrollToBottom();
      }
    }
    prevMessageCountRef.current = count;
  }, [data?.messages?.length, scrollToBottom]);

  // ── WebRTC Signaling ────────────────────────────────────────────────────────
  const handleSignal = useCallback(async (msg: any) => {
    if (msg.type === "call-offer") {
      setIncomingCall({ from: msg.from, offer: msg.offer });
    } else if (msg.type === "call-answer" && peerRef.current) {
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
      setCallState("active");
    } else if (msg.type === "call-ice" && peerRef.current) {
      try { await peerRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
    } else if (msg.type === "call-reject") {
      endCall();
      toast({ title: "Call declined" });
    } else if (msg.type === "call-end") {
      endCall();
    }
  }, []);

  const { send: wsSend } = useSignaling(user?.id, handleSignal);

  const setupPeer = useCallback(async () => {
    const peer = new RTCPeerConnection(STUN_SERVERS);
    peerRef.current = peer;
    peer.onicecandidate = (e) => {
      if (e.candidate) wsSend({ type: "call-ice", to: otherId, candidate: e.candidate });
    };
    peer.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    stream.getTracks().forEach(t => peer.addTrack(t, stream));
    return peer;
  }, [otherId, wsSend]);

  const startCall = async () => {
    if (!otherId) return;
    try {
      setCallState("calling");
      const peer = await setupPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      wsSend({ type: "call-offer", to: otherId, offer });
    } catch {
      toast({ title: "Could not access microphone" });
      setCallState("idle");
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      setCallState("active");
      const peer = await setupPeer();
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      wsSend({ type: "call-answer", to: incomingCall.from, answer });
      setIncomingCall(null);
    } catch {
      toast({ title: "Could not start call" });
      setCallState("idle");
    }
  };

  const endCall = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setCallState("idle");
    setIncomingCall(null);
  }, []);

  const rejectCall = () => {
    wsSend({ type: "call-reject", to: incomingCall?.from });
    setIncomingCall(null);
  };

  const hangUp = () => {
    wsSend({ type: "call-end", to: otherId });
    endCall();
  };

  // ── Send Message ────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await apiRequest("POST", `/api/messages/${id}/send`, payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/messages", id] });
      setContent("");
      setIsOneTime(false);
      setReplyTo(null);
      setTimeout(() => scrollToBottom(), 100);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const type = isOnlyEmoji(trimmed) ? "EMOJI" : "TEXT";
    sendMutation.mutate({ content: trimmed, messageType: type, isOneTime, replyToId: replyTo?.message?.id });
  };

  // ── File Upload ─────────────────────────────────────────────────────────────
  const uploadFile = async (file: File): Promise<{ url: string; fileName: string; mimeType: string } | null> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadFile(file);
    setUploading(false);
    if (!result) return;
    const type = file.type.startsWith("image/") ? "IMAGE"
      : file.type.startsWith("video/") ? "VIDEO"
      : file.type.startsWith("audio/") ? "AUDIO"
      : "FILE";
    sendMutation.mutate({
      content: "",
      messageType: type,
      fileUrl: result.url,
      fileName: result.fileName,
      fileMimeType: result.mimeType,
      isOneTime,
      replyToId: replyTo?.message?.id,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Voice Message ───────────────────────────────────────────────────────────
  const sendVoice = async () => {
    if (!voiceBlob) return;
    setUploading(true);
    const file = new File([voiceBlob], `voice-${Date.now()}.webm`, { type: voiceBlob.type });
    const result = await uploadFile(file);
    setUploading(false);
    clearBlob();
    if (!result) return;
    sendMutation.mutate({
      content: "",
      messageType: "VOICE",
      fileUrl: result.url,
      fileName: "Voice message",
      fileMimeType: result.mimeType,
      replyToId: replyTo?.message?.id,
    });
  };

  // ── Emoji Reaction ──────────────────────────────────────────────────────────
  const reactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const res = await apiRequest("POST", `/api/messages/${id}/reactions`, { messageId, emoji });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/messages", id] }),
  });

  // ── View Once ───────────────────────────────────────────────────────────────
  const viewOnceMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const res = await apiRequest("POST", `/api/messages/${id}/view-once/${msgId}`, {});
      return res.json();
    },
    onSuccess: (_, msgId) => {
      setRevealedOnce(prev => new Set([...prev, msgId]));
      qc.invalidateQueries({ queryKey: ["/api/messages", id] });
    },
  });

  const handleReveal = (msgId: string) => {
    if (!revealedOnce.has(msgId)) viewOnceMutation.mutate(msgId);
  };

  // ── Emoji Picker (compose) ──────────────────────────────────────────────────
  const handleEmojiClick = (data: EmojiClickData) => {
    setContent(prev => prev + data.emoji);
    setShowEmojiPicker(false);
  };

  if (isLoading) return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-64 rounded-md" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto" style={{ height: "calc(100vh - 60px)" }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*"
        onChange={handleFileSelect}
        data-testid="input-file-upload"
      />
      {/* Remote audio element for calls */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-background animate-fade-in">
        <div className="flex items-center gap-3">
          <Link href="/app/messages" className="text-muted-foreground hover-elevate">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {other && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-sm font-medium">{other.name?.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground"><Link href={`/app/users/${other.id}`} className="hover:text-primary hover:underline transition-colors" data-testid="link-message-user-profile">{other.name}</Link> {other.handle && <span className="text-xs text-muted-foreground font-normal">@{other.handle}</span>}</p>
                {other.organisation && <p className="text-xs text-muted-foreground">{other.organisation}</p>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {callState === "idle" && (
            <Button size="icon" variant="ghost" onClick={startCall} data-testid="button-start-call" title="Voice call">
              <Phone className="h-4 w-4" />
            </Button>
          )}
          {callState === "calling" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground animate-pulse">Calling...</span>
              <Button size="icon" variant="destructive" onClick={hangUp} data-testid="button-cancel-call">
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          )}
          {callState === "active" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 font-medium">Call active</span>
              <Button size="icon" variant="destructive" onClick={hangUp} data-testid="button-end-call">
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Incoming call overlay ── */}
      {incomingCall && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-background rounded-xl p-6 text-center shadow-xl border border-border max-w-xs w-full mx-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <PhoneCall className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-semibold text-foreground mb-1">Incoming voice call</p>
            <p className="text-sm text-muted-foreground mb-4">{other?.name || "A TRYBE member"}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="destructive" onClick={rejectCall} data-testid="button-reject-call">
                <PhoneOff className="h-4 w-4 mr-1" />Decline
              </Button>
              <Button onClick={acceptCall} className="bg-green-600 hover:bg-green-700" data-testid="button-accept-call">
                <Phone className="h-4 w-4 mr-1" />Accept
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {(!data?.messages || data.messages.length === 0) ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground text-sm">No messages yet. Start the conversation.</p>
            </div>
          </div>
        ) : (
          (data.messages || []).map((m: any) => {
            const isMe = m.sender?.id === user?.id;
            const msg = m.message;
            const sender = m.sender;
            const reactions = m.reactions || [];
            const replyToMsg = m.replyTo;

            // Group reactions by emoji
            const grouped = reactions.reduce((acc: any, r: any) => {
              const emoji = r.reaction?.emoji;
              if (!emoji) return acc;
              if (!acc[emoji]) acc[emoji] = { count: 0, mine: false };
              acc[emoji].count++;
              if (r.reaction?.userId === user?.id) acc[emoji].mine = true;
              return acc;
            }, {});

            // One-time message: show blurred if not revealed yet
            const isOneTimeMsg = msg.isOneTime;
            const isViewed = msg.viewedOnce;
            const isRevealed = revealedOnce.has(msg.id) || (isMe && isOneTimeMsg);
            const shouldBlur = isOneTimeMsg && !isRevealed && !isMe;

            return (
              <div key={msg.id} className={`group flex flex-col ${isMe ? "items-end" : "items-start"} mb-2`} data-testid={`message-${msg.id}`}>
                {/* Reply-to quote */}
                {replyToMsg && (
                  <div className={`text-xs border-l-2 border-primary/40 pl-2 mb-1 text-muted-foreground max-w-[70%] truncate ${isMe ? "text-right" : ""}`}>
                    <span className="font-medium">{replyToMsg.sender?.name}</span>: {replyToMsg.message?.content || "Attachment"}
                  </div>
                )}

                <div className="flex items-end gap-1.5">
                  {!isMe && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mb-1">
                      <span className="text-primary text-xs">{sender?.name?.charAt(0)}</span>
                    </div>
                  )}

                  <div className="relative max-w-[75%]">
                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-card-border text-foreground rounded-bl-sm"
                      } ${msg.messageType === "EMOJI" ? "bg-transparent border-0 px-1 py-0 shadow-none" : ""}`}
                    >
                      {/* TEXT */}
                      {(msg.messageType === "TEXT" || !msg.messageType) && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      )}

                      {/* EMOJI */}
                      {msg.messageType === "EMOJI" && (
                        <p className="text-4xl leading-none">{msg.content}</p>
                      )}

                      {/* IMAGE */}
                      {msg.messageType === "IMAGE" && msg.fileUrl && (
                        <div className={shouldBlur ? "blur-lg select-none cursor-pointer" : ""} onClick={() => shouldBlur && handleReveal(msg.id)}>
                          <img
                            src={msg.fileUrl}
                            alt={msg.fileName || "Image"}
                            className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer"
                            onClick={() => !shouldBlur && window.open(msg.fileUrl, "_blank")}
                            data-testid={`img-message-${msg.id}`}
                          />
                        </div>
                      )}

                      {/* VIDEO */}
                      {msg.messageType === "VIDEO" && msg.fileUrl && (
                        <div className={shouldBlur ? "blur-lg cursor-pointer" : ""} onClick={() => shouldBlur && handleReveal(msg.id)}>
                          <video src={msg.fileUrl} controls className="rounded-lg max-w-full max-h-48" data-testid={`video-message-${msg.id}`} />
                        </div>
                      )}

                      {/* AUDIO */}
                      {msg.messageType === "AUDIO" && msg.fileUrl && (
                        <div className={shouldBlur ? "blur-lg cursor-pointer" : ""} onClick={() => shouldBlur && handleReveal(msg.id)}>
                          <audio src={msg.fileUrl} controls className="max-w-full" data-testid={`audio-message-${msg.id}`} />
                        </div>
                      )}

                      {/* VOICE message */}
                      {msg.messageType === "VOICE" && msg.fileUrl && (
                        <div className={`flex items-center gap-2 ${shouldBlur ? "blur-lg cursor-pointer" : ""}`} onClick={() => shouldBlur && handleReveal(msg.id)}>
                          <Mic className="h-4 w-4 flex-shrink-0" />
                          <audio src={msg.fileUrl} controls className="max-w-[200px] h-8" data-testid={`voice-message-${msg.id}`} />
                        </div>
                      )}

                      {/* FILE */}
                      {msg.messageType === "FILE" && msg.fileUrl && (
                        <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline" data-testid={`file-message-${msg.id}`}>
                          <Paperclip className="h-3 w-3" />
                          {msg.fileName || "Download file"}
                        </a>
                      )}

                      {/* One-time overlay */}
                      {isOneTimeMsg && shouldBlur && (
                        <div
                          className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-xl"
                          onClick={() => handleReveal(msg.id)}
                          data-testid={`button-reveal-${msg.id}`}
                        >
                          <div className="flex items-center gap-1.5 bg-black/50 text-white rounded-md px-2 py-1 text-xs">
                            <Eye className="h-3 w-3" />View once
                          </div>
                        </div>
                      )}
                      {isOneTimeMsg && isViewed && !isMe && (
                        <div className="flex items-center gap-1 mt-1">
                          <EyeOff className="h-3 w-3 opacity-50" />
                          <span className="text-xs opacity-50">Opened</span>
                        </div>
                      )}

                      {/* Timestamp */}
                      {msg.messageType !== "EMOJI" && (
                        <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {isOneTimeMsg && isMe && <span className="ml-1">· View once</span>}
                        </p>
                      )}
                    </div>

                    {/* Hover actions */}
                    <div className={`absolute ${isMe ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"} top-1 hidden group-hover:flex items-center gap-1`}>
                      <button
                        onClick={() => setReplyTo(m)}
                        className="p-1 rounded-md bg-muted text-muted-foreground hover-elevate"
                        title="Reply"
                        data-testid={`button-reply-${msg.id}`}
                      >
                        <CornerUpLeft className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                        className="p-1 rounded-md bg-muted text-muted-foreground hover-elevate"
                        title="React"
                        data-testid={`button-react-${msg.id}`}
                      >
                        <SmilePlus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Quick reaction picker */}
                    {showReactionPicker === msg.id && (
                      <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-10 flex gap-1 bg-background border border-border rounded-md px-1.5 py-1 shadow-md z-10`}>
                        {REACTIONS.map(r => (
                          <button
                            key={r.value}
                            onClick={() => { reactionMutation.mutate({ messageId: msg.id, emoji: r.value }); setShowReactionPicker(null); }}
                            className="text-xs px-2 py-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            data-testid={`button-react-option-${msg.id}-${r.value}`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reactions display */}
                {Object.keys(grouped).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-0.5 px-8 ${isMe ? "justify-end" : "justify-start"}`}>
                    {Object.entries(grouped).map(([emoji, data]: any) => (
                      <button
                        key={emoji}
                        onClick={() => reactionMutation.mutate({ messageId: msg.id, emoji })}
                        className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${data.mine ? "bg-primary/10 border-primary/30" : "bg-muted border-border"} hover-elevate`}
                        data-testid={`reaction-${msg.id}-${emoji}`}
                      >
                        <span>{emoji}</span>
                        {data.count > 1 && <span className="text-muted-foreground">{data.count}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Voice recording pending send ── */}
      {voiceBlob && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-3 flex-shrink-0">
          <Mic className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground flex-1">Voice message recorded ({formatDuration(duration)})</span>
          <Button size="sm" variant="ghost" onClick={clearBlob} data-testid="button-discard-voice"><X className="h-3 w-3" /></Button>
          <Button size="sm" onClick={sendVoice} disabled={sendMutation.isPending || uploading} data-testid="button-send-voice">
            {uploading || sendMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3 mr-1" />Send</>}
          </Button>
        </div>
      )}

      {/* ── Reply bar ── */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-2 flex-shrink-0">
          <Reply className="h-3 w-3 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-primary">{replyTo.sender?.name}</span>
            <span className="text-xs text-muted-foreground ml-2 truncate">{replyTo.message?.content || "Attachment"}</span>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover-elevate" data-testid="button-cancel-reply">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Compose ── */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-background">
        {/* Emoji picker popup */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 z-20 shadow-xl">
            <EmojiPicker onEmojiClick={handleEmojiClick} height={350} width={300} />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 mb-2">
          <button
            onClick={() => setShowEmojiPicker(v => !v)}
            className={`p-1.5 rounded-md text-muted-foreground hover-elevate ${showEmojiPicker ? "bg-muted" : ""}`}
            title="Emoji"
            data-testid="button-emoji-picker"
          >
            <SmilePlus className="h-4 w-4" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md text-muted-foreground hover-elevate"
            title="Attach image, video or audio"
            disabled={uploading}
            data-testid="button-attach-file"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>

          {!voiceBlob && (
            <button
              onMouseDown={async () => { const ok = await startRecording(); if (!ok) toast({ title: "Microphone unavailable", variant: "destructive" }); }}
              onMouseUp={stopRecording}
              onTouchStart={async () => { const ok = await startRecording(); if (!ok) toast({ title: "Microphone unavailable", variant: "destructive" }); }}
              onTouchEnd={stopRecording}
              className={`p-1.5 rounded-md hover-elevate transition-colors ${isRecording ? "bg-red-500/10 text-red-500" : "text-muted-foreground"}`}
              title={isRecording ? `Recording… ${formatDuration(duration)}` : "Hold to record voice message"}
              data-testid="button-voice-record"
            >
              {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}

          {isRecording && (
            <button onClick={cancelRecording} className="p-1.5 rounded-md text-muted-foreground hover-elevate" data-testid="button-cancel-recording">
              <X className="h-4 w-4" />
            </button>
          )}

          <label className="flex items-center gap-1.5 ml-auto cursor-pointer select-none" title="One-time message — disappears after viewing">
            <input
              type="checkbox"
              checked={isOneTime}
              onChange={e => setIsOneTime(e.target.checked)}
              className="rounded"
              data-testid="toggle-one-time"
            />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />View once
            </span>
          </label>
        </div>

        {/* Moderation notice */}
        <p className="text-xs text-muted-foreground mb-2">Subject to the Code of Conduct and safety moderation.</p>

        {/* Input row */}
        <div className="flex gap-2">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && content.trim()) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a message…"
            rows={2}
            className="resize-none text-sm flex-1"
            data-testid="input-message"
            onClick={() => setShowEmojiPicker(false)}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!content.trim() || sendMutation.isPending}
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

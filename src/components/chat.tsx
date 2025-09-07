import { useEffect, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string;
};

type Message = {
  id: string;
  sender_id: string;
  recipient_id?: string; // only for direct messages
  team_id?: string; // only for team messages
  related_team_id?: string;
  message: string;
  created_at: string;
  profiles?: Profile; // sender profile
};

interface ChatProps {
  supabase: SupabaseClient;
  currentUserId: string;
  mode: "team" | "direct";
  teamId?: string; // required if mode = team
  recipientId?: string; // required if mode = direct
}

export default function Chat({
  supabase,
  currentUserId,
  mode,
  teamId,
  recipientId,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  // Fetch initial messages
  useEffect(() => {
    async function loadMessages() {
    let query

    if (mode === "team") {
      query = supabase
        .from("team_messages")
        .select(`
          id,
          sender_id,
          team_id,
          message,
          created_at,
          sender:profiles!team_messages_sender_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("team_id", teamId)
        .order("created_at", { ascending: true })
    } else {
      query = supabase
        .from("direct_messages")
        .select(`
          id,
          sender_id,
          recipient_id,
          related_team_id,
          message,
          created_at,
          sender:profiles!direct_messages_sender_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true })
    }

    const { data, error } = await query
    if (error) {
      console.error("Error loading messages:", error.message)
      return
    }

    // Normalize: rename sender -> profiles to keep rest of code same
    const normalized = (data as any[]).map((msg) => ({
      ...msg,
      profiles: msg.sender || null,
    }))

    setMessages(normalized as Message[])
  }
    loadMessages();
  }, [mode, teamId, recipientId, currentUserId, supabase]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: mode === "team" ? "team_messages" : "direct_messages",
        },
        async (payload) => {
          const newMsg = payload.new as Message;

          // fetch profile for new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", newMsg.sender_id)
            .single();

          newMsg.profiles = profile || undefined;

          if (mode === "team" && newMsg.team_id === teamId) {
            setMessages((prev) => [...prev, newMsg]);
          }
          if (
            mode === "direct" &&
            ((newMsg.sender_id === currentUserId &&
              newMsg.recipient_id === recipientId) ||
              (newMsg.sender_id === recipientId &&
                newMsg.recipient_id === currentUserId))
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, teamId, recipientId, currentUserId, supabase]);

  // Send message
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    if (mode === "team" && teamId) {
      await supabase.from("team_messages").insert([
        { team_id: teamId, sender_id: currentUserId, message: input },
      ]);
    }
    if (mode === "direct" && recipientId) {
      await supabase.from("direct_messages").insert([
        {
          sender_id: currentUserId,
          recipient_id: recipientId,
          related_team_id: teamId ?? null,
          message: input,
        },
      ]);
    }
    setInput("");
  }

  return (
    <div className="flex flex-col h-full border rounded-2xl shadow p-4">
      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          const avatar =
            msg.profiles?.avatar_url || "/default-avatar.png"; // fallback
          const name = msg.profiles?.full_name || "Unknown";
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${
                isMine ? "justify-end" : "justify-start"
              }`}
            >
              {!isMine && (
                <img
                  src={avatar}
                  alt={name}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/default-avatar.png";
                  }}
                />
              )}
              <div
                className={`px-3 py-2 rounded-2xl max-w-[70%] ${
                  isMine
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {!isMine && (
                  <p className="text-xs font-semibold mb-1">{name}</p>
                )}
                <p className="text-sm">{msg.message}</p>
                <span className="text-[10px] opacity-70 block mt-1">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {isMine && (
                <img
                  src={avatar}
                  alt={name}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/default-avatar.png";
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <form onSubmit={sendMessage} className="mt-3 flex">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border rounded-l-2xl px-3 py-2 focus:outline-none"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 rounded-r-2xl"
        >
          Send
        </button>
      </form>
    </div>
  );
}

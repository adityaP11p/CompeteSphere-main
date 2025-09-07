import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

// interface Team {
//   id: string;
//   name: string;
// }

interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  created_at: string;
  profiles: Profile;
}

// interface TeamMessage {
//   id: string;
//   team_id: string;
//   message: string;
//   created_at: string;
//   teams: Team;
// }

interface TeamNotification {
  id: string;          // message id
  team_id: string;
  team_name: string;
  competition_title: string;
  created_at: string;
}

export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [directChats, setDirectChats] = useState<DirectMessage[]>([]);
  const [teamChats, setTeamChats] = useState<TeamMessage[]>([]);
  const [teamNotifications, setTeamNotifications] = useState<TeamNotification[]>([]);

  useEffect(() => {
    if (!user) return;

    const directSub = supabase
    .channel("direct-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "direct_messages" },
      (payload) => {
        setDirectChats((prev) => [payload.new as DirectMessage, ...prev]);
      }
    )
    .subscribe();

    const teamSub = supabase
    .channel("team-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "team_messages" },
      async (payload) => {
        const msg = payload.new as { id: string; team_id: string; created_at: string };

        // fetch team + competition info for context
        const { data, error } = await supabase
          .from("teams")
          .select(`
            id,
            name,
            competition:competition_id(title)
          `)
          .eq("id", msg.team_id)
          .single();

        if (!error && data) {
          setTeamNotifications((prev) => [
            {
              id: msg.id,
              team_id: data.id,
              team_name: data.name,
              competition_title: data.competition?.[0]?.title ?? "Unknown competition",
              created_at: msg.created_at,
            },
            ...prev,
          ]);
        }
      }
    )
    .subscribe();

    const fetchMessages = async () => {
      try {
        // Fetch latest direct messages
        const { data: directData, error: directError } = await supabase
          .from("direct_messages")
          .select(
            `
            id,
            sender_id,
            recipient_id,
            message,
            created_at,
            profiles:sender_id (id, full_name, avatar_url)
          `
          )
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(20);

        if (directError) throw directError;
        setDirectChats(directData || []);

        
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };
    fetchMessages();
    return () => {
        supabase.removeChannel(directSub);
        supabase.removeChannel(teamSub);
    };
    
  }, [user]);

  return (
    <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Messages</h1>

        {/* Direct Messages */}
        <h2 className="text-lg font-semibold mb-2">Direct Messages</h2>
        {directChats.length === 0 ? (
            <p className="text-gray-500">No direct messages yet.</p>
        ) : (
            <ul className="space-y-2 mb-6">
            {directChats.map((msg) => (
                <li
                key={msg.id}
                className="p-3 bg-white rounded-lg shadow cursor-pointer hover:bg-gray-50"
                onClick={() =>
                    navigate(
                    `/chat/${
                        msg.sender_id === user?.id ? msg.recipient_id : msg.sender_id
                    }`
                    )
                }
                >
                <p className="font-medium">
                    {msg.profiles?.full_name || "Unknown User"}
                </p>
                <p className="text-sm text-gray-600 truncate">{msg.message}</p>
                <p className="text-xs text-gray-400">
                    {new Date(msg.created_at).toLocaleString()}
                </p>
                </li>
            ))}
            </ul>
        )}

        {/* Team Notifications */}
        <h2 className="text-lg font-semibold mb-2">Team Chats</h2>
        {teamNotifications.length === 0 ? (
        <p className="text-gray-500">No team messages yet.</p>
        ) : (
        <ul className="space-y-2 mb-6">
            {teamNotifications.map((notif) => (
            <li
                key={notif.id}
                className="p-3 bg-white rounded-lg shadow cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/team-chat/${notif.team_id}`)}
            >
                <p className="font-medium">
                Message in <span className="text-blue-600">{notif.team_name}</span>
                </p>
                <p className="text-sm text-gray-600">
                Competition: {notif.competition_title}
                </p>
                <p className="text-xs text-gray-400">
                {new Date(notif.created_at).toLocaleString()}
                </p>
            </li>
            ))}
        </ul>
        )}

    </div>
  );
};

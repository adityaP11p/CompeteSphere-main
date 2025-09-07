// import { useState, useEffect } from "react";
// import { supabase } from "../lib/supabase";
// import Chat from "../components/chat";

// interface Team {
//   id: string;
//   name: string;
//   owner_id: string;
// }

// export default function TeamChatPage() {
//   const [currentUserId, setCurrentUserId] = useState<string | null>(null);
//   const [teamId, setTeamId] = useState<string | null>(null);

//   useEffect(() => {
//     // Fetch the currently logged-in user
//     const fetchUser = async () => {
//       const { data: { user }, error } = await supabase.auth.getUser();

//       if (error) {
//         console.error("Error fetching user:", error.message);
//         return;
//       }

//       setCurrentUserId(user?.id ?? null);
//     };

//     // Fetch team info (hardcoded or dynamically fetched)
//     const fetchTeam = async () => {
//       const { data, error } = await supabase
//         .from("Teams")
//         .select("id, name, owner_id")
//         .eq("id", "your-team-id-here") // Replace with actual teamId
//         .single();

//       if (error) {
//         console.error("Error fetching team:", error.message);
//         return;
//       }

//       setTeamId(data.id);
//     };

//     fetchUser();
//     fetchTeam();
//   }, []);

//   if (!currentUserId || !teamId) {
//     return <div>Loading...</div>;
//   }

//   return (
//     <Chat
//       supabase={supabase}
//       currentUserId={currentUserId}
//       mode="team"
//       teamId={teamId}
//     />
//   );
// }

// src/pages/TeamChatPage.tsx
import React from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../lib/supabase"
import Chat from "../components/chat"

export default function TeamChatPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { user } = useAuth()

  if (!teamId) return <div className="p-4">Invalid team</div>
  if (!user) return <div className="p-4">Please log in</div>

  return (
    <div className="h-screen">
      <Chat
        supabase={supabase}
        currentUserId={user.id}
        mode="team"
        teamId={teamId}
      />
    </div>
  )
}


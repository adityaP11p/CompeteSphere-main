// import { useEffect, useState } from "react";
// import { supabase } from "../lib/supabase";
// import Chat from "../components/chat";

// export function DirectChatPage() {
//   const [currentUserId, setCurrentUserId] = useState<string | null>(null);

//   // These would typically come from route params or app context
//   const recipientId = "other-user-uuid";
//   const teamId = "team-context-uuid"; // optional

//   useEffect(() => {
//     const getUser = async () => {
//       const {
//         data: { user },
//         error,
//       } = await supabase.auth.getUser();

//       if (user) {
//         setCurrentUserId(user.id);
//       } else {
//         console.error("User not authenticated", error);
//         // Redirect to login or show error
//       }
//     };

//     getUser();
//   }, []);

//   if (!currentUserId) {
//     return <div>Loading chat...</div>; // Or a spinner
//   }

//   return (
//     <Chat
//       supabase={supabase}
//       currentUserId={currentUserId}
//       mode="direct"
//       recipientId={recipientId}
//       teamId={teamId}
//     />
//   );
// }

// export default DirectChatPage;

// src/pages/DirectChatPage.tsx
import React from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../lib/supabase"
import Chat from "../components/chat"

export default function DirectChatPage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()

  if (!userId) return <div className="p-4">Invalid user</div>
  if (!user) return <div className="p-4">Please log in</div>

  return (
    <div className="h-screen">
      <Chat
        supabase={supabase}
        currentUserId={user.id}
        mode="direct"
        recipientId={userId}
      />
    </div>
  )
}

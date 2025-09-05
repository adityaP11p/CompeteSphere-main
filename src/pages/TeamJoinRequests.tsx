import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type UUID = string;

type JoinRequest = {
  id: UUID;
  team_id: UUID;
  user_id: UUID;
  status: string;
  requested_at: string;
  profiles?: { full_name: string | null; email: string };
  teams?: { name: string };
};

const TeamJoinRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<JoinRequest[]>([]);

  const fetchRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("team_join_requests")
      .select("id, team_id, user_id, status, requested_at, profiles(full_name,email), teams(name,owner_id)")
      .eq("teams.owner_id", user.id) // only requests for teams I own
      .order("requested_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching join requests:", error);
    } else {
      setRequests(data || []);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchRequests();

    // Realtime subscription
    const channel = supabase
      .channel(`join-requests-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_join_requests" },
        fetchRequests
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const respond = async (req: JoinRequest, accept: boolean) => {
    // Update request status
    await supabase
      .from("team_join_requests")
      .update({ status: accept ? "accepted" : "rejected" })
      .eq("id", req.id);

    if (accept) {
      // Add as team member
      await supabase.from("team_members").insert([
        {
          team_id: req.team_id,
          user_id: req.user_id,
          joined_at: new Date().toISOString(),
          is_captain: false,
          status: "accepted",
        },
      ]);
      alert("You accepted request");
    }else{
      alert("you rejected the request");
    }
      const { error: deleting } = await supabase
      .from("team_join_requests")
      .delete()
      .eq("id", req.id) 
      
    
      if (deleting) {
        console.error("Error fetching join requests:", deleting);
      }
    
    fetchRequests();
    
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Team Join Requests</h2>
      {requests.length === 0 ? (
        <p className="text-gray-600">No pending requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="border rounded-lg p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">
                  {req.profiles?.full_name || req.profiles?.email} wants to join{" "}
                  {req.teams?.name || req.team_id}
                </div>
                <div className="text-xs text-gray-500">
                  Status: {req.status} | {new Date(req.requested_at).toLocaleString()}
                </div>
              </div>
              {req.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(req, true)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(req, false)}
                    className="px-3 py-1.5 bg-gray-300 rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamJoinRequests;

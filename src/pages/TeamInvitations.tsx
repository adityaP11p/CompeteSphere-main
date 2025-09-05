import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type UUID = string;

type Invitation = {
  id: UUID;
  team_id: UUID;
  user_id: UUID;
  status: string;
  created_at: string;
  teams?: { name: string };
};

const TeamInvitations: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const inviteUser = async (teamId: UUID, targetUserId: UUID) => {
    // 1. Check if invite exists
    const { data: existing, error } = await supabase
      .from("team_invitations")
      .select("id,status")
      .eq("team_id", teamId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (error) {
      console.error("Error checking invite:", error);
      alert("Could not check existing invites.");
      return;
    }

    if (existing) {
      if (existing.status === "pending") {
        alert("You already invited this person. Waiting for their response.");
        return;
      }
      if (existing.status === "rejected") {
        alert("This person rejected your invite. You cannot invite again.");
        return;
      }
      if (existing.status === "accepted") {
        alert("This person is already in your team.");
        return;
      }
    }

    // 2. Insert new invite
    const { error: insertError } = await supabase.from("team_invitations").insert([
      {
        team_id: teamId,
        user_id: targetUserId,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.error(insertError);
      alert("Could not send invite.");
      return;
    }

    alert("Invite sent successfully!");
  };

  const fetchInvites = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("team_invitations")
      .select("id, team_id, user_id, status, created_at, teams(name)")
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }
    
    setInvitations(data || []);
  };

  useEffect(() => {
    if (!user) return;
    fetchInvites();

    // Realtime subscription
    const channel = supabase
      .channel(`invitations-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_invitations" },
        fetchInvites
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function getCompetitionIdFromTeamId(teamId: UUID): Promise<UUID | null> {
    const { data, error } = await supabase
      .from("teams")
      .select("competition_id")
      .eq("id", teamId)
      .single();

    if (error) {
      console.error("Error fetching competition_id:", error);
      return null;
    }

    return data.competition_id;
  }

  const respond = async (invitationId: UUID, accept: boolean) => {
  const invitation = invitations.find((inv) => inv.id === invitationId);
  if (!invitation) return;

  if (accept) {
    // 1. Add user to team_members
    const { error: insertError } = await supabase.from("team_members").insert([
      {
        team_id: invitation.team_id,
        user_id: invitation.user_id,
        status: "accepted",
      },
    ]);

    if (insertError) {
      console.error("Error adding to team_members:", insertError);
      alert(insertError.message || "Failed to join team.");
      return;
    }

    // 2. Update the invitation status to accepted (optional, for history)
    const competitionId = await getCompetitionIdFromTeamId(invitation.team_id)
    if (!competitionId) {
      console.error("No competition_id found for team:", invitation.team_id);
      return;
    }
    await supabase
      .from("team_invitations")
      .update({ status: "accepted" })
      .eq("id", invitationId);

    const { error: deleteIntentError } = await supabase
      .from("join_intents")
      .delete()
      .eq("user_id", invitation.user_id)
      .eq("competition_id", competitionId); 

    if (deleteIntentError) {
      console.warn("Could not delete join_intent:", deleteIntentError);
    }
    alert("You are added in the team.");
  } else {
    // 1. Update status to rejected (optional)
    await supabase
      .from("team_invitations")
      .update({ status: "rejected" })
      .eq("id", invitationId);

      alert("You have rejected the invitation.");
  }
    // 2. Delete the invitation
    const { error: deleteError } = await supabase
      .from("team_invitations")
      .delete()
      .eq("id", invitationId);

    if (deleteError) {
      console.error("Error deleting invitation:", deleteError);
      alert("Failed to reject invitation.");
      return;
    }
    fetchInvites();
    
    // Optional: Notify captain via another mechanism (e.g., insert into notifications table)
  
};


  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Team Invitations</h2>
      {invitations.length === 0 ? (
        <p className="text-gray-600">No invitations found.</p>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="border rounded-lg p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">
                  Team: {inv.teams?.name || inv.team_id}
                </div>
                <div className="text-xs text-gray-500">
                  Status: {inv.status} | {new Date(inv.created_at).toLocaleString()}
                </div>
              </div>
              {inv.status === "pending" && inv.user_id === user?.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(inv.id, true)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(inv.id, false)}
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

export default TeamInvitations;
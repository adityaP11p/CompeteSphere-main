import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// ---------- Types (relaxed to keep it copy/paste friendly) ----------
type UUID = string;

type Team = {
  id: UUID;
  competition_id: UUID;
  owner_id: UUID;
  name: string;
  status: string | null;
};

type TeamNeed = {
  team_id: UUID;
  needed_role: string | null;
  needed_skills: number[]; // _int4 array in Postgres
};

type TeamWithNeeds = Team & { needs?: TeamNeed | null };

// ---------- Props ----------
interface TeamFinderProps {
  competitionId: string;
  onClose: () => void;
  initialMode?: "choose" | "create" | "join";
  existingTeamId?: UUID | null;
  onChat?: (userId: string) => void;
}

// ---------- Component ----------
const TeamFinder: React.FC<TeamFinderProps> = ({ competitionId, onClose, initialMode = "choose", existingTeamId = null, onChat }: TeamFinderProps) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<"choose" | "create" | "join">(initialMode || "choose");
  
  // --- CREATE TEAM state ---
  const [teamName, setTeamName] = useState("");
  const [neededRole, setNeededRole] = useState("");
  const [neededSkillInput, setNeededSkillInput] = useState(""); // "react, node, sql"
  const [createLoading, setCreateLoading] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<{ user_id: UUID; score: number }[]>([]);
  const [createdTeamId, setCreatedTeamId] = useState<UUID | null>(null); // store latest created team id

  // --- JOIN TEAM state ---
  const [mySkillInput, setMySkillInput] = useState(""); // "react, node"
  const [joinLoading, setJoinLoading] = useState(false);
  const [suggestedTeams, setSuggestedTeams] = useState<{ team: Team; score: number }[]>([]);
  const [noTeamPending, setNoTeamPending] = useState(false);

  // Realtime invite prompt
  const [incomingInvite, setIncomingInvite] = useState<{ id: UUID; team_id: UUID; team_name?: string } | null>(null);

  // sanity: warn if competitionId missing (helps trace the earlier bug)
  useEffect(() => {
    if (!competitionId) console.warn("TeamFinder: competitionId prop is missing or falsy. Parent must pass it.");
  }, [competitionId]);

  useEffect(() => {
    if (initialMode === "create" && existingTeamId) {
      setMode("create");
      setCreatedTeamId(existingTeamId);
    }
  }, [initialMode, existingTeamId]);

  // Ensure user profile exists before writing join_intents
  async function ensureProfile(user: any) {
    if (!user) return null;

    const { data: existing, error: exErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (exErr && exErr.code !== "PGRST116") { // ignore "row not found"
      console.error("Error checking profile:", exErr);
      return null;
    }

    if (!existing) {
      const { error: insErr } = await supabase.from("profiles").insert([
        {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      ]);
      if (insErr) {
        console.error("Error inserting profile:", insErr);
        return null;
      }
    }

    return true;
  }

  // ---------- UTIL: normalize skill names and fetch/ensure skill ids ----------
  async function ensureSkillIds(skillNames: string[]): Promise<number[]> {
    const names = [
      ...new Set(
        skillNames
          .map((s) => (s || "").toString().trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    if (!names.length) return [];

    // 1) fetch existing
    const { data: existing, error: sErr } = await supabase.from("skills").select("id,slug").in("slug", names);
    if (sErr) throw sErr;

    const existingMap = new Map((existing || []).map((r: any) => [r.slug, r.id]));
    const missing = names.filter((n) => !existingMap.has(n));

    // 2) insert missing
    if (missing.length) {
      const { data: inserted, error: iErr } = await supabase
        .from("skills")
        .insert(missing.map((n) => ({ slug: n })))
        .select("id,slug");
      if (iErr) throw iErr;
      inserted?.forEach((r: any) => existingMap.set(r.slug, r.id));
    }

    // 3) ids in same order as names
    return names.map((n) => existingMap.get(n) as number);
  }

  // ---------- UTIL: compute match score ----------
  function scoreOverlap(needIds: number[], haveIds: number[]) {
    if (!needIds?.length) return 0;
    const have = new Set(haveIds);
    const matched = needIds.filter((x) => have.has(x)).length;
    //return Math.round((matched / needIds.length) * 100);
    return matched / needIds.length; // 0 to 1
  }

  // ---------- CREATE TEAM flow ----------
  async function handleCreateTeam() {
    await ensureProfile(user);
    if (!user) {
      alert("You must be signed in to create a team.");
      return;
    }
    if (!competitionId) {
      alert("Competition not specified. Try again.");
      return;
    }
    setCreateLoading(true);

    try {
      // 1) Insert team
      const { data: team, error: tErr } = await supabase
        .from("teams")
        .insert([
          {
            competition_id: competitionId,
            owner_id: user.id,
            name: teamName.trim(),
            status: "open",
          },
        ])
        .select("*")
        .single();
      if (tErr || !team) throw tErr;
      setCreatedTeamId(team.id);

      // 2) Insert captain in team_members
      await supabase.from("team_members").insert([
        {
          team_id: team.id,
          user_id: user.id,
          role_pref: "captain",
          joined_at: new Date().toISOString(),
          is_captain: true,
          status: "accepted",
        },
      ]);
      setMode("create");
    } catch (err) {
        console.error(err);
        alert("Could not create team");
    } finally {
      setCreateLoading(false);
    }
  }

  // ---------- STEP 2: Define needs ----------
  async function handleUpdateNeeds() {
    await ensureProfile(user);
    if (!user) {
      alert("You must be signed in to create a team.");
      return;
    }
    if (!createdTeamId) return;

    try{
      // Parse skills → ids
      const needIds = await ensureSkillIds(neededSkillInput.split(","));

      // 4) Store team_needs (upsert by team_id)
      const {error: upsertError} = await supabase.from("team_needs").upsert(
        [
          {
            team_id: createdTeamId, //team.id,
            needed_role: neededRole || null,
            needed_skills: needIds,
          },
        ],
        { onConflict: "team_id" } as any
      );
      if (upsertError) console.error("team_needs insert error:", upsertError);

      // 5) Find candidates (participants) who already have these skills
      if (needIds.length) {
        const { data: candidates, error: cErr  } = await supabase
          .from("join_intents")
          .select("user_id, desired_skills")
          .eq("competition_id", competitionId)
          .eq("status", "pending");
        if (cErr) throw cErr;

        // Group candidate skills
        const map = new Map<string, Set<number>>();
        (candidates || []).forEach((row: any) => {
          if (!map.has(row.user_id)) map.set(row.user_id, new Set());
          row.desired_skills.forEach((sid: number) => map.get(row.user_id)!.add(sid));
        });


        // Exclude captain
        const candidateScores: { user_id: UUID; score: number }[] = [];
        for (const [uid, set] of map.entries()) {
          if (uid === user.id) continue;
          const score = scoreOverlap(needIds, Array.from(set));
          if (score > 0) candidateScores.push({ user_id: uid, score });
        }

        // Persist match suggestions and prepare invite UI
        if (candidateScores.length) {
          const { error: upsertingError } = await supabase.from("team_match_suggestions").upsert(
            candidateScores.map((c) => ({
              team_id: createdTeamId, //team.id,
              user_id: c.user_id,
              score: c.score,
              premium_boost: false,
            })),
            { onConflict: "team_id,user_id" } as any
          );
          if (upsertingError) console.error("team_needs insert error:", upsertingError);
          
          setInviteCandidates(candidateScores.sort((a, b) => b.score - a.score).slice(0, 15));
        } else {
          // No candidates → mark team pending
          await supabase.from("teams").update({ status: "open" }).eq("id", createdTeamId); //team.id
        }
      } else {
        await supabase.from("teams").update({ status: "open" }).eq("id", createdTeamId);
      }
    } catch (e) {
      console.error(e);
      alert("Could not update needs.");
    }
  }

  // ---------- STEP 3: Register team ----------
  async function handleRegisterTeam() {
    await ensureProfile(user);
    if (!user) {
      alert("You must be signed in to create a team.");
      return;
    }
    if (!createdTeamId) return;

    try{
      // 3) Register team to competition
      const {error: insertError} = await supabase.from("team_registrations").insert([
        {
          team_id: createdTeamId,
          competition_id: competitionId,
          status: "registered",
          registered_at: new Date().toISOString(),
        },
      ]);
      if (insertError) console.error("team_registrations insert error:", insertError);
      alert("Team registered");
    } catch (err) {
      console.error(err);
      alert("Could not register team");
    }
  }

  // Captain sends invite (Realtime notifies participant)
  async function sendInvite(teamId: UUID | null, candidateUserId: UUID) {
    const finalTeamId = teamId || createdTeamId;
    if (!finalTeamId) {
      alert("No team selected to invite to.");
      return;
    }

    const { error } = await supabase.from("team_invitations").insert([
      {
        team_id: finalTeamId,
        user_id: candidateUserId,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);
    if (error) {
      console.error(error);
      alert("Could not send invite.");
    } else {
      // optional feedback
      alert("Invite sent");
    }
  }
  
  // ---------- JOIN TEAM flow ----------
  async function handleFindTeamsForMe() {
    await ensureProfile(user);
    if (!user) {
      alert("Sign in to find teams.");
      return;
    }
    if (!competitionId) {
      alert("Competition not specified.");
      return;
    }

    setJoinLoading(true);
    setNoTeamPending(false);

    try {
      // 0) Convert my input skills → ids; also upsert into user_skills for future auto-suggest
      const mySkillIds = await ensureSkillIds(mySkillInput.split(","));
      await ensureProfile(user);
      // Save/refresh my skills (delete + insert)
      if (mySkillIds.length) {
        await supabase.from("user_skills").delete().eq("user_id", user.id);
        await supabase.from("user_skills").insert(mySkillIds.map((sid) => ({ user_id: user.id, skill_id: sid })));
      }

      // 1) Pull team_needs joined with teams (only for this competition)
      const { data: needs, error: nErr } = await supabase
        .from("team_needs")
        .select("team_id, needed_role, needed_skills, teams(id,name,competition_id,owner_id,status)") //
        .eq("teams.competition_id", competitionId);
      if (nErr) throw nErr;

      // 2) Compute match scores
      const scored: { team: Team; score: number }[] = [];
      (needs || []).forEach((row: any) => {
        const teamObj: Team | undefined = row.teams;
        if (!teamObj) return;
        const score = scoreOverlap(row.needed_skills || [], mySkillIds);
        if (score > 0) scored.push({ team: teamObj, score });
      });

      // Persist suggestions for "recommended teams" section
      if (scored.length) {
        await supabase.from("team_match_suggestions").upsert(
          scored.map((s) => ({
            team_id: s.team.id,
            user_id: user.id,
            score: s.score,
            premium_boost: false,
          })),
          { onConflict: "team_id,user_id" } as any
        );
        setSuggestedTeams(scored.sort((a, b) => b.score - a.score).slice(0, 20));
      } else {
        // 3) No teams → record pending interest so captains can discover later
        await ensureProfile(user);
        
        const { error: pErr } = await supabase.from("join_intents").insert([
          {
            user_id: user.id,
            competition_id: competitionId,
            desired_skills: mySkillIds,
            status: "pending",
            created_at: new Date().toISOString(),
          },
        ]);
        if (pErr) {
          // table might not exist yet—log and continue UI message
          console.warn("join_intents insert failed (maybe missing table). Details:", pErr);
        }
        setSuggestedTeams([]);
        setNoTeamPending(true);
      }
    } catch (e) {
      console.error(e);
      alert("Could not compute matches. Check console.");
    } finally {
      setJoinLoading(false);
    }
  }

  async function joinSelectedTeam(teamId: UUID) {
    await ensureProfile(user);
    if (!user) {
      alert("Sign in to join a team.");
      return;
    }
    const { error: teamJoining } = await supabase.from("team_join_requests").insert([
    {
      team_id: teamId,
      user_id: user.id,
      status: "pending",
      requested_at: new Date().toISOString(),
    },
  ]);

  if (teamJoining) {
    console.error(teamJoining);
    alert("Could not send join request.");
    return;
  }

    // Ensure team is linked to the competition (idempotent)
    await supabase.from("team_registrations").upsert(
      [
        {
          team_id: teamId,
          competition_id: competitionId,
          status: "registered",
          registered_at: new Date().toISOString(),
        },
      ],
      { onConflict: "team_id,competition_id" } as any
    );

    alert("Request sent successfully, waiting for conformation.");
    onClose();
  }

  // ---------- Realtime: listen for invites to this user ----------
  useEffect(() => {
    
    if (!user) return;

    const channel = supabase
      .channel(`invites-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_invitations", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const inv = payload.new as any;
          // Load team name for nicer UX
          const { data: t } = await supabase.from("teams").select("id,name").eq("id", inv.team_id).single();
          setIncomingInvite({ id: inv.id, team_id: inv.team_id, team_name: t?.name });
        }
      )
      .subscribe();

    return () => {
      // remove subscription
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Accept/Reject invite
  async function respondToInvite(accept: boolean) {
    await ensureProfile(user);
    if (!incomingInvite || !user) return;

    if (accept) {
      await supabase.from("team_members").insert([
        {
          team_id: incomingInvite.team_id,
          user_id: user.id,
          role_pref: null,
          joined_at: new Date().toISOString(),
          is_captain: false,
          status: "active",
        },
      ]);

      await supabase.from("team_registrations").upsert(
        [
          {
            team_id: incomingInvite.team_id,
            competition_id: competitionId,
            status: "registered",
            registered_at: new Date().toISOString(),
          },
        ],
        { onConflict: "team_id,competition_id" } as any
      );

      await supabase.from("team_invitations").update({ status: "accepted" }).eq("id", incomingInvite.id);
      alert("You joined the team!");
      setIncomingInvite(null);
      onClose();
    } else {
      await supabase.from("team_invitations").update({ status: "rejected" }).eq("id", incomingInvite.id);
      setIncomingInvite(null);
    }
  }

  // ---------- UI ----------
  const createDisabled = useMemo(() => !teamName.trim() || createLoading, [teamName, createLoading]);
  const joinDisabled = useMemo(() => !mySkillInput.trim() || joinLoading, [mySkillInput, joinLoading]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-3">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl p-6 space-y-4">

        {mode === "choose" && (
          <>
            <h2 className="text-xl font-bold">Register for Competition</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button onClick={() => setMode("join")} className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700">
                Join an existing team
              </button>
              <button onClick={() => setMode("create")} className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700">
                Create a new team
              </button>
            </div>
            <button className="text-sm underline text-gray-600" onClick={onClose}>Cancel</button>
          </>
        )}

        {mode === "join" && (
          <>
            <h3 className="text-lg font-semibold">Tell us your skills</h3>
            <p className="text-sm text-gray-600 mb-2">Enter skills (comma separated). We’ll match you to teams needing these skills.</p>
            <input className="w-full border rounded-lg p-2" placeholder="e.g. React, Node.js, SQL" value={mySkillInput} onChange={(e) => setMySkillInput(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={handleFindTeamsForMe} disabled={joinDisabled} className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-60">
                {joinLoading ? "Matching…" : "Find teams"}
              </button>
              <button onClick={() => setMode("choose")} className="px-4 py-2 rounded-lg bg-gray-100">Back</button>
            </div>

            {noTeamPending && (
              <div className="mt-4 rounded-xl border p-4 bg-gray-50 text-gray-800">
                <div className="font-medium">So far, no team is found for searching these skills or vacant. Kindly wait, we will notify you or create your own team.</div>
                <div className="text-xs text-gray-600 mt-1">You’ve been marked as <b>pending</b> for this competition; captains can invite you when they need your skills.</div>
              </div>
            )}

            {suggestedTeams.length > 0 && (
              <div className="mt-4">
                <div className="font-semibold mb-2">Recommended teams</div>
                <div className="space-y-2 max-h-72 overflow-auto pr-1">
                  {suggestedTeams.map(({ team, score }) => (
                    <div key={team.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{team.name}</div>
                        <div className="text-xs text-gray-500">Match score: {Math.round(score * 100)}%</div>
                      </div>
                      
                      <button onClick={() => joinSelectedTeam(team.id)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white">Join</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* code */}
        {mode === "create" && (
          <>
            {/* === STEP 1: TEAM CREATION ===     !existingTeamId*/} 
            {  !createdTeamId && (
              <>
                <h3 className="text-lg font-semibold">Create your team</h3>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    className="w-full border rounded-lg p-2"
                    placeholder="Team name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateTeam} // <-- creates team and sets createdTeamId
                      disabled={createDisabled}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
                    >
                      {createLoading ? "Creating…" : "Create & register"}
                    </button>
                    <button
                      onClick={() => setMode("choose")}
                      className="px-4 py-2 rounded-lg bg-gray-100"
                    >
                      Back
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* === STEP 2: TEAM DETAILS + INVITES (common for old + new) === */}
            {(createdTeamId) && (
              <>
                <h3 className="text-lg font-semibold">Team details</h3>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    className="w-full border rounded-lg p-2"
                    placeholder="Primary role you’re hiring for (optional)"
                    value={neededRole}
                    onChange={(e) => setNeededRole(e.target.value)}
                  />
                  <input
                    className="w-full border rounded-lg p-2"
                    placeholder="Needed skills (comma separated) e.g. React, Node.js"
                    value={neededSkillInput}
                    onChange={(e) => setNeededSkillInput(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button onClick={handleUpdateNeeds} className="px-4 py-2 bg-green-600 text-white rounded-lg">Save Needs</button>
                    <button onClick={handleRegisterTeam} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Step 3: Register Team</button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg bg-gray-100"
                    >
                      Back
                    </button>
                  </div>
                </div>

                {/* Candidate matching results */}
                {inviteCandidates.length > 0 ? (
                  <div className="mt-5">
                    <div className="font-semibold mb-2">Potential candidates</div>
                    <div className="text-sm text-gray-600 mb-2">
                      These users already match your needed skills. Send them an invite.
                    </div>
                    <div className="space-y-2 max-h-64 overflow-auto pr-1">
                      {inviteCandidates.map((c) => (
                        <div
                          key={c.user_id}
                          className="border rounded-lg p-3 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm">User: {c.user_id.slice(0, 8)}…</div>
                            <div className="text-xs text-gray-500">
                              Match score: {c.score}%
                            </div>
                          </div>
                          <button
                            onClick={() => onChat?.(c.user_id)}
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                          >
                            Chat
                          </button>
                          <button
                            onClick={() =>
                              sendInvite(existingTeamId || createdTeamId, c.user_id)
                            }
                            className="px-3 py-1.5 rounded-lg bg-green-600 text-white"
                          >
                            Invite
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border p-4 bg-gray-50 text-gray-800">
                    <div className="font-medium">
                      So far, no one of these skills is found for joining team. Kindly
                      wait, we will notify you.
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Your team has been marked as <b>pending</b> to improve future
                      matching visibility.
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default TeamFinder;


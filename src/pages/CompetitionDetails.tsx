import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, Users, Trophy, Clock, MapPin, ChevronLeft, ExternalLink } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import  TeamFinder  from './TeamFinder'

interface Competition {
  id: string
  organizer_id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  registration_deadline: string
  min_team_size: number
  max_team_size: number
  prize_pool_cents: number
  prize_currency: string
  created_at: string
}

interface Organizer {
  id: string
  full_name: string
  email: string
}


export const CompetitionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [organizer, setOrganizer] = useState<Organizer | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [showTeamFinder, setShowTeamFinder] = useState(false);
  const [teamFinderMode, setTeamFinderMode] = useState<"choose" | "create" | "join">("choose");
  const [team, setTeam] = useState<any | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isCaptain, setIsCaptain] = useState(false);
  const isParticipant = !!user;
  const notRegistered = isParticipant && !isRegistered;
  const canInvite = isCaptain && isRegistered;
  
  function openTeamFinder() {
    if (isCaptain && team) {
      
      setTeamFinderMode("create"); // Captain with team: go straight to Invite UI
    } else {

      setTeamFinderMode("choose"); // Others start with "choose" view
    }
    setShowTeamFinder(true);
  }


  useEffect(() => {
    if (id) {
      fetchCompetitionDetails()
    }
  }, [id])

  const fetchCompetitionDetails = async () => {
    try {
      // Fetch competition details
      const { data: competitionData, error: competitionError } = await supabase
        .from('competitions')
        .select(`
        id,
        title,
        description,
        start_date,
        end_date,
        registration_deadline,
        min_team_size,
        max_team_size,
        prize_pool_cents,
        prize_currency,
        organizer_id,
        created_at
      `)
        .eq('id', id)
        .single()

      if (competitionError) {
        console.error('Error fetching competition:', competitionError)
        return
      }
      console.log(id)
      setCompetition(competitionData)

      // Fetch organizer details
      const { data: organizerData, error: organizerError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', competitionData.organizer_id)
        .single()

      if (!organizerError) {
        setOrganizer(organizerData)
      }

      // Check if user is already registered
      if (user) {
        console.log(user.id);
        
        const { data: memberData, error } = await supabase
          .from('team_members')
          .select(`
            team_id,
            is_captain,
            status,
            teams!inner (
              id,
              competition_id,
              name,
              team_members (
                user_id,
                is_captain,
                status,
                profiles (id, full_name, email)
              )
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'accepted') // ✅ Only count accepted members
          .eq('teams.competition_id', id)
          .maybeSingle()

        if (memberData) {
          setIsRegistered(true);
          setTeam(memberData.teams);
          setTeamMembers(memberData.teams.team_members);
          setIsCaptain(memberData.is_captain);
        }

      }
    } catch (error) {
      console.error('Error fetching competition details:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string, full = false) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...(full && { hour: "2-digit", minute: "2-digit" })
    })
  }

  const getCompetitionStatus = (competition: Competition): 
  "upcoming" | "open" | "closed" | "ended" => {
  const now = new Date()
  const start = new Date(competition.start_date)
  const end = new Date(competition.end_date)
  const regDeadline = new Date(competition.registration_deadline)

  if (now > end) return "ended"
  if (now < start && now <= regDeadline) return "open"
  if (now < start && now > regDeadline) return "closed"
  return "upcoming"
}

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!competition) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <Trophy className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Competition Not Found</h2>
            <p className="text-gray-600 mb-6">The competition you're looking for doesn't exist or has been removed.</p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Competitions
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  const status = getCompetitionStatus(competition)
  // if (showTeamFinder) {
  //   return (
  //     <TeamFinder
  //       competitionId={competition.id}   // pass competitionId
  //       onClose={() => setShowTeamFinder(false)}
  //       initialMode={isCaptain && team ? "create" : "choose"}
  //       existingTeamId={team?.id}// allow closing
  //     />
  //   );
  // }
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back to Competitions
        </button>

        {/* Competition Header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="p-8">
            <div className="flex items-center justify-between mb-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  status === "open"
                    ? "bg-green-100 text-green-800"
                    : status === "upcoming"
                    ? "bg-blue-100 text-blue-800"
                    : status === "closed"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {status === "open"
                  ? "Open"
                  : status === "upcoming"
                  ? "Upcoming"
                  : status === "closed"
                  ? "Closed"
                  : "Ended"}
              </span>
              <Trophy className="h-8 w-8 text-gray-400" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">{competition.title}</h1>
            
            {competition.description && (
              <p className="text-gray-600 text-lg mb-6">{competition.description}</p>
            )}

            {/* Competition Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <div className="flex items-center text-gray-700">
                  <Calendar className="h-5 w-5 mr-3 text-gray-400" />
                  <div>
                    <p className="font-medium">Competition Period</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(competition.start_date)} - {formatDate(competition.end_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center text-gray-700">
                  <Clock className="h-5 w-5 mr-3 text-gray-400" />
                  <div>
                    <p className="font-medium">Registration Deadline</p>
                    <p className="text-sm text-gray-600">{formatDate(competition.registration_deadline)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {competition.min_team_size && (
                  <div className="flex items-center text-gray-700">
                    <Users className="h-5 w-5 mr-3 text-gray-400" />
                    <div>
                      <p className="font-medium">Min Participants</p>
                      <p className="text-sm text-gray-600">{competition.min_team_size}</p>
                    </div>
                  </div>
                )}
                {competition.max_team_size && (
                  <div className="flex items-center text-gray-700">
                    <Users className="h-5 w-5 mr-3 text-gray-400" />
                    <div>
                      <p className="font-medium">Max Participants</p>
                      <p className="text-sm text-gray-600">{competition.max_team_size}</p>
                    </div>
                  </div>
                )}

                {competition.prize_pool_cents > 0 && (
                  <div className="flex items-center text-gray-700">
                    <Trophy className="h-5 w-5 mr-3 text-gray-400" />
                    <div>
                      <p className="font-medium">Prize Pool</p>
                      <p className="text-sm text-gray-600">${competition.prize_currency}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Organizer Info */}
            {organizer && (
              <div className="border-t border-gray-200 pt-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Organized by</h3>
                <p className="text-gray-700">{organizer.full_name || organizer.email}</p>
              </div>
            )}

            {/* Registration Section */}
            {/* {user && (
              <div className="flex items-center space-x-4">
                {isRegistered ? (
                  <div className="flex items-center text-green-600">
                    <Trophy className="h-5 w-5 mr-2" aria-hidden="true" />
                    <span className="font-medium">You are registered for this competition</span>
                  </div>
                ) : new Date() <= new Date(competition.registration_deadline) ? (
                  <button
                    type="button"
                    onClick={() => setShowTeamFinder(true)}
                    disabled={registering || !competition}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Register for Competition
                  </button>
                ) : (
                  <div className="text-gray-500">
                    <p>Registration is no longer available</p>
                  </div>
                )}
              </div>
            )} */}
            {/* Registration / Team Section */}
            {isParticipant && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Team</h3>
                <ul className="space-y-2">
                  {teamMembers.map((member) => (
                    <li
                      key={member.user_id}
                      className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
                    >
                      <span>
                        {member.profiles?.full_name || member.profiles?.email}
                      </span>
                      {member.is_captain && (
                        <span className="text-xs text-white bg-blue-600 px-2 py-0.5 rounded">
                          Captain
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Show correct status */}
                <div className="mt-4 font-medium">
                  {teamMembers.filter((m) => m.status === "accepted").length < competition.min_team_size ? (
                    <span className="text-red-600">Less teammates, invite teammates</span>
                  ) : (
                    <span className="text-green-600">You are registered for this competition</span>
                  )}
                </div>

                { notRegistered && (
                  <button
                    onClick={openTeamFinder}
                    className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Register for Competition
                  </button>
                )}
                {/* Captain can invite teammates */}
                {canInvite && (
                  <button
                    onClick={openTeamFinder}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Invite Teammates
                  </button>
                )}
              </div>
            )}
            {showTeamFinder && (
              <TeamFinder
                competitionId={competition.id}
                onClose={() => setShowTeamFinder(false)}
                initialMode={teamFinderMode}
                existingTeamId={team?.id}
              />
            )}

            {!user && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 mb-4">You need to be signed in to register for this competition.</p>
                <div className="flex space-x-4">
                  <button
                    onClick={() => navigate('/auth/login')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/auth/signup')}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
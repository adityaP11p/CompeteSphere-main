import React, { useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Calendar, Users, Trophy, Clock, ChevronRight, Coins } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from "../contexts/AuthContext";

interface Competition {
  id: string
  title: string
  registration_deadline: string
  prize_pool_cents: number | null
  prize_currency: string | null
}

export const PublicCompetitionCatalog: React.FC = () => {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)

   // NEW state
  const [hasInvites, setHasInvites] = useState(false);
  const [hasJoinRequests, setHasJoinRequests] = useState(false);

  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const { data, error } = await supabase
          .from('competitions')
          .select('id, title, registration_deadline, prize_pool_cents, prize_currency')
          .order('registration_deadline', { ascending: true })

        if (error) throw error
        setCompetitions(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchCompetitions()
  }, [])

   useEffect(() => {
    if (!user) return;

    const checkNotifications = async () => {
      try {
        // pending invites for this user
        const { count: inviteCount } = await supabase
          .from("team_invitations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "pending");

        setHasInvites((inviteCount || 0) > 0);

        // pending join requests for teams where I'm the owner (captain)
        const { count: reqCount } = await supabase
          .from("team_join_requests")
          .select("id, teams!inner(owner_id)", { count: "exact", head: true })
          .eq("teams.owner_id", user.id)
          .eq("status", "pending");

        setHasJoinRequests((reqCount || 0) > 0);
      } catch (err) {
        console.error("Error checking notifications:", err);
      }
    };

    checkNotifications();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-4">
            Discover Amazing Competitions
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join competitions from organizers around the world. Challenge yourself, learn new skills, and win exciting prizes.
          </p>
        </div>
        <Link
          to="/organizer"
          className="inline-block px-6 py-3 bg-purple-600 text-white text-lg font-semibold rounded-md hover:bg-purple-700 transition-colors"
        >
          Want to organize competition? Click here
        </Link>

        {/* 🔹 Notifications for logged in users */}
        {user && (hasInvites || hasJoinRequests) && (
          <div className="mb-8 flex flex-wrap gap-3 justify-center">
            {hasInvites && (
              <Link
                to="/team-invitations"
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                You have team invitations
              </Link>
            )}
            {hasJoinRequests && (
              <Link
                to="/team-join-requests"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Team join requests
              </Link>
            )}
          </div>
        )}
        
        {/* Competitions Grid */}
        {competitions.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No competitions found</h3>
            <p className="text-gray-600">
              There are no competitions available at the moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {competitions.map((competition) => (
              <div
                key={competition.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  {/* Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {competition.title}
                  </h3>

                  {/* Registration Deadline */}
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>
                      Registration until {formatDate(competition.registration_deadline)}
                    </span>
                  </div>

                  {/* Prize Pool */}
                  {competition.prize_pool_cents && (
                    <div className="flex items-center text-sm text-gray-500 mb-4">
                      <Coins className="h-4 w-4 mr-2" />
                      <span>
                        Prize Pool: {competition.prize_pool_cents / 100}{' '}
                        {competition.prize_currency}
                      </span>
                    </div>
                  )}

                  {/* Action */}
                  <Link
                    to={`/competition/${competition.id}`}
                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    View Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

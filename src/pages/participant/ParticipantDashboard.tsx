import React, {useState, useEffect} from 'react'
import { Trophy, Target, Calendar, Medal, Users, TrendingUp, BookOpen, Video } from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { CatalogItem, MentorshipSlot } from '../../types'

export const ParticipantDashboard: React.FC = () => {
  const { profile } = useAuth()
  const [enrolledCourses, setEnrolledCourses] = useState<CatalogItem[]>([])
  const [bookedMentorships, setBookedMentorships] = useState<(CatalogItem & { slot: MentorshipSlot | null })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!profile?.id) return
      setLoading(true)

      // Fetch enrolled courses
      const { data: courses, error: coursesErr } = await supabase
        .from('enrollments')
        .select(`
          item:catalog_items(*)
        `)
        .eq('buyer_id', profile.id)

      if (coursesErr) console.error('Error fetching courses', coursesErr)
      else setEnrolledCourses(courses?.map(c => c.item) || [])

      // Fetch booked mentorships
      const { data: mentorships, error: mentorErr } = await supabase
        .from('mentorship_bookings')
        .select(`
          slot:mentorship_slots(*, item:catalog_items(*))
        `)
        .eq('buyer_id', profile.id)

      if (mentorErr) console.error('Error fetching mentorships', mentorErr)
      else {
        const formatted = mentorships?.map(m => ({
          ...m.slot.item,
          slot: m.slot
        })) || []
        setBookedMentorships(formatted)
      }

      setLoading(false)
    }

    loadData()
  }, [profile?.id])

  return (
    <Layout showSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {profile?.full_name}!
          </h1>
          <p className="text-gray-600 mt-1">
            Track your competitions, view results, and discover new challenges
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Competitions</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Medal className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Awards Won</p>
                <p className="text-2xl font-bold text-gray-900">5</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Ranking</p>
                <p className="text-2xl font-bold text-gray-900">#47</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Competitions */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Active Competitions
              </h2>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <Target className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No active competitions</h3>
                <p className="text-gray-600 mb-6">
                  You're not currently participating in any competitions. Browse available competitions to get started.
                </p>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Browse Competitions
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Enrolled Courses</p>
                <p className="text-2xl font-bold text-gray-900">{enrolledCourses.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Video className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Mentorships</p>
                <p className="text-2xl font-bold text-gray-900">{bookedMentorships.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Enrolled Courses */}
        <div className="mb-8 bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              My Courses
            </h2>
          </div>
          <div className="p-6">
            {loading ? (
              <p>Loading...</p>
            ) : enrolledCourses.length === 0 ? (
              <p className="text-gray-600">You haven’t enrolled in any courses yet.</p>
            ) : (
              <ul className="space-y-3">
                {enrolledCourses.map(course => (
                  <li key={course.id} className="border rounded p-3 hover:bg-gray-50">
                    <div className="font-semibold">{course.title}</div>
                    <p className="text-sm text-gray-600">{course.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Booked Mentorships */}
        <div className="mb-8 bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Video className="h-5 w-5 mr-2" />
              My Mentorships
            </h2>
          </div>
          <div className="p-6">
            {loading ? (
              <p>Loading...</p>
            ) : bookedMentorships.length === 0 ? (
              <p className="text-gray-600">You haven’t booked any mentorships yet.</p>
            ) : (
              <ul className="space-y-3">
                {bookedMentorships.map(m => (
                  <li key={m.id} className="border rounded p-3 hover:bg-gray-50">
                    <div className="font-semibold">{m.title}</div>
                    <p className="text-sm text-gray-600">
                      {m.slot.starts_at ? new Date(m.slot.starts_at).toLocaleString() : 'TBD'} – 
                      {m.slot.ends_at ? new Date(m.slot.ends_at).toLocaleString() : 'TBD'}
                    </p>
                    {m.metadata?.meeting_link && (
                      <a
                        href={m.metadata.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline text-sm mt-1 inline-block"
                      >
                        Join Session
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Recent Activity
              </h2>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h3>
                <p className="text-gray-600">
                  Your competition activity will appear here once you start participating.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to compete?</h2>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Discover competitions that match your interests and skills. Challenge yourself and compete with participants from around the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                Browse All Competitions
              </button>
              <button className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-400 transition-colors border border-blue-400">
                View Leaderboards
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
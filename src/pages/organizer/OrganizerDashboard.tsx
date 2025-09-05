// import React, { useState, useEffect } from 'react'
// import { Plus, Trophy, Users, Calendar, BarChart3, Eye, Edit, Trash2 } from 'lucide-react'
// import { Layout } from '../../components/layout/Layout'
// import { CreateCompetitionModal } from '../../components/modals/CreateCompetitionModal'
// import { useAuth } from '../../contexts/AuthContext'
// import { supabase } from '../../lib/supabase'

// interface Competition {
//   id: string
//   title: string
//   description: string | null
//   start_date: string
//   end_date: string
//   registration_deadline: string
//   min_team_size: number
//   max_team_size: number 
//   prize_pool_cents: number
//   prize_currency: string
//   organizer_id: string
//   created_at: string
// }

// export const OrganizerDashboard: React.FC = () => {
//   const { user, profile } = useAuth()
//   const [competitions, setCompetitions] = useState<Competition[]>([])
//   const [loading, setLoading] = useState(true)
//   const [showCreateModal, setShowCreateModal] = useState(false)

//   useEffect(() => {
//     fetchCompetitions()
//   }, [user])

//   const fetchCompetitions = async () => {
//     if (!user) return

//     setLoading(true)
//     try {
//       const { data, error } = await supabase
//         .from('competitions')
//         .select('*')
//         .eq('organizer_id', user.id)
//         .order('created_at', { ascending: false })

//       if (error) {
//         console.error('Error fetching competitions:', error)
//         // Don't throw here, just log and show empty state
//       } else {
//         setCompetitions(data || [])
//       }
//     } catch (error) {
//       console.error('Error fetching competitions:', error)
//     } finally {
//       setLoading(false)
//     }
//   }

//   const handleCreateSuccess = async () => {
//     try {
//       await fetchCompetitions()
//     } catch (error) {
//       console.error('Error refreshing competitions:', error)
//       // Still refresh the list even if there's an error
//       setTimeout(() => {
//         fetchCompetitions()
//       }, 1000)
//     }
//   }
//   // const getStatusColor = (status: string) => {
//   //   switch (status) {
//   //     case 'draft':
//   //       return 'bg-gray-100 text-gray-800'
//   //     case 'published':
//   //       return 'bg-blue-100 text-blue-800'
//   //     case 'active':
//   //       return 'bg-green-100 text-green-800'
//   //     case 'completed':
//   //       return 'bg-purple-100 text-purple-800'
//   //     default:
//   //       return 'bg-gray-100 text-gray-800'
//   //   }
//   // }

//   const formatDate = (dateString: string) => {
//     return new Date(dateString).toLocaleDateString('en-US', {
//       month: 'short',
//       day: 'numeric',
//       year: 'numeric'
//     })
//   }

//   // const getCompetitionStats = () => {
//   //   const total = competitions.length
//   //   const published = competitions.filter(c => c.status === 'published').length
//   //   const active = competitions.filter(c => c.status === 'active').length
//   //   const draft = competitions.filter(c => c.status === 'draft').length

//   //   return { total, published, active, draft }
//   // }

//   //const stats = getCompetitionStats()

//   return (
//     <Layout showSidebar>
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//         {/* Header */}
//         <div className="flex justify-between items-center mb-8">
//           <div>
//             <h1 className="text-3xl font-bold text-gray-900">
//               Welcome back, {profile?.full_name}!
//             </h1>
//             <p className="text-gray-600 mt-1">Manage your competitions and track their performance</p>
//           </div>
//           <button
//             onClick={() => setShowCreateModal(true)}
//             className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
//           >
//             <Plus className="h-5 w-5 mr-2" />
//             Create Competition
//           </button>
//         </div>

//         {/* Stats Cards */}
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//           <div className="bg-white rounded-lg shadow-md p-6">
//             <div className="flex items-center">
//               <Trophy className="h-8 w-8 text-blue-600" />
//               <div className="ml-4">
//                 <p className="text-sm font-medium text-gray-500">Total Competitions</p>
//                 <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white rounded-lg shadow-md p-6">
//             <div className="flex items-center">
//               <Eye className="h-8 w-8 text-green-600" />
//               <div className="ml-4">
//                 <p className="text-sm font-medium text-gray-500">Published</p>
//                 <p className="text-2xl font-bold text-gray-900">{stats.published}</p>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white rounded-lg shadow-md p-6">
//             <div className="flex items-center">
//               <BarChart3 className="h-8 w-8 text-purple-600" />
//               <div className="ml-4">
//                 <p className="text-sm font-medium text-gray-500">Active</p>
//                 <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white rounded-lg shadow-md p-6">
//             <div className="flex items-center">
//               <Edit className="h-8 w-8 text-gray-600" />
//               <div className="ml-4">
//                 <p className="text-sm font-medium text-gray-500">Drafts</p>
//                 <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Competitions List */}
//         <div className="bg-white rounded-lg shadow-md">
//           <div className="px-6 py-4 border-b border-gray-200">
//             <h2 className="text-lg font-semibold text-gray-900">Your Competitions</h2>
//           </div>

//           {loading ? (
//             <div className="p-6 text-center">
//               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
//               <p className="text-gray-500 mt-2">Loading competitions...</p>
//             </div>
//           ) : competitions.length === 0 ? (
//             <div className="p-12 text-center">
//               <Trophy className="h-16 w-16 text-gray-300 mx-auto mb-4" />
//               <h3 className="text-lg font-medium text-gray-900 mb-2">No competitions yet</h3>
//               <p className="text-gray-600 mb-6">
//                 Get started by creating your first competition. It's easy and takes just a few minutes.
//               </p>
//               <button
//                 onClick={() => setShowCreateModal(true)}
//                 className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
//               >
//                 <Plus className="h-5 w-5 mr-2" />
//                 Create Your First Competition
//               </button>
//             </div>
//           ) : (
//             <div className="divide-y divide-gray-200">
//               {competitions.map((competition) => (
//                 <div key={competition.id} className="p-6 hover:bg-gray-50 transition-colors">
//                   <div className="flex items-center justify-between">
//                     <div className="flex-1">
//                       <div className="flex items-center space-x-3 mb-2">
//                         <h3 className="text-lg font-semibold text-gray-900">{competition.title}</h3>
//                         <span
//                           className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(
//                             competition.status
//                           )}`}
//                         >
//                           {competition.status}
//                         </span>
//                       </div>
                      
//                       {competition.description && (
//                         <p className="text-gray-600 mb-3 line-clamp-2">{competition.description}</p>
//                       )}
                      
//                       <div className="flex items-center space-x-6 text-sm text-gray-500">
//                         <div className="flex items-center">
//                           <Calendar className="h-4 w-4 mr-1" />
//                           <span>{formatDate(competition.start_date)} - {formatDate(competition.end_date)}</span>
//                         </div>
//                         {competition.max_participants && (
//                           <div className="flex items-center">
//                             <Users className="h-4 w-4 mr-1" />
//                             <span>Max {competition.max_participants} participants</span>
//                           </div>
//                         )}
//                         {competition.prize_pool > 0 && (
//                           <div className="flex items-center">
//                             <Trophy className="h-4 w-4 mr-1" />
//                             <span>${competition.prize_pool.toFixed(2)} prize pool</span>
//                           </div>
//                         )}
//                       </div>
//                     </div>

//                     <div className="flex items-center space-x-2 ml-4">
//                       <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
//                         <Eye className="h-5 w-5" />
//                       </button>
//                       <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
//                         <Edit className="h-5 w-5" />
//                       </button>
//                       <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
//                         <Trash2 className="h-5 w-5" />
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>

//         {/* Create Competition Modal */}
//         <CreateCompetitionModal
//           isOpen={showCreateModal}
//           onClose={() => setShowCreateModal(false)}
//           onSuccess={handleCreateSuccess}
//         />
//       </div>
//     </Layout>
//   )
// }



import React, { useState, useEffect } from 'react'
import { Plus, Trophy, Users, Calendar, Eye, Edit, Trash2 } from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { CreateCompetitionModal } from '../../components/modals/CreateCompetitionModal'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

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

export const OrganizerDashboard: React.FC = () => {
  const { user, profile } = useAuth()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchCompetitions()
  }, [user])

  const fetchCompetitions = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching competitions:', error)
      } else {
        setCompetitions(data || [])
      }
    } catch (error) {
      console.error('Error fetching competitions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuccess = async () => {
    try {
      await fetchCompetitions()
    } catch (error) {
      console.error('Error refreshing competitions:', error)
      setTimeout(() => {
        fetchCompetitions()
      }, 1000)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <Layout showSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {profile?.full_name}!
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your competitions and track their performance
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Competition
          </button>
        </div>

        {/* Competitions List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Competitions</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading competitions...</p>
            </div>
          ) : competitions.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No competitions yet</h3>
              <p className="text-gray-600 mb-6">
                Get started by creating your first competition. It's easy and takes just a few minutes.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Competition
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {competitions.map((competition) => (
                <div key={competition.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {competition.title}
                        </h3>
                      </div>

                      {competition.description && (
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {competition.description}
                        </p>
                      )}

                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>
                            {formatDate(competition.start_date)} -{' '}
                            {formatDate(competition.end_date)}
                          </span>
                        </div>
                        {competition.max_team_size && (
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>Max team size {competition.max_team_size}</span>
                          </div>
                        )}
                        {competition.prize_pool_cents > 0 && (
                          <div className="flex items-center">
                            <Trophy className="h-4 w-4 mr-1" />
                            <span>
                              {competition.prize_currency}{' '}
                              {(competition.prize_pool_cents / 100).toFixed(2)} prize pool
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <Edit className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Competition Modal */}
        <CreateCompetitionModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      </div>
    </Layout>
  )
}

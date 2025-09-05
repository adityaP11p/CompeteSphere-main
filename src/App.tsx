import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'

// Pages
import { PublicCompetitionCatalog } from './pages/PublicCompetitionCatalog'
import { Profile } from './pages/Profile'
//import { TeamFinder } from './pages/TeamFinder'
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { OrganizerDashboard } from './pages/organizer/OrganizerDashboard'
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard'
import { CompetitionDetails } from './pages/CompetitionDetails'
import TeamInvitations from './pages/TeamInvitations'
import TeamJoinRequests from './pages/TeamJoinRequests'
import LearningGrid from './components/LearningGrid'
import AdminPage from './pages/Admin'
import CreatorDashboard from './pages/CreatorDashboard'
// 404 Page Component
const NotFound: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-gray-600 mb-6">Page not found</p>
      <button
        onClick={() => window.location.href = '/'}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        Go Home
      </button>
    </div>
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
        
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicCompetitionCatalog />} />
            <Route path="/competition/:id" element={<CompetitionDetails />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            {/* <Route path="/teams/:competitionId" element={<TeamFinder />} /> */}
            <Route path="/learning" element={<LearningGrid />} />
            {/* <Route path="/admin" element={<AdminPage />} /> */}
            {/* Protected Routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Protected Organizer Routes */}
            <Route
              path="/organizer/dashboard"
              element={
                <ProtectedRoute requiredRole="organizer">
                  <OrganizerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/*"
              element={
                <ProtectedRoute requiredRole="organizer">
                  <Navigate to="/organizer/dashboard" replace />
                </ProtectedRoute>
              }
            />

            {/* Protected Participant Routes */}
            <Route
              path="/participant/dashboard"
              element={
                <ProtectedRoute requiredRole="student">
                  <ParticipantDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/*"
              element={
                <ProtectedRoute requiredRole="student">
                  <Navigate to="/participant/dashboard" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/team-invitations"
              element={
                <ProtectedRoute requiredRole="student">
                  <TeamInvitations/>
                </ProtectedRoute>
              }
            />

            <Route
              path="/team-join-requests"
              element={
                <ProtectedRoute requiredRole="student">
                  <TeamJoinRequests/>
                </ProtectedRoute>
              }
            />
            {/* Protected Mentor Routes */}
            <Route
              path="/mentor/*"
              element={
                <ProtectedRoute requiredRole="mentor">
                  <Navigate to="/mentor/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mentor/dashboard"
              element={
                <ProtectedRoute requiredRole="mentor">
                  <CreatorDashboard />
                </ProtectedRoute>
              }
            />
            


            {/* Catch all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
      
    </ErrorBoundary>
  )
}

export default App
import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Trophy, 
  Users, 
  Calendar, 
  Settings, 
  BarChart3,
  Medal,
  Target
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ open, setOpen }) => {
  const { profile } = useAuth()
  const location = useLocation()

  const organizerNavItems = [
    { name: 'Dashboard', href: '/organizer/dashboard', icon: LayoutDashboard },
    { name: 'My Competitions', href: '/organizer/competitions', icon: Trophy },
    { name: 'Participants', href: '/organizer/participants', icon: Users },
    { name: 'Analytics', href: '/organizer/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/organizer/settings', icon: Settings },
  ]

  const participantNavItems = [
    { name: 'Dashboard', href: '/participant/dashboard', icon: LayoutDashboard },
    { name: 'My Competitions', href: '/participant/competitions', icon: Target },
    { name: 'Leaderboards', href: '/participant/leaderboards', icon: Medal },
    { name: 'Calendar', href: '/participant/calendar', icon: Calendar },
    { name: 'Settings', href: '/participant/settings', icon: Settings },
  ]

  const navItems = profile?.role === 'organizer' ? organizerNavItems : participantNavItems

  const isActive = (href: string) => location.pathname === href

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity lg:hidden z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {profile?.role === 'organizer' ? 'Organizer Portal' : 'Participant Portal'}
              </h2>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 transition-colors ${
                      isActive(item.href) ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'
                    }`}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm font-medium">
                  {profile?.full_name?.[0] || profile?.email?.[0] || 'U'}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
import React, { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../contexts/AuthContext'

interface LayoutProps {
  children: React.ReactNode
  showSidebar?: boolean
}

export const Layout: React.FC<LayoutProps> = ({ children, showSidebar = false }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  const shouldShowSidebar = showSidebar && user

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        sidebarOpen={shouldShowSidebar ? sidebarOpen : undefined}
        setSidebarOpen={shouldShowSidebar ? setSidebarOpen : undefined}
      />
      
      <div className="flex">
        {shouldShowSidebar && (
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        )}
        
        <main className={`flex-1 ${shouldShowSidebar ? 'lg:ml-0' : ''}`}>
          <div className="py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
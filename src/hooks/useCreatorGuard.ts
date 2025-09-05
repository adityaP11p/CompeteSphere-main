// src/hooks/useCreatorGuard.ts
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Guard that ensures:
 *  - user is authenticated (via supabase.auth)
 *  - profile exists in `profiles` table
 *  - profile.role === 'mentor' (optional, change if you only want creators table check)
 *  - creators row exists for this profile.id (optional)
 *
 * Behavior: redirects to /auth/login if not logged in; redirects to / (home) if not a mentor/creator.
 */
export function useCreatorGuard() {
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const check = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const session = sessionData?.session ?? null

        if (!session) {
          // Not logged in
          navigate('/auth/login')
          return
        }

        const userId = session.user.id // auth UID, equals profiles.id in your schema
        console.debug('useCreatorGuard: auth user id =', userId)

        // Fetch profile from profiles table (this is required, since creators.user_id references profiles.id)
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        console.debug('useCreatorGuard: profile:', profile, 'error:', profileErr)

        if (profileErr || !profile) {
          // No profile row -> treat as not-authorized
          navigate('/')
          return
        }

        // Option A: If you want to gate purely on profile.role === 'mentor'
        if (profile.role !== 'mentor') {
          // Not a mentor role
          console.debug('useCreatorGuard: profile.role !== mentor:', profile.role)
          navigate('/')
          return
        }

        // Option B (extra safety): ensure a creators row exists for this profile id
        const { data: creatorRow, error: creatorErr } = await supabase
          .from('creators')
          .select('*')
          .eq('user_id', profile.id)
          .single()

        console.debug('useCreatorGuard: creatorRow:', creatorRow, 'error:', creatorErr)

        if (creatorErr || !creatorRow) {
          // If you want to auto-create creators on-demand, you could insert here.
          // For now: redirect if no creators row.
          navigate('/')
          return
        }

        // Passed all checks -> allow access
      } catch (err) {
        console.error('useCreatorGuard error:', err)
        navigate('/')
      }
    }

    if (mounted) check()

    return () => {
      mounted = false
    }
  }, [navigate])
}

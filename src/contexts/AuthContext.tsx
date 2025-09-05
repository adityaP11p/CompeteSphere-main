// import React, { createContext, useContext, useEffect, useState } from 'react'
// import { User, Session } from '@supabase/supabase-js'
// import { supabase } from '../lib/supabase'

// interface Profile {
//   id: string
//   email: string
//   full_name: string | null
//   role: 'organizer' | 'participant'
//   avatar_url: string | null
//   institution: string | null
//   skill_tier: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null
//   bio: string | null
//   social_links: any
//   created_at: string
//   updated_at: string
// }

// interface AuthContextType {
//   user: User | null
//   profile: Profile | null
//   session: Session | null
//   loading: boolean
//   error: string | null
//   signIn: (email: string, password: string) => Promise<{ error: any }>
//   signUp: (email: string, password: string, fullName: string, role: 'organizer' | 'participant') => Promise<{ error: any }>
//   signInWithGoogle: () => Promise<{ error: any }>
//   signOut: () => Promise<void>
//   updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>
//   refreshProfile: () => Promise<void>
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined)

// export const useAuth = () => {
//   const context = useContext(AuthContext)
//   if (!context) {
//     throw new Error('useAuth must be used within an AuthProvider')
//   }
//   return context
// }

// export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const [user, setUser] = useState<User | null>(null)
//   const [profile, setProfile] = useState<Profile | null>(null)
//   const [session, setSession] = useState<Session | null>(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)

//   useEffect(() => {
//     let mounted = true
    
//     // Get initial session
//     supabase.auth.getSession().then(({ data: { session } }) => {
//       if (mounted) {
//         setSession(session)
//         setUser(session?.user ?? null)
//         if (session?.user) {
//           fetchProfile(session.user.id)
//         } else {
//           setLoading(false)
//         }
//       }
//     })

//     // Listen for auth changes
//     const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
//       if (mounted) {
//         console.log('Auth state change:', event, session?.user?.id)
//         setError(null) // Clear any previous errors
//         setSession(session)
//         setUser(session?.user ?? null)
        
//         if (session?.user) {
//           await fetchProfile(session.user.id)
//         } else {
//           setProfile(null)
//           setLoading(false)
//         }
//       }
//     })

//     return () => {
//       mounted = false
//       subscription.unsubscribe()
//     }
//   }, [])

//   const fetchProfile = async (userId: string) => {
//     try {
//       setError(null)
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('*')
//         .eq('id', userId)
//         .single()

//       if (error) {
//         console.error('Error fetching profile:', error)
//         setError(`Failed to load profile: ${error.message}`)
//       } else {
//         setProfile(data)
//       }
//     } catch (error) {
//       console.error('Error fetching profile:', error)
//       setError('Failed to load profile')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const refreshProfile = async () => {
//     if (user) {
//       await fetchProfile(user.id)
//     }
//   }
//   const signIn = async (email: string, password: string) => {
//     setError(null)
//     const { error } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     })
//     if (error) {
//       setError(error.message)
//     }
//     return { error }
//   }

//   const signUp = async (email: string, password: string, fullName: string, role: 'organizer' | 'participant') => {
//     setError(null)
//     const { data, error } = await supabase.auth.signUp({
//       email,
//       password,
//       options: {
//         data: {
//           full_name: fullName,
//           role: role,
//         },
//       },
//     })

//     if (!error && data.user) {
//       // Create profile
//       const { error: profileError } = await supabase
//         .from('profiles')
//         .insert([
//           {
//             id: data.user.id,
//             email: email,
//             full_name: fullName,
//             role: role,
//           },
//         ])

//       if (profileError) {
//         console.error('Error creating profile:', profileError)
//         setError(`Failed to create profile: ${profileError.message}`)
//         return { error: profileError }
//       }
//     }

//     if (error) {
//       setError(error.message)
//     }
//     return { error }
//   }

//   const signInWithGoogle = async () => {
//     setError(null)
//     const { error } = await supabase.auth.signInWithOAuth({
//       provider: 'google',
//       options: {
//         redirectTo: `${window.location.origin}/auth/callback`,
//       },
//     })
//     if (error) {
//       setError(error.message)
//     }
//     return { error }
//   }

//   const signOut = async () => {
//     try {
//       setError(null)
//       const { error } = await supabase.auth.signOut()
//       if (error) {
//         console.error('Sign out error:', error)
//         setError(error.message)
//       }
//       // Clear local state regardless of API response
//       setUser(null)
//       setProfile(null)
//       setSession(null)
//     } catch (error) {
//       console.error('Sign out error:', error)
//       setError('Failed to sign out')
//       // Still clear local state
//       setUser(null)
//       setProfile(null)
//       setSession(null)
//     }
//   }

//   const updateProfile = async (updates: Partial<Profile>) => {
//     if (!user) {
//       const error = new Error('No user logged in')
//       setError(error.message)
//       return { error }
//     }

//     setError(null)
//     const { error } = await supabase
//       .from('profiles')
//       .update(updates)
//       .eq('id', user.id)

//     if (!error) {
//       setProfile(prev => prev ? { ...prev, ...updates } : null)
//     } else {
//       setError(`Failed to update profile: ${error.message}`)
//     }

//     return { error }
//   }

//   const value = {
//     user,
//     profile,
//     session,
//     loading,
//     error,
//     signIn,
//     signUp,
//     signInWithGoogle,
//     signOut,
//     updateProfile,
//     refreshProfile,
//   }

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
// }

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';


interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'organizer' | 'mentor' | 'recruiter';  // ✅ match DB
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role: 'student' | 'organizer' | 'mentor' | 'recruiter') => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const getInitialSession = async () => {
      try {
        setError(null);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          // Only log actual errors, not 404s from missing sessions
          if (sessionError.status !== 404) {
            console.error('Session error:', sessionError);
            setError(sessionError.message);
          }
        }
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (error: any) {
        // Only handle actual errors, not 404s
        if (error.status !== 404) {
          console.error('Auth initialization error:', error);
          if (mounted) {
            setError(error.message || 'Authentication initialization failed');
            setLoading(false);
          }
        }
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id);
      if (mounted) {
        setError(null);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      setMounted(false);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!mounted) return;
    
    try {
      setError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setError(`Failed to load profile: ${error.message}`);
      } else {
        if (mounted) {
          setProfile(data as Profile);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (mounted) {
        setError('Failed to load profile');
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  const refreshProfile = async () => {
    if (user && mounted) {
      await fetchProfile(user.id);
    }
  };
  const signIn = async (email: string, password: string) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error && mounted) {
      setError(error.message);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'student' | 'organizer' | 'mentor' | 'recruiter') => {
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });

    if (!error && data.user) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            email: email,
            full_name: fullName,
            role: role,
          },
        ]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        if (mounted) {
          setError(`Failed to create profile: ${profileError.message}`);
        }
        return { error: profileError };
      }
    }

    if (error && mounted) {
      setError(error.message);
    }
    return { error };
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error && mounted) {
      setError(error.message);
    }
    return { error };
  };

  const signOut = async () => {
    try {
      setError(null);
      console.log('Attempting to sign out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      console.log('Successfully signed out.');
      
      // Clear local state immediately
      if (mounted) {
        setUser(null);
        setProfile(null);
        setSession(null);
      }
      
      // Navigate to home page
      window.location.href = '/';
    } catch (error: any) {
      console.error('Logout error:', error.message);
      if (mounted) {
        setError(`Logout failed: ${error.message}`);
        // Still clear local state
        setUser(null);
        setProfile(null);
        setSession(null);
      }
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      const error = new Error('No user logged in');
      if (mounted) {
        setError(error.message);
      }
      return { error };
    }

    setError(null);
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error && mounted) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    } else if (error && mounted) {
      setError(`Failed to update profile: ${error.message}`);
    }

    return { error };
  };

  const value = {
    user,
    profile,
    session,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;


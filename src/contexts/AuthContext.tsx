import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'organizer' | 'mentor' | 'recruiter';
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
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'student' | 'organizer' | 'mentor' | 'recruiter'
  ) => Promise<{ error: any }>;
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

  // ✅ Fetch profile
  const fetchProfile = async (userId: string) => {
    console.log("getSession fetching...");
    try{
      console.log(userId);
      
      //await supabase.auth.refreshSession();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      console.log("Profiles query completed:", { data, error });

      if (error) {
        console.error('Error fetching profile:', error);
        setError(`Failed to load profile: ${error.message}`);
        
      }else {
        if (!data) {
          console.warn("No profile found for user:", userId);
        }
        console.log("data fetched successfully"); 
        setProfile(data as Profile | null);
      }
      
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Refresh profile manually
  // const refreshProfile = async () => {
  //   await supabase.auth.refreshSession();
  //   if (user) {
  //     await fetchProfile(user.id);
  //   }
  // };
  const refreshProfile = async () => {

    try {
      
      console.log("profile is refreshing");
      
      const { data, error } = await supabase.auth.refreshSession();
    
      if (error) {
        console.error("Session refresh failed:", error);
        return;
      }
    
      const refreshedUser = data?.user || (await supabase.auth.getUser()).data.user;
    
      if (refreshedUser) {
        await fetchProfile(refreshedUser.id);
      }
    } catch (error) {
      console.error("error refreshing", error);
    }
};


  // ✅ Initialize auth
  // useEffect(() => {
  //   let isMounted = true;
  //   console.log("started!!");
    
  //   const initAuth = async () => {
  //     try {
  //       // Always try refreshing session
  //       console.log("Hello");
        
  //       //await supabase.auth.refreshSession();
  //       console.log("fetched refresh session ");
        
  //       const { data: { user }, error } = await supabase.auth.getUser();
  //       console.log("fetched session");
        
  //       if (error) console.error("getUser error:", error);
  //       setUser(user);
  //       setLoading(false);

  //       if (isMounted) {
  //         setSession(session);
  //         setUser(session?.user ?? null);

  //         if (session?.user) {
  //           console.log(session.user.id);
  //           console.log("will start fetching profile");
  //           await fetchProfile(session.user.id);
  //         }else {
  //         // ✅ Important: stop loading even if no session
  //           setLoading(false);
  //         }
  //       }
  //       console.log("profile fetched successfully");
        
  //     } catch (err: any) {
  //       console.error('Auth init error:', err);
  //       if (isMounted) {
  //         setError(err.message || 'Authentication initialization failed');
  //         setLoading(false);
  //       }

  //     } //finally {
  //     //   if (isMounted) setLoading(false);
  //     // }
  //   };

  //   initAuth();

  //   const { data: { subscription } } = supabase.auth.onAuthStateChange(
  //     async (_event, session) => {
  //       console.log("Hi");
        
  //       if (isMounted) {
  //         setError(null);
  //         setSession(session);
  //         setUser(session?.user ?? null);

  //         console.log(session?.user.id);
          
  //         if (session?.user) {
  //           await fetchProfile(session.user.id);
  //         } else {
  //           setProfile(null);
  //         }
  //         setLoading(false);
  //       }
  //     }
  //   );

  //   return () => {
  //     isMounted = false;
  //     subscription.unsubscribe();
  //   };
  // }, []);

  // ✅ Initialize auth
  useEffect(() => {
    let isMounted = true;
    console.log("started!!");

    // const initAuth = async () => {
    //   try {
    //     // getUser is safer than getSession at init
    //     const { data: { user }, error } = await supabase.auth.getUser();
    //     if (!isMounted) return;
    //     console.log("User found!!");
        
    //     if (error) {
    //       console.error("getUser error:", error);
    //       setError(error.message);
    //     }

    //     setUser(user);
    //     setLoading(false);

    //     if (user) {
    //       console.log("Fetching profile for:", user.id);
    //       await fetchProfile(user.id);
    //     }
    //   } catch (err: any) {
    //     console.error("Auth init error:", err);
    //     if (isMounted) {
    //       setError(err.message || "Authentication initialization failed");
    //     }
    //   } finally {
    //     if (isMounted) setLoading(false);
    //   }
    // };

    // initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;

        console.log("Auth event:", event, session);

        setError(null);
        setSession(session);
        setUser(session?.user ?? null);
        console.log("mil gya session");
        console.log(session?.user.id);
        
        if (session?.user) {
          console.log("Profile refresh after auth event");
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);


  // ✅ Auth methods
  const signIn = async (email: string, password: string) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    console.log("Sign-in session:", data.session);
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'student' | 'organizer' | 'mentor' | 'recruiter'
  ) => {
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });

    if (!error && data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: data.user.id, email, full_name: fullName, role }]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        setError(`Failed to create profile: ${profileError.message}`);
        return { error: profileError };
      }
    }

    if (error) setError(error.message);
    return { error };
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    return { error };
  };

  const signOut = async () => {
    try {
      setError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setProfile(null);
      setSession(null);

      window.location.href = '/';
    } catch (err: any) {
      console.error('Logout error:', err.message);
      setError(`Logout failed: ${err.message}`);
      setUser(null);
      setProfile(null);
      setSession(null);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      const error = new Error('No user logged in');
      setError(error.message);
      return { error };
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

    if (!error) {
      setProfile(prev => (prev ? { ...prev, ...updates } : null));
    } else {
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

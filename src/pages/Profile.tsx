import React, { useState, useEffect } from 'react';
import { User, MapPin, Edit2, Save, X, Github, Twitter, Linkedin, Globe, Star } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Profile shape according to Supabase schema
interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'organizer' | 'mentor' | 'recruiter';  // ✅ match DB
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        setError('User not authenticated.');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        if (data) setProfile(data as ProfileData);
        else setError('No user profile found.');
      } catch (e: any) {
        console.error("Error fetching profile: ", e);
        setError("Failed to load profile data: " + e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-red-500">{error}</p>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Profile not available.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* User Card */}
        <div className="bg-white rounded-lg shadow-md mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900">User Profile</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center space-x-4 mb-4">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="avatar" 
                  className="w-16 h-16 rounded-full object-cover" 
                />
              ) : (
                <User size={48} className="text-gray-500" />
              )}
              <div>
                <p className="text-xl font-bold">{profile.full_name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>

            {/* Extra profile info */}
            <div className="mt-4 text-sm text-gray-700 space-y-1">
              {profile.role && (
                <p><strong>Role:</strong> {profile.role}</p>
              )}
              <p><strong>Joined:</strong> {new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}

export default Profile;

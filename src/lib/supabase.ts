import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// export type Database = {
//   public: {
//     Tables: {
//       profiles: {
//         Row: {
//           id: string
//           email: string
//           full_name: string | null
//           role: string | null
//           avatar_url: string | null
//           created_at: string
//           updated_at: string
//         }
//         Insert: {
//           id: string
//           email: string
//           full_name?: string | null
//           role?: string | null
//           avatar_url?: string | null
//           created_at?: string
//           updated_at?: string
//         }
//         Update: {
//           id?: string
//           email?: string
//           full_name?: string | null
//           role?: string | null
//           avatar_url?: string | null
//           created_at?: string
//           updated_at?: string
//         }
//       }

//       competitions: {
//         Row: {
//           id: string
//           organizer_id: string
//           title: string
//           description: string | null
//           start_date: string
//           end_date: string
//           registration_deadline: string
//           min_team_size: number
//           max_team_size: number
//           tier: string | null
//           entry_fee_cents: number
//           currency: string
//           discord_guild_id: string | null
//           discord_category_id: string | null
//           prize_pool_cents: number | null
//           prize_currency: string | null
//           prize_summary: string | null
//           created_at: string
//           updated_at: string
//         }
//         Insert: {
//           id?: string
//           organizer_id: string
//           title: string
//           description?: string | null
//           start_date: string
//           end_date: string
//           registration_deadline: string
//           min_team_size: number
//           max_team_size: number
//           tier?: string | null
//           entry_fee_cents?: number
//           currency: string
//           discord_guild_id?: string | null
//           discord_category_id?: string | null
//           prize_pool_cents?: number | null
//           prize_currency?: string | null
//           prize_summary?: string | null
//           created_at?: string
//           updated_at?: string
//         }
//         Update: {
//           id?: string
//           organizer_id?: string
//           title?: string
//           description?: string | null
//           start_date?: string
//           end_date?: string
//           registration_deadline?: string
//           min_team_size?: number
//           max_team_size?: number
//           tier?: string | null
//           entry_fee_cents?: number
//           currency?: string
//           discord_guild_id?: string | null
//           discord_category_id?: string | null
//           prize_pool_cents?: number | null
//           prize_currency?: string | null
//           prize_summary?: string | null
//           created_at?: string
//           updated_at?: string
//         }
//       }

//       prize_distributions: {
//         Row: {
//           id: string
//           competition_id: string
//           member_id: string
//           share_percent: number
//           payout_amount_cents: number
//           processed: boolean
//           created_at: string
//         }
//         Insert: {
//           id?: string
//           competition_id: string
//           member_id: string
//           share_percent: number
//           payout_amount_cents: number
//           processed?: boolean
//           created_at?: string
//         }
//         Update: {
//           id?: string
//           competition_id?: string
//           member_id?: string
//           share_percent?: number
//           payout_amount_cents?: number
//           processed?: boolean
//           created_at?: string
//         }
//       }
//     }
//   }
// }

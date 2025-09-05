import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Find competitions that should start tracking today
    const { data: startingCompetitions, error: startError } = await supabaseClient
      .from('competitions')
      .select('id, title, start_date')
      .eq('status', 'published')
      .lte('start_date', now)
      .is('tracking_started', null)

    if (startError) {
      throw new Error(`Failed to fetch starting competitions: ${startError.message}`)
    }

    // Find competitions that need daily updates
    const { data: activeCompetitions, error: activeError } = await supabaseClient
      .from('competitions')
      .select('id, title')
      .eq('status', 'active')
      .lte('start_date', now)
      .gte('end_date', now)

    if (activeError) {
      throw new Error(`Failed to fetch active competitions: ${activeError.message}`)
    }

    // Find competitions that should be finalized
    const { data: endingCompetitions, error: endError } = await supabaseClient
      .from('competitions')
      .select('id, title, end_date')
      .eq('status', 'active')
      .lte('end_date', now)

    if (endError) {
      throw new Error(`Failed to fetch ending competitions: ${endError.message}`)
    }

    const results = {
      started: [],
      updated: [],
      finalized: [],
      errors: []
    }

    // Process starting competitions in parallel
    if (startingCompetitions && startingCompetitions.length > 0) {
      const startPromises = startingCompetitions.map(async (competition: any) => {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/competition-automation`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'start_tracking',
              competitionId: competition.id
            })
          })

          if (response.ok) {
            // Mark as tracking started
            await supabaseClient
              .from('competitions')
              .update({ 
                status: 'active',
                tracking_started: now 
              })
              .eq('id', competition.id)

            results.started.push({
              id: competition.id,
              title: competition.title,
              success: true
            })
          } else {
            throw new Error(`HTTP ${response.status}`)
          }
        } catch (error) {
          results.errors.push({
            competition: competition.title,
            action: 'start_tracking',
            error: error.message
          })
        }
      })

      await Promise.all(startPromises)
    }

    // Process daily updates in parallel
    if (activeCompetitions && activeCompetitions.length > 0) {
      const updatePromises = activeCompetitions.map(async (competition: any) => {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/competition-automation`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'daily_update',
              competitionId: competition.id,
              date: today
            })
          })

          if (response.ok) {
            results.updated.push({
              id: competition.id,
              title: competition.title,
              success: true
            })
          } else {
            throw new Error(`HTTP ${response.status}`)
          }
        } catch (error) {
          results.errors.push({
            competition: competition.title,
            action: 'daily_update',
            error: error.message
          })
        }
      })

      await Promise.all(updatePromises)
    }

    // Process finalizing competitions in parallel
    if (endingCompetitions && endingCompetitions.length > 0) {
      const finalizePromises = endingCompetitions.map(async (competition: any) => {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/competition-automation`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'finalize_competition',
              competitionId: competition.id
            })
          })

          if (response.ok) {
            results.finalized.push({
              id: competition.id,
              title: competition.title,
              success: true
            })
          } else {
            throw new Error(`HTTP ${response.status}`)
          }
        } catch (error) {
          results.errors.push({
            competition: competition.title,
            action: 'finalize_competition',
            error: error.message
          })
        }
      })

      await Promise.all(finalizePromises)
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Competition scheduler error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Competition scheduler failed' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
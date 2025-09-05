import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CompetitionAutomationRequest {
  action: 'start_tracking' | 'daily_update' | 'finalize_competition'
  competitionId: string
  date?: string
}

interface GitCommitData {
  participantId: string
  repoUrl: string
  commitCount: number
  date: string
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

    const { action, competitionId, date }: CompetitionAutomationRequest = await req.json()

    let result: any

    switch (action) {
      case 'start_tracking':
        result = await startCompetitionTracking(supabaseClient, competitionId)
        break
      case 'daily_update':
        result = await performDailyUpdate(supabaseClient, competitionId, date || new Date().toISOString().split('T')[0])
        break
      case 'finalize_competition':
        result = await finalizeCompetition(supabaseClient, competitionId)
        break
      default:
        throw new Error('Invalid action specified')
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Competition automation error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Competition automation failed' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function startCompetitionTracking(supabaseClient: any, competitionId: string) {
  console.log(`Starting tracking for competition: ${competitionId}`)
  
  // Verify competition exists and is starting
  const { data: competition, error: compError } = await supabaseClient
    .from('competitions')
    .select('*')
    .eq('id', competitionId)
    .single()

  if (compError || !competition) {
    throw new Error('Competition not found')
  }

  // Get all participants for this competition
  const { data: participants, error: partError } = await supabaseClient
    .from('competition_participants')
    .select('*')
    .eq('competition_id', competitionId)
    .eq('status', 'active')

  if (partError) {
    throw new Error(`Failed to fetch participants: ${partError.message}`)
  }

  if (!participants || participants.length === 0) {
    return { message: 'No active participants found', participantCount: 0 }
  }

  // Initialize commit metrics for the start date
  const startDate = new Date(competition.start_date).toISOString().split('T')[0]
  
  const initialMetrics = participants.map(participant => ({
    competition_id: competitionId,
    participant_id: participant.participant_id,
    date: startDate,
    commit_count: 0,
    commit_percentage: 0.00,
    total_competition_commits: 0
  }))

  // Insert initial metrics (idempotent)
  const { error: metricsError } = await supabaseClient
    .from('commit_metrics')
    .upsert(initialMetrics, { 
      onConflict: 'competition_id,participant_id,date',
      ignoreDuplicates: true 
    })

  if (metricsError) {
    throw new Error(`Failed to initialize metrics: ${metricsError.message}`)
  }

  return {
    message: 'Competition tracking started',
    participantCount: participants.length,
    startDate
  }
}

async function performDailyUpdate(supabaseClient: any, competitionId: string, date: string) {
  console.log(`Performing daily update for competition: ${competitionId}, date: ${date}`)
  
  // Get all participants with their repo URLs
  const { data: participants, error: partError } = await supabaseClient
    .from('competition_participants')
    .select('participant_id, repo_url')
    .eq('competition_id', competitionId)
    .eq('status', 'active')

  if (partError || !participants) {
    throw new Error('Failed to fetch participants')
  }

  // Fetch commit data for all participants in parallel
  const commitDataPromises = participants.map(async (participant: any) => {
    try {
      const commitCount = await fetchGitCommitCount(participant.repo_url, date)
      return {
        participantId: participant.participant_id,
        repoUrl: participant.repo_url,
        commitCount,
        date
      }
    } catch (error) {
      console.error(`Failed to fetch commits for ${participant.repo_url}:`, error)
      return {
        participantId: participant.participant_id,
        repoUrl: participant.repo_url,
        commitCount: 0,
        date
      }
    }
  })

  const commitData = await Promise.all(commitDataPromises)
  
  // Calculate total commits for percentage calculation
  const totalCommits = commitData.reduce((sum, data) => sum + data.commitCount, 0)
  
  // Prepare metrics data with percentages
  const metricsData = commitData.map(data => ({
    competition_id: competitionId,
    participant_id: data.participantId,
    date: date,
    commit_count: data.commitCount,
    commit_percentage: totalCommits > 0 ? Number(((data.commitCount / totalCommits) * 100).toFixed(2)) : 0,
    total_competition_commits: totalCommits
  }))

  // Upsert metrics (idempotent)
  const { error: metricsError } = await supabaseClient
    .from('commit_metrics')
    .upsert(metricsData, { 
      onConflict: 'competition_id,participant_id,date' 
    })

  if (metricsError) {
    throw new Error(`Failed to update metrics: ${metricsError.message}`)
  }

  // Clean up temporary data
  await cleanupTempFiles()

  return {
    message: 'Daily update completed',
    date,
    participantCount: participants.length,
    totalCommits,
    metricsUpdated: metricsData.length
  }
}

async function finalizeCompetition(supabaseClient: any, competitionId: string) {
  console.log(`Finalizing competition: ${competitionId}`)
  
  // Get competition details including prize pool
  const { data: competition, error: compError } = await supabaseClient
    .from('competitions')
    .select('prize_pool, end_date')
    .eq('id', competitionId)
    .single()

  if (compError || !competition) {
    throw new Error('Competition not found')
  }

  // Calculate total commits per participant across all days
  const { data: commitSummary, error: summaryError } = await supabaseClient
    .from('commit_metrics')
    .select('participant_id, commit_count')
    .eq('competition_id', competitionId)

  if (summaryError) {
    throw new Error(`Failed to fetch commit summary: ${summaryError.message}`)
  }

  // Aggregate commits per participant
  const participantTotals = new Map<string, number>()
  
  commitSummary?.forEach((metric: any) => {
    const current = participantTotals.get(metric.participant_id) || 0
    participantTotals.set(metric.participant_id, current + metric.commit_count)
  })

  // Calculate total commits across all participants
  const grandTotal = Array.from(participantTotals.values()).reduce((sum, count) => sum + count, 0)
  
  // Prepare prize distribution data
  const prizeDistributions = Array.from(participantTotals.entries()).map(([participantId, totalCommits]) => {
    const commitPercentage = grandTotal > 0 ? Number(((totalCommits / grandTotal) * 100).toFixed(2)) : 0
    const prizeAmount = Number(((competition.prize_pool * commitPercentage) / 100).toFixed(2))
    
    return {
      competition_id: competitionId,
      participant_id: participantId,
      total_commits: totalCommits,
      commit_percentage: commitPercentage,
      prize_amount: prizeAmount,
      prize_pool_total: competition.prize_pool,
      calculated_at: new Date().toISOString(),
      status: 'pending'
    }
  })

  // Insert prize distributions (idempotent)
  const { error: prizeError } = await supabaseClient
    .from('prize_distributions')
    .upsert(prizeDistributions, { 
      onConflict: 'competition_id,participant_id' 
    })

  if (prizeError) {
    throw new Error(`Failed to calculate prizes: ${prizeError.message}`)
  }

  // Update competition status to completed
  const { error: statusError } = await supabaseClient
    .from('competitions')
    .update({ status: 'completed' })
    .eq('id', competitionId)

  if (statusError) {
    throw new Error(`Failed to update competition status: ${statusError.message}`)
  }

  // Clean up temporary files
  await cleanupTempFiles()

  return {
    message: 'Competition finalized',
    participantCount: participantTotals.size,
    totalCommits: grandTotal,
    totalPrizePool: competition.prize_pool,
    distributionsCalculated: prizeDistributions.length
  }
}

async function fetchGitCommitCount(repoUrl: string, date: string): Promise<number> {
  try {
    // Extract owner and repo from GitHub URL
    const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL')
    }

    const [, owner, repo] = repoMatch
    const cleanRepo = repo.replace(/\.git$/, '')

    // GitHub API headers
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CompeteSphere-CommitTracker'
    }

    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`
    }

    // Fetch commits for the specific date
    const since = `${date}T00:00:00Z`
    const until = `${date}T23:59:59Z`
    
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}/commits?since=${since}&until=${until}&per_page=100`,
      { headers }
    )

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Repository not found: ${repoUrl}`)
        return 0
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const commits = await response.json()
    return Array.isArray(commits) ? commits.length : 0

  } catch (error) {
    console.error(`Error fetching commits for ${repoUrl}:`, error)
    return 0
  }
}

async function cleanupTempFiles(): Promise<void> {
  try {
    // Clean up any temporary files in /tmp directory
    const tempDir = '/tmp'
    
    try {
      for await (const dirEntry of Deno.readDir(tempDir)) {
        if (dirEntry.isFile && dirEntry.name.startsWith('competition_')) {
          await Deno.remove(`${tempDir}/${dirEntry.name}`)
        }
      }
    } catch (error) {
      // Directory might not exist or be empty, which is fine
      console.log('No temp files to clean up')
    }
  } catch (error) {
    console.error('Error during cleanup:', error)
    // Don't throw - cleanup failures shouldn't break the main process
  }
}
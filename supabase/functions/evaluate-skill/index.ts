import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SkillEvaluationRequest {
  proofId: string
  proofType: 'github_repo' | 'file_upload'
  proofData: {
    url?: string
    fileName?: string
    fileContent?: string
  }
}

interface GitHubRepoStats {
  stars: number
  forks: number
  commits: number
  languages: Record<string, number>
  lastActivity: string
  description: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { proofId, proofType, proofData }: SkillEvaluationRequest = await req.json()

    let evaluationResult: any
    let tier: string

    if (proofType === 'github_repo' && proofData.url) {
      // Extract GitHub repo info from URL
      const repoMatch = proofData.url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
      if (!repoMatch) {
        throw new Error('Invalid GitHub repository URL')
      }

      const [, owner, repo] = repoMatch
      
      // Fetch repository statistics
      const repoStats = await fetchGitHubRepoStats(owner, repo)
      
      // Evaluate skill using OpenAI
      const evaluation = await evaluateSkillWithOpenAI(repoStats, proofType)
      evaluationResult = evaluation
      tier = evaluation.tier

    } else if (proofType === 'file_upload') {
      // For file uploads, analyze the content
      const evaluation = await evaluateSkillWithOpenAI(proofData, proofType)
      evaluationResult = evaluation
      tier = evaluation.tier
    } else {
      throw new Error('Invalid proof type or missing data')
    }

    // Update the skill proof record
    const { error: updateError } = await supabaseClient
      .from('skill_proofs')
      .update({
        evaluation_status: 'completed',
        evaluated_tier: tier,
        evaluation_details: evaluationResult,
        updated_at: new Date().toISOString()
      })
      .eq('id', proofId)

    if (updateError) {
      throw new Error(`Failed to update skill proof: ${updateError.message}`)
    }

    // Update user's skill tier in profile
    const { data: {proofData: proof} } = await supabaseClient
      .from('skill_proofs')
      .select('user_id')
      .eq('id', proofId)
      .single()

    if (proof) {
      await supabaseClient
        .from('profiles')
        .update({ skill_tier: tier })
        .eq('id', proof.user_id)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tier,
        evaluation: evaluationResult 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Skill evaluation error:', error)
    
    // Update the skill proof record with error status
    if (req.body) {
      try {
        const { proofId } = await req.json()
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabaseClient
          .from('skill_proofs')
          .update({
            evaluation_status: 'failed',
            evaluation_details: { error: error.message },
            updated_at: new Date().toISOString()
          })
          .eq('id', proofId)
      } catch (updateError) {
        console.error('Failed to update error status:', updateError)
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error.message || 'Skill evaluation failed' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function fetchGitHubRepoStats(owner: string, repo: string): Promise<GitHubRepoStats> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'CompeteSphere-SkillEvaluator'
  }

  // Add GitHub token if available
  const githubToken = Deno.env.get('GITHUB_TOKEN')
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`
  }

  // Fetch repository data
  const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
  if (!repoResponse.ok) {
    throw new Error(`GitHub API error: ${repoResponse.status}`)
  }
  const repoData = await repoResponse.json()

  // Fetch commit count
  const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers })
  const commitCount = commitsResponse.ok ? 
    parseInt(commitsResponse.headers.get('link')?.match(/page=(\d+)>; rel="last"/)?.[1] || '0') : 0

  // Fetch languages
  const languagesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers })
  const languages = languagesResponse.ok ? await languagesResponse.json() : {}

  return {
    stars: repoData.stargazers_count || 0,
    forks: repoData.forks_count || 0,
    commits: commitCount,
    languages,
    lastActivity: repoData.updated_at,
    description: repoData.description || ''
  }
}

async function evaluateSkillWithOpenAI(data: any, proofType: string): Promise<any> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured')
  }

  let prompt: string
  
  if (proofType === 'github_repo') {
    const stats = data as GitHubRepoStats
    prompt = `Evaluate the programming skill level based on this GitHub repository statistics:

Repository Stats:
- Stars: ${stats.stars}
- Forks: ${stats.forks}
- Commits: ${stats.commits}
- Languages: ${Object.keys(stats.languages).join(', ')}
- Last Activity: ${stats.lastActivity}
- Description: ${stats.description}

Based on these metrics, determine the skill level:
- Beginner: Basic projects, few commits, simple languages
- Intermediate: Some community engagement, regular commits, multiple languages
- Advanced: High community engagement, complex projects, leadership in open source
- Expert: Exceptional projects, high impact, recognized expertise

Respond with JSON: {"tier": "beginner|intermediate|advanced|expert", "reasoning": "explanation", "score": 0-100}`

  } else {
    prompt = `Evaluate programming skill level based on this uploaded content:
${JSON.stringify(data)}

Determine skill level and respond with JSON: {"tier": "beginner|intermediate|advanced|expert", "reasoning": "explanation", "score": 0-100}`
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `You are a programming skill evaluator. Analyze the provided data and return a JSON response with skill tier assessment.\n\n${prompt}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        responseMimeType: "application/json"
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const result = await response.json()
  const content = result.candidates[0]?.content?.parts[0]?.text

  try {
    return JSON.parse(content)
  } catch (parseError) {
    throw new Error('Failed to parse Gemini response')
  }
}
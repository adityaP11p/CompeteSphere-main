import React, { useState, useEffect } from 'react'
import { Upload, Github, CheckCircle, XCircle, Clock, AlertCircle, Star, GitBranch, Code } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface SkillProof {
  id: string
  proof_type: 'github_repo' | 'file_upload'
  proof_data: any
  evaluation_status: 'pending' | 'completed' | 'failed'
  evaluated_tier: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null
  evaluation_details: any
  created_at: string
}

export const SkillVerification: React.FC = () => {
  const { user } = useAuth()
  const [skillProofs, setSkillProofs] = useState<SkillProof[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [proofType, setProofType] = useState<'github_repo' | 'file_upload'>('github_repo')
  const [githubUrl, setGithubUrl] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      fetchSkillProofs()
    }
  }, [user])

  const fetchSkillProofs = async () => {
    try {
      const { data, error } = await supabase
        .from('skill_proofs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching skill proofs:', error)
      } else {
        setSkillProofs(data || [])
      }
    } catch (error) {
      console.error('Error fetching skill proofs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)
    setError('')

    try {
      let proofData: any

      if (proofType === 'github_repo') {
        if (!githubUrl) {
          setError('Please enter a GitHub repository URL')
          return
        }
        
        // Validate GitHub URL format
        const githubRegex = /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/
        if (!githubRegex.test(githubUrl)) {
          setError('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)')
          return
        }

        proofData = { url: githubUrl }
      } else {
        if (!uploadedFile) {
          setError('Please select a file to upload')
          return
        }

        // For demo purposes, we'll store file metadata
        // In production, you'd upload to Supabase Storage
        proofData = {
          fileName: uploadedFile.name,
          fileSize: uploadedFile.size,
          fileType: uploadedFile.type
        }
      }

      // Create skill proof record
      const { data: proofRecord, error: insertError } = await supabase
        .from('skill_proofs')
        .insert([
          {
            user_id: user.id,
            proof_type: proofType,
            proof_data: proofData,
            evaluation_status: 'pending'
          }
        ])
        .select()
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      // Trigger skill evaluation
      const { error: functionError } = await supabase.functions.invoke('evaluate-skill', {
        body: {
          proofId: proofRecord.id,
          proofType,
          proofData
        }
      })

      if (functionError) {
        console.error('Evaluation function error:', functionError)
        // Don't throw here - the evaluation might still succeed asynchronously
      }

      // Reset form
      setGithubUrl('')
      setUploadedFile(null)
      setShowForm(false)
      
      // Refresh skill proofs
      await fetchSkillProofs()

    } catch (err: any) {
      setError(err.message || 'Failed to submit skill proof')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />
    }
  }

  const getTierBadge = (tier: string | null) => {
    if (!tier) return null

    const colors = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-blue-100 text-blue-800',
      advanced: 'bg-purple-100 text-purple-800',
      expert: 'bg-yellow-100 text-yellow-800'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colors[tier as keyof typeof colors]}`}>
        <Star className="h-3 w-3 mr-1" />
        {tier}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Star className="h-5 w-5 mr-2 text-yellow-500" />
            Skill Verification
          </h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Add Proof
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Verify your programming skills for better team matching
        </p>
      </div>

      <div className="p-6">
        {/* Add Proof Form */}
        {showForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-md font-medium text-gray-900 mb-4">Submit Skill Proof</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Proof Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proof Type
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="github_repo"
                      checked={proofType === 'github_repo'}
                      onChange={(e) => setProofType(e.target.value as 'github_repo')}
                      className="mr-2"
                    />
                    <Github className="h-4 w-4 mr-1" />
                    GitHub Repository
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="file_upload"
                      checked={proofType === 'file_upload'}
                      onChange={(e) => setProofType(e.target.value as 'file_upload')}
                      className="mr-2"
                    />
                    <Upload className="h-4 w-4 mr-1" />
                    File Upload
                  </label>
                </div>
              </div>

              {/* GitHub URL Input */}
              {proofType === 'github_repo' && (
                <div>
                  <label htmlFor="githubUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    GitHub Repository URL
                  </label>
                  <input
                    id="githubUrl"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://github.com/username/repository"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    We'll analyze your repository's stars, commits, and code complexity using AI
                  </p>
                </div>
              )}

              {/* File Upload */}
              {proofType === 'file_upload' && (
                <div>
                  <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Code Sample
                  </label>
                  <input
                    id="fileUpload"
                    type="file"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    accept=".js,.ts,.py,.java,.cpp,.c,.go,.rs,.php,.rb"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Upload a code file that demonstrates your programming skills for AI analysis
                  </p>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setError('')
                    setGithubUrl('')
                    setUploadedFile(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Proof'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Skill Proofs List */}
        {skillProofs.length === 0 ? (
          <div className="text-center py-8">
            <Star className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No skill proofs yet</h3>
            <p className="text-gray-600 mb-6">
              Submit your GitHub repository or code samples to verify your programming skills and improve team matching.
            </p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Your First Proof
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {skillProofs.map((proof) => (
              <div key={proof.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {proof.proof_type === 'github_repo' ? (
                      <Github className="h-5 w-5 text-gray-600" />
                    ) : (
                      <Upload className="h-5 w-5 text-gray-600" />
                    )}
                    <span className="font-medium text-gray-900 capitalize">
                      {proof.proof_type.replace('_', ' ')}
                    </span>
                    {getStatusIcon(proof.evaluation_status)}
                  </div>
                  {proof.evaluated_tier && getTierBadge(proof.evaluated_tier)}
                </div>

                {/* Proof Details */}
                <div className="text-sm text-gray-600 mb-2">
                  {proof.proof_type === 'github_repo' && proof.proof_data.url && (
                    <a
                      href={proof.proof_data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {proof.proof_data.url}
                    </a>
                  )}
                  {proof.proof_type === 'file_upload' && (
                    <span>{proof.proof_data.fileName}</span>
                  )}
                </div>

                {/* Evaluation Details */}
                {proof.evaluation_status === 'completed' && proof.evaluation_details && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <div className="text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">Evaluation Score:</span>
                        <span className="text-gray-900">{proof.evaluation_details.score}/100</span>
                      </div>
                      {proof.evaluation_details.reasoning && (
                        <p className="text-gray-600">{proof.evaluation_details.reasoning}</p>
                      )}
                    </div>
                  </div>
                )}

                {proof.evaluation_status === 'failed' && proof.evaluation_details?.error && (
                  <div className="mt-3 p-3 bg-red-50 rounded-md">
                    <p className="text-sm text-red-700">{proof.evaluation_details.error}</p>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-500">
                  Submitted {formatDate(proof.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
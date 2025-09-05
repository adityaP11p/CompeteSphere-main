import React, { useState } from 'react'
import { X, Calendar, Users, Trophy, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface CreateCompetitionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const CreateCompetitionModal: React.FC<CreateCompetitionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    minTeamSize: '1',
    maxTeamSize: '',
    entryFee: '',
    prizePool: '',
    prizeCurrency: 'INR',
    prizeSummary: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setError('')
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('You must be logged in to create a competition')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Validation
      if (new Date(formData.endDate) <= new Date(formData.startDate)) {
        setError('End date must be after start date')
        setLoading(false)
        return
      }

      if (new Date(formData.registrationDeadline) >= new Date(formData.startDate)) {
        setError('Registration deadline must be before start date')
        setLoading(false)
        return
      }

      if (!formData.title.trim()) {
        setError('Competition title is required')
        setLoading(false)
        return
      }

      if (formData.maxTeamSize && parseInt(formData.maxTeamSize) < parseInt(formData.minTeamSize)) {
        setError('Max team size must be greater than or equal to min team size')
        setLoading(false)
        return
      }

      if (formData.entryFee && parseFloat(formData.entryFee) < 0) {
        setError('Entry fee cannot be negative')
        setLoading(false)
        return
      }

      if (formData.prizePool && parseFloat(formData.prizePool) < 0) {
        setError('Prize pool cannot be negative')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('competitions')
        .insert([
          {
            title: formData.title,
            description: formData.description || null,
            organizer_id: profile?.id,
            start_date: formData.startDate,
            end_date: formData.endDate,
            registration_deadline: formData.registrationDeadline,
            min_team_size: parseInt(formData.minTeamSize) || 1,
            max_team_size: formData.maxTeamSize ? parseInt(formData.maxTeamSize) : null,
            entry_fee_cents: formData.entryFee ? Math.round(parseFloat(formData.entryFee) * 100) : 0,
            prize_pool_cents: formData.prizePool ? Math.round(parseFloat(formData.prizePool) * 100) : 0,
            prize_currency: formData.prizeCurrency,
            prize_summary: formData.prizeSummary || null,
          }
        ])
        .select()

      console.log('Insert result:', { data, error })

      if (error) {
        console.error('Supabase error:', error)
        setError(error.message)
      } else {
        // Reset form
        setFormData({
          title: '',
          description: '',
          startDate: '',
          endDate: '',
          registrationDeadline: '',
          minTeamSize: '1',
          maxTeamSize: '',
          entryFee: '',
          prizePool: '',
          prizeCurrency: 'INR',
          prizeSummary: ''
        })

        await onSuccess()
        onClose()
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Trophy className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Create New Competition</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Competition Title *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter competition title"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={loading}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe your competition..."
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Deadline *
                </label>
                <input
                  id="registrationDeadline"
                  name="registrationDeadline"
                  type="datetime-local"
                  value={formData.registrationDeadline}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="minTeamSize" className="block text-sm font-medium text-gray-700 mb-1">
                  Min Team Size
                </label>
                <input
                  id="minTeamSize"
                  name="minTeamSize"
                  type="number"
                  value={formData.minTeamSize}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>

              <div>
                <label htmlFor="maxTeamSize" className="block text-sm font-medium text-gray-700 mb-1">
                  Max Team Size
                </label>
                <input
                  id="maxTeamSize"
                  name="maxTeamSize"
                  type="number"
                  value={formData.maxTeamSize}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave blank for unlimited"
                  min="1"
                />
              </div>

              <div>
                <label htmlFor="entryFee" className="block text-sm font-medium text-gray-700 mb-1">
                  Entry Fee
                </label>
                <input
                  id="entryFee"
                  name="entryFee"
                  type="number"
                  value={formData.entryFee}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label htmlFor="prizePool" className="block text-sm font-medium text-gray-700 mb-1">
                  Prize Pool
                </label>
                <input
                  id="prizePool"
                  name="prizePool"
                  type="number"
                  value={formData.prizePool}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label htmlFor="prizeCurrency" className="block text-sm font-medium text-gray-700 mb-1">
                  Prize Currency
                </label>
                <select
                  id="prizeCurrency"
                  name="prizeCurrency"
                  value={formData.prizeCurrency}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div>
                <label htmlFor="prizeSummary" className="block text-sm font-medium text-gray-700 mb-1">
                  Prize Summary
                </label>
                <textarea
                  id="prizeSummary"
                  name="prizeSummary"
                  value={formData.prizeSummary}
                  onChange={handleChange}
                  disabled={loading}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. 1 lakh + goodies"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Competition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

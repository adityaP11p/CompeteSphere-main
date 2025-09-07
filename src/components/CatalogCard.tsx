import { useState } from 'react'
import type { CatalogItem, Lesson, MentorshipSlot, UUID } from '../types'
import { fetchLessonsForItem, fetchMentorshipSlots } from '../api/catalog'
import { supabase } from '../lib/supabase'
import { bookMentorshipSlot, cancelMentorshipBooking } from '../api/creator'

type Props = {
  item: CatalogItem
  onBuy: (item: CatalogItem) => Promise<void>
  currentUserId?: string | null
}

// Local extended lesson type to include signed_url
type LessonWithSignedUrl = Lesson & { signed_url?: string }

export default function CatalogCard({ item, onBuy, currentUserId }: Props) {
  const [expanded, setExpanded] = useState(false)

  // For the summary list (lightweight)
  const [lessonsSummary, setLessonsSummary] = useState<Lesson[] | null>(null)
  const [slots, setSlots] = useState<MentorshipSlot[] | null>(null)

  // For the full lesson players (signed URLs)
  const [lessonsFull, setLessonsFull] = useState<LessonWithSignedUrl[] | null>(null)
  const [loadingLessons, setLoadingLessons] = useState(false)

  // Access state: null = not yet checked, true/false = result
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  const isFree = (item.price_cents ?? 0) === 0

  async function checkAccessAndLoad() {
    // If user not logged in, they don't have access
    if (!currentUserId) {
      setHasAccess(false)
      return
    }

    if (item.type === 'course') {
      // Check enrollments table
      const { data: enr, error: enrErr } = await supabase
        .from('enrollments')
        .select('buyer_id')
        .eq('buyer_id', currentUserId)
        .eq('item_id', item.id)
        .maybeSingle()

      if (enrErr) {
        console.error('enrollment check error', enrErr)
        setHasAccess(false)
        return
      }

      const enrolled = !!enr
      setHasAccess(enrolled)

      if (enrolled) {
        // Fetch lessons & generate signed urls (only if not already loaded)
        if (!lessonsFull) {
          setLoadingLessons(true)
          try {
            const raw = await fetchLessonsForItem(item.id as UUID)

            const signedLessons: LessonWithSignedUrl[] = await Promise.all(
              raw.map(async (lesson) => {
                if (!lesson.content_url) return lesson as LessonWithSignedUrl

                const url = lesson.content_url
                const path = url.includes('/object/public/')
                  ? url.split('/object/public/')[1]
                  : url

                const [bucket, ...rest] = path.split('/')
                const filePathInBucket = rest.join('/')

                const { data: signed, error } = await supabase
                  .storage
                  .from(bucket)
                  .createSignedUrl(filePathInBucket, 3600)

                if (error) {
                  console.error('createSignedUrl error:', error)
                  return lesson as LessonWithSignedUrl
                }

                return { ...lesson, signed_url: signed?.signedUrl }
              })
            )

            setLessonsFull(signedLessons)
          } catch (e) {
            console.error('failed to load lessons', e)
          } finally {
            setLoadingLessons(false)
          }
        }
      }
    } else if (item.type === 'mentorship') {
      // For mentorship items, access is determined by bookings
      // Check if the user has a booking for any slot of this item
      const { data: slotsForItem, error: slotsErr } = await supabase
        .from('mentorship_slots')
        .select('id')
        .eq('item_id', item.id)

      if (slotsErr) {
        console.error('error fetching slots for access check', slotsErr)
        setHasAccess(false)
        return
      }

      const slotIds = (slotsForItem || []).map((s: any) => s.id)
      if (slotIds.length === 0) {
        setHasAccess(false)
        return
      }

      const { data: bookings, error: bookingsErr } = await supabase
        .from('mentorship_bookings')
        .select('id')
        .in('slot_id', slotIds)
        .eq('buyer_id', currentUserId)

      if (bookingsErr) {
        console.error('booking check error', bookingsErr)
        setHasAccess(false)
        return
      }

      setHasAccess((bookings || []).length > 0)

      // still fetch the slots list for display (existing behavior)
      if (!slots) {
        const s = await fetchMentorshipSlots(item.id as UUID)
        setSlots(s)
      }
    }
  }

  async function toggleExpand()  {
    const nowExpanded = !expanded
    setExpanded(nowExpanded)

    if (nowExpanded) {
      // When opening details: fetch summary lists (lightweight)
      if (item.type === 'course' && !lessonsSummary) {
        const l = await fetchLessonsForItem(item.id as UUID)
        setLessonsSummary(l)
      }
      if (item.type === 'mentorship' && !slots) {
        const s = await fetchMentorshipSlots(item.id as UUID)
        setSlots(s)
      }

      // check access and load full lesson players only if needed
      await checkAccessAndLoad()
    }
  }

  return (
    <div className="rounded-2xl shadow p-4 bg-white border flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-70">{item.type}</div>
          <h3 className="text-lg font-semibold">{item.title}</h3>
          {item.creator?.display_name && (
            <div className="text-sm opacity-80">by {item.creator.display_name}{item.creator.verified ? ' ✅' : ''}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">
            {isFree ? 'Free' : `${(item.price_cents / 100).toFixed(2)} ${item.currency}`}
          </div>
          <div className="text-xs opacity-70">{item.media_type}</div>
        </div>
      </div>

      {item.description && (
        <p className="text-sm opacity-90 line-clamp-3">{item.description}</p>
      )}

      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
          onClick={() => onBuy(item)}
          disabled={!currentUserId}
          title={!currentUserId ? 'Sign in to continue' : ''}
        >
          {isFree ? (item.type === 'course' ? 'Enroll Free' : 'Book Free') : 'Buy'}
        </button>
        <button
          className="px-3 py-2 rounded-xl border hover:bg-gray-50"
          onClick={toggleExpand}
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {expanded && item.type === 'course' && (
        <div className="mt-2">
          <div className="text-sm font-medium mb-1">Lessons</div>

          {/* Lightweight summary list */}
          {!lessonsSummary && <div className="text-sm opacity-70">Loading…</div>}
          {lessonsSummary && lessonsSummary.length === 0 && (
            <div className="text-sm opacity-70">No lessons yet</div>
          )}
          <ul className="list-disc pl-5 text-sm">
            {lessonsSummary?.map((l) => (
              <li key={l.id}>
                {l.index_in_course != null ? `${l.index_in_course + 1}. ` : ''}
                {l.title}
              </li>
            ))}
          </ul>

          {/* Access messaging */}
          {hasAccess === null && (
            <div className="text-sm opacity-70 mt-2">Checking access…</div>
          )}
          {hasAccess === false && (
            <div className="text-sm text-red-600 mt-2">
              {currentUserId ? 'You are not enrolled in this course.' : 'Sign in to view lessons.'}
            </div>
          )}

          {/* Full lesson players (same UI as LearningGrid) */}
          {hasAccess === true && (
            <div className="mt-2 space-y-4">
              {loadingLessons && <div className="text-sm opacity-70">Loading lessons…</div>}
              {lessonsFull && lessonsFull.length === 0 && <div className="text-sm opacity-70">No lessons to show.</div>}
              {lessonsFull?.map((lesson) => {
                const url = lesson.signed_url ?? lesson.content_url

                return (
                  <div key={lesson.id} className="border p-2 rounded">
                    <div className="font-semibold">{lesson.title}</div>
                    {url?.endsWith('.mp4') ? (
                      <video src={url} controls className="w-full max-h-96 mt-2" />
                    ) : url?.endsWith('.pdf') ? (
                      <iframe src={url} className="w-full h-96 mt-2" />
                    ) : (
                      <a href={url} target="_blank" className="text-blue-600 underline mt-2 block" rel="noreferrer">
                        Open Lesson
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {expanded && item.type === 'mentorship' && (
        <div className="mt-2">
          <div className="text-sm font-medium mb-1">Upcoming Slots</div>
          {!slots && <div className="text-sm opacity-70">Loading…</div>}
          {slots && slots.length === 0 && (
            <div className="text-sm opacity-70">No upcoming slots</div>
          )}
          <ul className="text-sm space-y-1">
            {slots?.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>
                  {s.starts_at ? new Date(s.starts_at).toLocaleString() : 'TBD'}
                  {' '}–{' '}
                  {s.ends_at ? new Date(s.ends_at).toLocaleString() : 'TBD'}
                </span>
                <span className="opacity-70">{s.seats_taken}/{s.capacity} booked</span>
                <span className="flex items-center gap-2">
                  <span className="opacity-70">{s.seats_taken}/{s.capacity} booked</span>

                  {currentUserId && (
                    <>
                      {hasAccess ? (
                        <button
                          className="px-2 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600"
                          onClick={async () => {
                            try {
                              // cancel any booking by this user for this slot
                              const { data: booking } = await supabase
                                .from('mentorship_bookings')
                                .select('id')
                                .eq('slot_id', s.id)
                                .eq('buyer_id', currentUserId)
                                .maybeSingle()

                              if (booking) {
                                await cancelMentorshipBooking(booking.id)
                                alert('Booking cancelled')
                                await checkAccessAndLoad()
                              }
                            } catch (err) {
                              console.error('cancel booking error', err)
                              alert('Failed to cancel booking')
                            }
                          }}
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          className="px-2 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700"
                          onClick={async () => {
                            try {
                              await bookMentorshipSlot(s.id as UUID, currentUserId as UUID)
                              alert('Slot booked!')
                              await checkAccessAndLoad()
                            } catch (err) {
                              console.error('booking error', err)
                              alert('Failed to book slot')
                            }
                          }}
                        >
                          Book
                        </button>
                      )}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {/* Optionally, you may want to show booking status / CTA based on hasAccess */}
          {hasAccess === false && (
            <div className="text-sm text-red-600 mt-2">
              You have not booked a slot for this mentorship.
            </div>
          )}
          {hasAccess === true && item.metadata?.meeting_link && (
            <div className="mt-4">
              <a
                href={item.metadata.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                Join Mentorship Session
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

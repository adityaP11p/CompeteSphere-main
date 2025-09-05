
import { useEffect, useState } from 'react'
import type { CatalogItem, Lesson } from '../types'
import { fetchCatalogItems, enrollFreeItem, fetchLessonsForItem, isUserEnrolled, hasMentorshipBooking  } from '../api/catalog'
import CatalogCard from './CatalogCard'
import { supabase } from '../lib/supabase'

export type LessonWithSignedUrl = Lesson | {
  signed_url?: string,
  id: string,
  item_id: string,
  title: string;
  content_url: string,
  index_in_course: number | null
}

export default function LearningGrid() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'course' | 'mentorship' | 'free' | 'paid'>('all')
  const [lessons, setLessons] = useState<LessonWithSignedUrl[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    (async () => {
      const session = (await supabase.auth.getSession()).data.session
      setUserId(session?.user?.id ?? null)
      const data = await fetchCatalogItems()
      setItems(data)
      setLoading(false)
    })()
  }, [])

  async function loadLessons(item: CatalogItem) {
    if (!userId) {
      alert('Please log in to view lessons')
      return
    }

    // ✅ Check access
    let hasAccess = false
    if (item.type === 'course') {
      hasAccess = await isUserEnrolled(userId, item.id)
    } else if (item.type === 'mentorship') {
      hasAccess = await hasMentorshipBooking(userId, item.id)
    }

    if (!hasAccess) {
      alert('You are not enrolled/booked for this item.')
      return
    }
    if (!visible) {
      const raw = await fetchLessonsForItem(item.id)

      const signedLessons: LessonWithSignedUrl[] = await Promise.all(
        raw.map(async (lesson) => {
          if (!lesson.content_url) return lesson

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

      setLessons(signedLessons)
    }

    setVisible(!visible)
  }

  async function handleBuy(item: CatalogItem) {
    if (!userId) return
    if (item.price_cents === 0) {
      await enrollFreeItem(item, userId)
      alert('Enrolled successfully!')
    } else {
      alert('Paid checkout not yet integrated. Hook up Stripe and redirect to Checkout here.')
    }
  }

  const vis = items.filter((i) => {
    if (filter === 'all') return true
    if (filter === 'course' || filter === 'mentorship') return i.type === filter
    if (filter === 'free') return i.price_cents === 0
    if (filter === 'paid') return i.price_cents > 0
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Learning</h2>
        <div className="flex gap-2">
          {(['all', 'course', 'mentorship', 'free', 'paid'] as const).map((f) => (
            <button
              key={f}
              className={`px-3 py-1 rounded-full border ${filter === f ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {!loading && vis.length === 0 && (
        <div className="opacity-70">No items found.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vis.map((item) => (
          <div key={item.id}>
            <CatalogCard item={item} onBuy={handleBuy} currentUserId={userId} />
            {/* <button
              onClick={() => loadLessons(item)} // ✅ Correct onClick usage
              className="text-blue-500 underline mt-2"
            >
              {visible ? 'Hide Lessons' : 'View Lessons'}
            </button>

            {visible && lessons.length > 0 && (
              <div className="mt-2 space-y-4">
                {lessons.map((lesson) => {
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
            )} */}
          </div>
        ))}
      </div>
    </div>
  )
}

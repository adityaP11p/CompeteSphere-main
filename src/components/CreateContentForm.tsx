import { useState } from 'react'
import type { CatalogItem } from '../types'
// import { supabase } from '../lib/supabase'
import { uploadFile, createCatalogItem, addLesson, addSlot } from '../api/creator'

type Props = {
  userId: string
  onCreated?: (item: CatalogItem) => void
}

export default function CreateContentForm({ userId, onCreated }: Props) {
  const [type, setType] = useState<'course' | 'mentorship'>('course')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [currency, setCurrency] = useState('INR')
  const [mediaType, setMediaType] = useState<'video' | 'pdf' | 'link' | 'mixed'>('video')
  const [file, setFile] = useState<File | null>(null)
  const [lessons, setLessons] = useState<Array<{ title: string; content_items: (string | File)[] }>>([])
  const [slots, setSlots] = useState<Array<{ starts_at: string; capacity: number }>>([])
  const [submitting, setSubmitting] = useState(false)
  const [meetingLink, setMeetingLink] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      let resourceUrl: string | undefined = undefined
      if (file) {
        const { url } = await uploadFile(file, 'uploads')
        resourceUrl = url
      }

      const priceCents = Math.round(price * 100)
      const payload: Partial<CatalogItem> = {
        creator_id: userId,
        type,
        title,
        description,
        price_cents: priceCents,
        currency,
        is_active: true,
        media_type: mediaType,
        metadata: 
          type === 'mentorship'
            ? { meeting_link: meetingLink }
            : resourceUrl
            ? { resource_url: resourceUrl }
            : {},
      }

      const item = await createCatalogItem(payload)

      // Handle lessons
      if (lessons.length > 0) { //type === 'course' && 
        for (let i = 0; i < lessons.length; i++) {
          const lesson = lessons[i]

          if (!lesson.title?.trim()) {
            alert(`Lesson ${i + 1} is missing a title. Please fill it before submitting.`)
            setSubmitting(false)
            return
          }

          if (!lesson.content_items || lesson.content_items.length === 0) {
            console.warn(`Skipping lesson ${i}: no content items.`)
            continue
          }

          for (const contentItem of lesson.content_items) {
            let contentUrl = ''

            if (contentItem instanceof File) {
              try {
                const { url } = await uploadFile(contentItem, 'uploads')
                contentUrl = url
              } catch (uploadError) {
                console.error(`Lesson ${i} file upload failed:`, uploadError)
                continue
              }
            } else if (typeof contentItem === 'string' && contentItem.startsWith('https')) {
              contentUrl = contentItem
            }

            if (!contentUrl) {
              console.warn(`Invalid content in lesson ${i}`)
              continue
            }

            try {
              await addLesson(item.id, {
                title: lesson.title.trim(),
                content_url: contentUrl,
                index_in_course: i,
              })
            } catch (err) {
              console.error(`Failed to insert lesson ${i}:`, err)
            }
          }
        }
      }

      // Handle slots
      if (type === 'mentorship' && slots.length > 0) {
        for (const s of slots) {
          await addSlot(item.id, { starts_at: s.starts_at, capacity: s.capacity })
        }
      }

      onCreated?.(item)
      // Reset form
      setTitle('')
      setDescription('')
      setPrice(0)
      setFile(null)
      setLessons([])
      setSlots([])
      alert('Content created')
    } catch (err) {
      console.error(err)
      alert('Error creating content')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-xl bg-white">
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" checked={type === 'course'} onChange={() => setType('course')} /> Course
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={type === 'mentorship'} onChange={() => setType('mentorship')} /> Mentorship
        </label>
      </div>

      <div>
        <label className="block text-sm">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded p-2" required />
      </div>

      <div>
        <label className="block text-sm">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded p-2" rows={4} />
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-sm">Price ({currency})</label>
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm">Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="border rounded p-2" />
        </div>
      </div>
      

 
      {type === 'course' && (
        <div className="space-y-4">
          <div className="font-semibold">Lessons</div>
          {lessons.map((l, i) => (
            <div key={i} className="border p-2 rounded space-y-2">
              <input
                className="w-full border p-2"
                placeholder="Lesson title"
                value={l.title}
                onChange={(e) => {
                  const updated = [...lessons]
                  updated[i].title = e.target.value
                  setLessons(updated)
                }}
              />

              {(l.content_items || []).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {item instanceof File ? (
                    <span className="text-sm text-gray-700">{item.name}</span>
                  ) : (
                    <a
                      href={item}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-sm"
                    >
                      {item}
                    </a>
                  )}
                  <button
                    type="button"
                    className="text-red-600 text-sm"
                    onClick={() => {
                      const updated = [...lessons]
                      updated[i].content_items.splice(idx, 1)
                      setLessons(updated)
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <input
                type="file"
                accept="video/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const updated = [...lessons]
                    updated[i].content_items = updated[i].content_items || []
                    updated[i].content_items.push(file)
                    setLessons(updated)
                  }
                }}
              />

              {/* <input
                type="text"
                placeholder="Paste video or resource link"
                className="w-full border p-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const url = e.currentTarget.value.trim()
                    if (url) {
                      const updated = [...lessons]
                      updated[i].content_items = updated[i].content_items || []
                      updated[i].content_items.push(url)
                      setLessons(updated)
                      e.currentTarget.value = ''
                    }
                  }
                }}
              /> */}

              <button
                type="button"
                onClick={() => setLessons(lessons.filter((_, idx) => idx !== i))}
                className="text-sm text-red-500"
              >
                Delete Lesson
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setLessons([...lessons, { title: '', content_items: [] }])}
            className="px-3 py-1 border rounded"
          >
            Add Lesson
          </button>
        </div>
      )}

      {type === 'mentorship' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm">Meeting link (Zoom or Microsoft Teams)</label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/xxxx or https://teams.microsoft.com/l/meetup-join/xxxx"
              className="w-full border rounded p-2"
              required
            />
          </div>

          <div className="font-semibold">Slots</div>
          {slots.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="datetime-local"
                className="border p-2"
                value={s.starts_at}
                onChange={(e) => {
                  const arr = [...slots]
                  arr[i].starts_at = e.target.value
                  setSlots(arr)
                }}
              />
              <input
                type="number"
                className="border p-2"
                min={1}
                value={s.capacity}
                onChange={(e) => {
                  const arr = [...slots]
                  arr[i].capacity = Number(e.target.value)
                  setSlots(arr)
                }}
              />
              <button
                type="button"
                onClick={() => setSlots(slots.filter((_, idx) => idx !== i))}
                className="text-red-600 text-sm"
              >
                Delete
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setSlots([...slots, { starts_at: new Date().toISOString().slice(0, 16), capacity: 1 }])
            }
            className="px-3 py-1 border rounded"
          >
            Add Slot
          </button>
        </div>
      )}

      <div>
        <button
          type="submit"
          className="px-4 py-2 rounded bg-black text-white"
          disabled={submitting}
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}

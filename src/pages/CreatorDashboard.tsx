// =============================================
// src/pages/CreatorDashboard.tsx
// =============================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyCatalogItems, deleteCatalogItem, updateCatalogItem } from '../api/creator'
import CreateContentForm from '../components/CreateContentForm'
import { useCreatorGuard } from '../hooks/useCreatorGuard'
import type { CatalogItem } from '../types'

export default function CreatorDashboard() {
  //useCreatorGuard()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [notCreator, setNotCreator] = useState(false)
  async function load() {
    setLoading(true)
    try {
        const sessionResult = await supabase.auth.getSession()
        const uid = sessionResult?.data.session?.user?.id ?? null
        console.log(uid);
        
        if (!uid) {
            setUserId(null)
            setItems([])
            setNotCreator(true)
            setLoading(false)
            return
        }
        
        const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', uid)
        .single()

        if (profileErr || !profile) {
          console.error('No profile found')
          setLoading(false)
          return
        }

        setUserId(profile.id)
        const { data: creatorRow, error: creatorErr } = await supabase
            .from('creators')
            .select('*')
            .eq('user_id', profile.id)
            .single()

        if (creatorErr || !creatorRow) {
            const { data: inserted, error: insertErr } = await supabase
            .from('creators')
            .insert([{ user_id: profile.id, display_name: profile.full_name }])
            .select()
            .single()

          if (insertErr || !inserted) {
            console.error('Could not create creator row:', insertErr)
            setNotCreator(true)
            setItems([])
            setLoading(false)
            return
          }
        }

      // fetch the catalog items for this creator
        const data = await fetchMyCatalogItems(uid)
        setItems(data)
        
    } catch (err) {
        console.error('Error loading creator dashboard:', err)
        setItems([])
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {  
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load()
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return <div className="p-6">Loading…</div>
  }

  if (notCreator) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Creator Dashboard</h2>
        <div className="p-4 border rounded bg-yellow-50">
          <p className="mb-2">You are not registered as a creator/mentor yet.</p>
          <p className="text-sm text-gray-600">Only users present in the <code>creators</code> table can access this dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Creator Dashboard</h2>
         <div className="text-sm text-gray-500">You're signed in as {userId}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-2">Create new content</h3>
          {userId && <CreateContentForm userId={userId} onCreated={() => load()} />}
        </div>

        <div>
          <h3 className="font-semibold mb-2">My content</h3>
          {loading && <div>Loading…</div>}
          {!loading && items.length === 0 && <div className="opacity-70">No content yet.</div>}
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="p-3 border rounded">
                <div className="flex justify-between">
                  <div>
                    <div className="text-xs opacity-70">{it.type}</div>
                    <div className="font-semibold">{it.title}</div>
                    <div className="text-sm opacity-70">{it.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{it.price_cents === 0 ? 'Free' : `₹ ${(it.price_cents/100).toFixed(2)}`}</div>
                    <div className="flex gap-2 mt-2">
                      <button className="px-2 py-1 border rounded" 
                      onClick={async () => {  try {
                            await updateCatalogItem(it.id, { is_active: !it.is_active })
                            await load()
                            } catch (err) {
                            console.error(err)
                            alert('Unable to update item')
                            }
                        }}
                        >
                            {it.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button className="px-2 py-1 border rounded bg-red-50" onClick={async () => {
                         if (!confirm('Delete this item?')) return
                        try {
                          await deleteCatalogItem(it.id)
                          await load()
                        } catch (err) {
                          console.error(err)
                          alert('Delete failed')
                        }
                        }}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

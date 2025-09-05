import { useEffect, useState } from 'react'
import type { CatalogItem } from '../types'
import { supabase } from '../lib/supabase'
import { setItemActive } from '../api/catalog'

export default function AdminPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*, creator:creators(user_id, display_name, verified)')
      .order('created_at', { ascending: false })
    if (error) throw error
    setItems(data as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(id: string, isActive: boolean) {
    await setItemActive(id, !isActive)
    await load()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Admin • Catalog Moderation</h2>
      {loading && <div>Loading…</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.id} className={`rounded-2xl border p-4 ${it.is_active ? 'bg-white' : 'bg-gray-50'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs uppercase opacity-70">{it.type}</div>
                <div className="font-semibold">{it.title}</div>
                <div className="text-sm opacity-70">by {it.creator?.display_name ?? 'Unknown'}</div>
              </div>
              <div className="text-right font-bold">{it.price_cents === 0 ? 'Free' : `₹ ${(it.price_cents/100).toFixed(2)}`}</div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="px-3 py-2 rounded-xl border" onClick={() => toggleActive(it.id, it.is_active)}>
                {it.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button className="px-3 py-2 rounded-xl border bg-red-50" onClick={async () => {
                await supabase.from('catalog_items').delete().eq('id', it.id)
                await load()
              }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

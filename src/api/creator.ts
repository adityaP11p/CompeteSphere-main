// =============================================
// Optional: Stripe integration notes (server route to implement later)
// =============================================
// 1) Create a server endpoint POST /api/create-checkout-session
//    Body: { item_id }
//    - Look up catalog_items by id
//    - Create Stripe Checkout Session with price = price_cents, mode=payment
//    - On success, return session.url and redirect from client
// 2) Webhook /api/stripe-webhook
//    - On checkout.session.completed → insert order (status='paid')
//    - If item.type='course' → insert into enrollments
//    - If item.type='mentorship' → create mentorship_booking for chosen slot
//    Commission (10%) is applied later at payout time via Stripe Connect transfers.


// =============================================
// NEW: Creator Dashboard + CreateContentForm (with file uploads)
// =============================================

// =============================================
// src/api/creator.ts
// Supabase helpers for creators
// =============================================
import { supabase } from '../lib/supabase'
import type { CatalogItem, Lesson, MentorshipSlot, UUID } from '../types'

export async function fetchMyCatalogItems(userId: UUID): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as any
}

export async function uploadFile(file: File, folder = 'public') {
  // bucket: 'learning' (create in Supabase Storage)
  const filePath = `${folder}/${Date.now()}_${file.name}`
  const { data, error } = await supabase.storage
    .from('learning')
    .upload(filePath, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data: publicUrlData } = supabase.storage.from('learning').getPublicUrl(filePath)
   if (!publicUrlData.publicUrl) {
    throw new Error("Failed to get public URL from Supabase Storage.");
  }

  return { url: publicUrlData.publicUrl };
}

export async function createCatalogItem(payload: Partial<CatalogItem>) {
  const { data, error } = await supabase
    .from('catalog_items')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as CatalogItem
}

export async function addLesson(item_id: UUID, lesson: Partial<Lesson>) {
  const { data, error } = await supabase
    .from('lessons')
    .insert({ item_id, ...lesson })
    .select()
    .single()
  if (error) throw error
  console.log("Inserting lesson:", { item_id, ...lesson });

  return data as Lesson
}

export async function addSlot(item_id: UUID, slot: Partial<MentorshipSlot>) {
  const { data, error } = await supabase
    .from('mentorship_slots')
    .insert({ item_id, ...slot })
    .select()
    .single()
  if (error) throw error
  return data as MentorshipSlot
}

export async function updateCatalogItem(itemId: UUID, updates: Partial<CatalogItem>) {
  const { data, error } = await supabase
    .from('catalog_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single()
  if (error) throw error
  return data as CatalogItem
}

export async function deleteCatalogItem(itemId: UUID) {
  const { error } = await supabase
    .from('catalog_items')
    .delete()
    .eq('id', itemId)
  if (error) throw error
}




import { supabase } from '../lib/supabase'
import type { CatalogItem, Lesson, MentorshipSlot, UUID } from '../types'


export async function fetchCatalogItems(): Promise<CatalogItem[]> {
    const { data, error } = await supabase
        .from('catalog_items')
        .select('*, creator:creators!inner(user_id, display_name, verified)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })


    if (error) throw error
    return (data as any) as CatalogItem[]
}


export async function fetchLessonsForItem(itemId: UUID): Promise<Lesson[]> {
    const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('item_id', itemId)
        .order('index_in_course', { ascending: true })
    if (error) throw error
    return (data as any) as Lesson[]
}


export async function fetchMentorshipSlots(itemId: UUID): Promise<MentorshipSlot[]> {
    const { data, error } = await supabase
        .from('mentorship_slots')
        .select('*')
        .eq('item_id', itemId)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
    if (error) throw error
    return (data as any) as MentorshipSlot[]
}


// Free purchase/enroll shortcut for MVP (no Stripe)
export async function enrollFreeItem(item: CatalogItem, buyerId: UUID) {
// Create a zero-amount paid order
    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
            buyer_id: buyerId,
            item_id: item.id,
            amount_cents: 0,
            currency: item.currency || 'INR',
            status: 'paid',
        })
        .select()
        .single()
    if (orderErr) throw orderErr


    // Grant access based on type
    if (item.type === 'course') {
        const { error: enrErr } = await supabase
            .from('enrollments')
            .insert({ buyer_id: buyerId, item_id: item.id })
        if (enrErr) throw enrErr
    }
    // For mentorship, consider creating a booking only when a slot is chosen.
    return order
}


// Admin: toggle is_active
export async function setItemActive(itemId: UUID, isActive: boolean) {
    const { error } = await supabase
        .from('catalog_items')
        .update({ is_active: isActive })
        .eq('id', itemId)
    if (error) throw error
}

// Check if user is enrolled in a course
export async function isUserEnrolled(userId: UUID, itemId: UUID): Promise<boolean> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('buyer_id', userId)
    .eq('item_id', itemId)
    .maybeSingle()

  if (error) throw error
  return !!data
}

// Check if user has booked a mentorship slot
export async function hasMentorshipBooking(userId: UUID, itemId: UUID): Promise<boolean> {
//   const { data, error } = await supabase
//     .from('mentorship_bookings')
//     .select('id')
//     .eq('buyer_id', userId)
//     .in('slot_id', supabase.from('mentorship_slots').select('id').eq('item_id', itemId)) // join-like logic
//   if (error) throw error
//   return data.length > 0
// }

// First, fetch all slot IDs for the item
  const { data: slots, error: slotsError } = await supabase
    .from('mentorship_slots')
    .select('id')
    .eq('item_id', itemId);

  if (slotsError) throw slotsError;
  const slotIds = (slots ?? []).map((slot: any) => slot.id);

  if (slotIds.length === 0) return false;

  // Now, check for bookings with those slot IDs
  const { data, error } = await supabase
    .from('mentorship_bookings')
    .select('id')
    .eq('buyer_id', userId)
    .in('slot_id', slotIds);

  if (error) throw error;
  return (data ?? []).length > 0;
}
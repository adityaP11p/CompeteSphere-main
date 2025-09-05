export type UUID = string


export type Creator = {
user_id: UUID
display_name: string | null
verified: boolean | null
stripe_account_id: string | null
}


export type CatalogItem = {
id: UUID
creator_id: UUID | null
type: 'course' | 'mentorship'
title: string
description: string | null
price_cents: number
currency: string
is_active: boolean
media_type: 'video' | 'pdf' | 'link' | 'mixed' | string
metadata: Record<string, any>
created_at: string
creator?: Creator
}


export type Lesson = {
id: UUID
item_id: UUID
title: string
content_url: string | null
index_in_course: number | null
}


export type MentorshipSlot = {
id: UUID
item_id: UUID
starts_at: string | null
ends_at: string | null
capacity: number
seats_taken: number
}


export type Order = {
id: UUID
buyer_id: UUID
item_id: UUID
amount_cents: number
currency: string
stripe_payment_intent_id: string | null
stripe_checkout_session_id: string | null
status: 'requires_payment' | 'paid' | 'refunded' | 'failed' | 'cancelled'
created_at: string
}
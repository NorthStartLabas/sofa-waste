export type Role = 'cook' | 'chef' | 'admin'
export type Unit = 'g' | 'ml' | 'pcs'
export type Kind = 'raw' | 'prep'

export const REASONS = [
  'made_too_much',
  'expired',
  'spoiled',
  'mistake',
  'dropped',
  'supplier_quality',
  'other',
] as const
export type Reason = (typeof REASONS)[number]

export type Restaurant = {
  id: string
  name: string
  timezone: string
  report_emails: string[]
}

export type Member = {
  restaurant_id: string
  user_id: string
  name: string
  email: string
  role: Role
  must_change_pin: boolean
  active: boolean
}

export type Station = { id: string; restaurant_id: string; name: string; sort_order: number }
export type Supplier = { id: string; restaurant_id: string; name: string }

export type Item = {
  id: string
  restaurant_id: string
  kind: Kind
  name: string
  unit: Unit
  station_id: string | null
  supplier_id: string | null
  pack_qty: number | null
  pack_price: number | null
  yield_pct: number | null
  batch_qty: number | null
  archived: boolean
  /** From items_with_cost. Null = incomplete. */
  unit_cost: number | null
  cleaned_unit_cost: number | null
}

export type RecipeLine = {
  id: string
  prep_item_id: string
  ingredient_item_id: string
  qty: number
}

export type Entry = {
  id: string
  restaurant_id: string
  item_id: string | null
  item_name: string
  unit: Unit
  unit_cost: number | null
  cost: number | null
  qty: number
  cleaned: boolean
  reason: Reason
  note: string | null
  station_id: string | null
  photo_path: string | null
  logged_by: string
  logged_by_name: string
  logged_at: string
}

export type ReportRow = {
  name: string
  unit: Unit
  qty: number
  total: number | null
  entries: number
  days: number
  incomplete: number
}

export type Report = {
  week_start: string
  total: number
  prev_total: number
  entries: number
  incomplete_entries: number
  covers: number
  per_cover: number | null
  by_reason: { reason: Reason; total: number | null; entries: number }[]
  by_station: { station: string | null; total: number | null; entries: number }[]
  top_items: ReportRow[]
  repeated: ReportRow[]
  incomplete: { name: string; entries: number }[]
}

export type Covers = { restaurant_id: string; day: string; lunch: number; dinner: number }

export type AuditRow = {
  id: number
  table_name: string
  row_id: string | null
  action: 'insert' | 'update' | 'delete'
  old_row: Record<string, unknown> | null
  new_row: Record<string, unknown> | null
  actor: string | null
  at: string
}

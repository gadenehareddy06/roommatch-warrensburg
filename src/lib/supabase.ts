import { createClient, type User } from '@supabase/supabase-js'
import type { Property, Role, UserProfile } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
export const isSupabaseConfigured = Boolean(url && publishableKey && !url.includes('YOUR_PROJECT'))
export const supabase = isSupabaseConfigured ? createClient(url!, publishableKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function signUp(name: string, email: string, password: string, role: Role) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role } } })
  if (error) throw error
  return data
}

export async function requestPasswordReset(email: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })
  if (error) throw error
}

export function profileFromUser(user: User): UserProfile {
  return {
    id: user.id,
    name: String(user.user_metadata.name || user.email?.split('@')[0] || 'RoomMatch user'),
    email: user.email || '',
    role: user.user_metadata.role === 'owner' ? 'owner' : 'tenant',
  }
}

export function mapProperty(row: Record<string, unknown>): Property {
  const preferenceValue = row.property_preferences
  const amenityValue = row.property_amenities
  const prefs = (Array.isArray(preferenceValue) ? preferenceValue[0] : preferenceValue || {}) as Record<string, unknown>
  const amenityRow = (Array.isArray(amenityValue) ? amenityValue[0] : amenityValue || {}) as Record<string, unknown>
  const images = (row.property_images || []) as Array<Record<string, unknown>>
  const amenityMap: Record<string, string> = { wifi: 'Wi-Fi', parking: 'Parking', attached_bathroom: 'Private Bathroom', ac: 'Air Conditioning', kitchen: 'Kitchen', washing_machine: 'In-unit Laundry', power_backup: 'Utilities Included' }
  const suitableMap: Record<string, string> = { students: 'Students', bachelors: 'Individuals', working_professionals: 'Working Professionals', families: 'Families', senior_citizens: 'Seniors', anyone: 'Anyone' }
  return {
    id: String(row.id), ownerId: String(row.owner_id), ownerName: String((row.owner as Record<string, unknown>)?.name || 'Verified owner'), ownerVerified: true,
    title: String(row.title), description: String(row.description || ''), address: String(row.address), city: String(row.city), state: String(row.state || ''), zipCode: String(row.zip_code || ''), locality: String(row.locality), landmark: String(row.landmark || ''),
    propertyType: String(row.property_type), rooms: Number(row.number_of_rooms || 1), rent: Number(row.rent), deposit: Number(row.deposit || 0), maintenance: Number(row.maintenance || 0),
    electricityCharge: Number(row.electricity_charge || 0), waterCharge: Number(row.water_charge || 0), availableFrom: String(row.available_from), status: row.status === 'rented' ? 'rented' : 'available',
    suitableFor: Object.entries(suitableMap).filter(([key]) => prefs[key]).map(([, value]) => value), genderPreference: String(prefs.gender_preference || 'Any'),
    petsAllowed: Boolean(prefs.pets_allowed), smokingAllowed: Boolean(prefs.smoking_allowed), foodRestrictions: String(prefs.food_restrictions || 'No preference'),
    amenities: Object.entries(amenityMap).filter(([key]) => amenityRow[key]).map(([, value]) => value), furnishing: String(amenityRow.furnishing || 'Unfurnished'),
    imageIndex: 0, imageUrls: images.sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((image) => String(image.image_url)), createdAt: String(row.created_at), saves: Number(row.favorite_count || 0),
  }
}

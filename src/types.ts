export type Role = 'tenant' | 'owner'
export type PropertyStatus = 'available' | 'rented'
export type InquiryStatus = 'sent' | 'viewed' | 'responded' | 'closed'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: Role
  age?: number
  occupation?: string
}

export interface Property {
  id: string
  ownerId: string
  ownerName: string
  ownerVerified: boolean
  title: string
  description: string
  address: string
  city: string
  state: string
  zipCode: string
  locality: string
  landmark?: string
  propertyType: string
  rooms: number
  rent: number
  deposit: number
  maintenance: number
  electricityCharge: number
  waterCharge: number
  availableFrom: string
  status: PropertyStatus
  suitableFor: string[]
  genderPreference: string
  petsAllowed: boolean
  smokingAllowed: boolean
  foodRestrictions: string
  amenities: string[]
  furnishing: string
  imageIndex: number
  imageUrls?: string[]
  createdAt: string
  saves: number
}

export interface TenantPreferences {
  preferredCity: string
  preferredLocality: string
  minBudget: number
  maxBudget: number
  propertyType: string
  tenantType: string
  furnishing: string
  requiredAmenities: string[]
  petsRequired: boolean
  foodPreference: string
}

export interface Inquiry {
  id: string
  propertyId: string
  tenantId: string
  tenantName: string
  message: string
  moveInDate: string
  contactPreference: string
  status: InquiryStatus
  createdAt: string
}

export interface SearchFilters {
  location: string
  minRent: number
  maxRent: number
  propertyType: string
  tenantType: string
  furnishing: string
  amenities: string[]
  petsAllowed: boolean
  foodPreference: string
  genderPreference: string
  availabilityDate: string
  sort: 'recommended' | 'lowest' | 'highest' | 'newest'
}

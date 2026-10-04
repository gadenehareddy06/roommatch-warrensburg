import type { Inquiry, Property, TenantPreferences, UserProfile } from '../types'

export const AMENITIES = ['Wi-Fi', 'Parking', 'Private Bathroom', 'Air Conditioning', 'In-unit Laundry', 'Kitchen', 'Utilities Included']
export const PROPERTY_TYPES = ['Private Room', 'Shared Room', 'Studio', '1 Bedroom', '2 Bedroom', '3+ Bedroom']
export const TENANT_TYPES = ['Students', 'Individuals', 'Working Professionals', 'Families', 'Seniors', 'Anyone']
export const FURNISHING = ['Furnished', 'Partially Furnished', 'Unfurnished']

export const demoTenant: UserProfile = { id: 'tenant-demo', name: 'Alex Johnson', email: 'alex@example.com', role: 'tenant', age: 26, occupation: 'Product designer' }
export const demoOwner: UserProfile = { id: 'owner-demo', name: 'Morgan Lee', email: 'morgan@example.com', role: 'owner', occupation: 'Property owner' }

export const defaultPreferences: TenantPreferences = {
  preferredCity: 'Warrensburg', preferredLocality: 'UCM Campus District', minBudget: 500, maxBudget: 1200,
  propertyType: '1 Bedroom', tenantType: 'Working Professionals', furnishing: 'Partially Furnished',
  requiredAmenities: ['Wi-Fi', 'Parking'], petsRequired: false, foodPreference: 'No preference',
}

export const demoProperties: Property[] = [
  {
    id: 'p1', ownerId: 'owner-demo', ownerName: 'Morgan Lee', ownerVerified: true,
    title: 'Bright student room near UCM', description: 'A quiet, sunny private room minutes from the University of Central Missouri with a dedicated study area, fast Wi-Fi, and shared common spaces.',
    address: '1200 Magnolia Lane', city: 'Warrensburg', state: 'MO', zipCode: '64093', locality: 'UCM Campus District', landmark: 'Near the UCM campus', propertyType: 'Private Room', rooms: 1,
    rent: 650, deposit: 500, maintenance: 0, electricityCharge: 45, waterCharge: 20, availableFrom: '2026-10-12', status: 'available',
    suitableFor: ['Students'], genderPreference: 'Any', petsAllowed: false, smokingAllowed: false, foodRestrictions: 'No preference',
    amenities: ['Wi-Fi', 'Private Bathroom', 'Utilities Included'], furnishing: 'Partially Furnished', imageIndex: 0, createdAt: '2026-09-29T09:00:00Z', saves: 28,
  },
  {
    id: 'p2', ownerId: 'owner-demo', ownerName: 'Morgan Lee', ownerVerified: true,
    title: 'Modern one-bedroom near downtown Warrensburg', description: 'Move-in-ready apartment with an updated kitchen and convenient access to downtown shops, restaurants, UCM, and everyday essentials.',
    address: '218 Pine Terrace', city: 'Warrensburg', state: 'MO', zipCode: '64093', locality: 'Downtown Warrensburg', landmark: 'Near the Johnson County Courthouse', propertyType: '1 Bedroom', rooms: 1,
    rent: 925, deposit: 700, maintenance: 0, electricityCharge: 65, waterCharge: 25, availableFrom: '2026-10-08', status: 'available',
    suitableFor: ['Working Professionals', 'Individuals'], genderPreference: 'Any', petsAllowed: true, smokingAllowed: false, foodRestrictions: 'No preference',
    amenities: ['Wi-Fi', 'Parking', 'Air Conditioning', 'Kitchen', 'In-unit Laundry'], furnishing: 'Furnished', imageIndex: 1, createdAt: '2026-10-01T12:00:00Z', saves: 46,
  },
  {
    id: 'p3', ownerId: 'owner-2', ownerName: 'Lakeside Homes', ownerVerified: true,
    title: 'Peaceful two-bedroom near Cave Hollow Park', description: 'A well-kept two-bedroom apartment with covered parking, a bright living room, nearby trails, and pet-friendly outdoor space.',
    address: '804 Meadow Ridge Court', city: 'Warrensburg', state: 'MO', zipCode: '64093', locality: 'West Warrensburg', landmark: 'Near Cave Hollow Park', propertyType: '2 Bedroom', rooms: 2,
    rent: 1250, deposit: 900, maintenance: 0, electricityCharge: 90, waterCharge: 35, availableFrom: '2026-11-01', status: 'available',
    suitableFor: ['Families', 'Working Professionals'], genderPreference: 'Any', petsAllowed: true, smokingAllowed: false, foodRestrictions: 'No preference',
    amenities: ['Parking', 'Private Bathroom', 'Kitchen', 'In-unit Laundry', 'Air Conditioning'], furnishing: 'Partially Furnished', imageIndex: 2, createdAt: '2026-09-26T08:30:00Z', saves: 39,
  },
  {
    id: 'p4', ownerId: 'owner-3', ownerName: 'Metro Living', ownerVerified: true,
    title: 'Friendly shared home near Whiteman AFB', description: 'A professionally managed shared home with personal storage, regular common-area cleaning, and an easy commute to Whiteman Air Force Base.',
    address: '106 Falcon Drive', city: 'Knob Noster', state: 'MO', zipCode: '65336', locality: 'Central Knob Noster', landmark: 'Near Whiteman AFB', propertyType: 'Shared Room', rooms: 1,
    rent: 575, deposit: 400, maintenance: 0, electricityCharge: 0, waterCharge: 0, availableFrom: '2026-10-15', status: 'available',
    suitableFor: ['Individuals', 'Working Professionals'], genderPreference: 'Any', petsAllowed: false, smokingAllowed: false, foodRestrictions: 'No preference',
    amenities: ['Wi-Fi', 'Air Conditioning', 'Private Bathroom', 'In-unit Laundry', 'Utilities Included'], furnishing: 'Furnished', imageIndex: 3, createdAt: '2026-10-02T10:10:00Z', saves: 51,
  },
  {
    id: 'p5', ownerId: 'owner-4', ownerName: 'Greenway Residences', ownerVerified: true,
    title: 'Accessible ground-floor apartment', description: 'Step-free access, wide doorways, a quiet courtyard, and convenient access to groceries, parks, and medical services.',
    address: '415 Hawthorne Place', city: 'Warrensburg', state: 'MO', zipCode: '64093', locality: 'North Warrensburg', propertyType: '1 Bedroom', rooms: 1,
    rent: 900, deposit: 650, maintenance: 0, electricityCharge: 60, waterCharge: 25, availableFrom: '2026-10-20', status: 'available',
    suitableFor: ['Seniors', 'Anyone'], genderPreference: 'Any', petsAllowed: true, smokingAllowed: false, foodRestrictions: 'No preference',
    amenities: ['Parking', 'Private Bathroom', 'Kitchen', 'Air Conditioning'], furnishing: 'Unfurnished', imageIndex: 4, createdAt: '2026-09-20T07:00:00Z', saves: 18,
  },
  {
    id: 'p6', ownerId: 'owner-demo', ownerName: 'Morgan Lee', ownerVerified: true,
    title: 'Compact studio in the heart of the city', description: 'Smartly planned studio with a neat kitchenette, generous daylight, and quick access to transit, cafes, and offices.',
    address: '309 Market Street', city: 'Warrensburg', state: 'MO', zipCode: '64093', locality: 'Downtown Warrensburg', propertyType: 'Studio', rooms: 1,
    rent: 800, deposit: 600, maintenance: 0, electricityCharge: 55, waterCharge: 20, availableFrom: '2026-10-18', status: 'rented',
    suitableFor: ['Students', 'Working Professionals'], genderPreference: 'Any', petsAllowed: false, smokingAllowed: false, foodRestrictions: 'No preference',
    amenities: ['Wi-Fi', 'Air Conditioning', 'Kitchen'], furnishing: 'Furnished', imageIndex: 5, createdAt: '2026-09-18T13:00:00Z', saves: 33,
  },
]

export const demoInquiries: Inquiry[] = [
  { id: 'i1', propertyId: 'p2', tenantId: 'tenant-demo', tenantName: 'Alex Johnson', message: 'Hi, I would like to tour this Saturday afternoon. Is the Wi-Fi included?', moveInDate: '2026-10-20', contactPreference: 'In-app chat', status: 'viewed', createdAt: '2026-10-03T10:30:00Z' },
  { id: 'i2', propertyId: 'p1', tenantId: 'tenant-2', tenantName: 'Taylor Smith', message: 'I am starting at UCM this term and would like to learn more about the house rules.', moveInDate: '2026-10-14', contactPreference: 'Email', status: 'sent', createdAt: '2026-10-03T08:10:00Z' },
]

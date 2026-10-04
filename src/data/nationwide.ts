import type { Property } from '../types'

// Synthetic demonstration inventory, never a representation of real availability or market prices.
export function cityDemoHomes(location: string): Property[] {
  const separator = location.lastIndexOf(', ')
  const city = location.slice(0, separator)
  const state = location.slice(separator + 2)
  if (separator < 0) return []
  return [0, 1].map(index => ({
    id: 'national-' + encodeURIComponent(location) + '-' + index,
    ownerId: 'owner-demo', ownerName: 'RoomMatch Demo Homes', ownerVerified: false,
    title: (index ? 'Spacious two-bedroom home' : 'Cozy furnished apartment') + ' in ' + city,
    description: 'Fictional sample listing for exploring RoomMatch. This home, price, address, and availability are illustrative only; this is not a real rental offer.',
    address: 'Fictional demo address', city, state, zipCode: '', locality: 'Sample neighborhood',
    propertyType: index ? '2 Bedroom' : '1 Bedroom', rooms: index ? 2 : 1,
    rent: index ? 1450 : 950, deposit: index ? 1000 : 700, maintenance: 0, electricityCharge: 0, waterCharge: 0,
    availableFrom: '2026-10-01', status: 'available', suitableFor: ['Anyone'],
    genderPreference: 'Any', petsAllowed: true, smokingAllowed: false, foodRestrictions: 'No preference',
    amenities: ['Wi-Fi', 'Parking', 'Kitchen', 'Air Conditioning', 'In-unit Laundry'],
    furnishing: index ? 'Unfurnished' : 'Furnished', imageIndex: index ? 2 : 1,
    createdAt: '2026-10-01T00:00:00Z', saves: 0,
  }))
}

const featuredCities = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Miami, FL', 'Seattle, WA', 'Denver, CO', 'Atlanta, GA', 'Boston, MA', 'Phoenix, AZ', 'Kansas City, MO']
export const nationwideDemoHomes = featuredCities.flatMap(cityDemoHomes)

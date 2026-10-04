import type { Property, TenantPreferences } from '../types'

export interface MatchResult { score: number; reasons: string[]; explanation: string }

export function calculateRoomMatch(property: Property, prefs: TenantPreferences): MatchResult {
  let score = 0
  const reasons: string[] = []
  const inBudget = property.rent >= prefs.minBudget && property.rent <= prefs.maxBudget
  if (inBudget) { score += 30; reasons.push('budget') }
  else if (property.rent <= prefs.maxBudget * 1.1) score += 15

  const cityMatch = !prefs.preferredCity || property.city.toLowerCase() === prefs.preferredCity.toLowerCase()
  const localityMatch = !prefs.preferredLocality || property.locality.toLowerCase().includes(prefs.preferredLocality.toLowerCase())
  if (cityMatch && localityMatch) { score += 20; reasons.push('preferred location') }
  else if (cityMatch) score += 12

  const tenantMatch = property.suitableFor.includes('Anyone') || property.suitableFor.includes(prefs.tenantType)
  if (tenantMatch) { score += 20; reasons.push('tenant type') }
  if (!prefs.propertyType || property.propertyType === prefs.propertyType) { score += 10; reasons.push('property type') }

  const amenityMatches = prefs.requiredAmenities.filter((item) => property.amenities.includes(item)).length
  score += prefs.requiredAmenities.length ? Math.round((amenityMatches / prefs.requiredAmenities.length) * 10) : 10
  if (amenityMatches === prefs.requiredAmenities.length) reasons.push('amenities')

  if (!prefs.furnishing || property.furnishing === prefs.furnishing) { score += 5; reasons.push('furnishing') }
  const otherMatch = (!prefs.petsRequired || property.petsAllowed) &&
    (!prefs.foodPreference || prefs.foodPreference === 'No restriction' || property.foodRestrictions === prefs.foodPreference)
  if (otherMatch) score += 5

  const finalScore = Math.min(100, score)
  const lead = reasons.slice(0, 4).join(', ')
  return {
    score: finalScore,
    reasons,
    explanation: lead ? `Matches your ${lead}.` : 'A partial match. Adjust your preferences for better recommendations.',
  }
}

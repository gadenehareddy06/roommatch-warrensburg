import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Bath, BedDouble, Building2, CalendarDays, Check, ChevronRight, CircleUserRound,
  Clock3, DollarSign, Heart, Home, LayoutDashboard, LoaderCircle, LocateFixed, Mail, MapPin,
  Menu, MessageCircle, PawPrint, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star,
  UploadCloud, Users, Wifi, X, Zap,
} from 'lucide-react'
import { AMENITIES, defaultPreferences, demoInquiries, demoOwner, demoProperties, demoTenant, FURNISHING, PROPERTY_TYPES, TENANT_TYPES } from './data/demo'
import { LocationPicker } from './components/LocationPicker'
import { cityDemoHomes, nationwideDemoHomes } from './data/nationwide'
import { calculateRoomMatch } from './lib/match'
import { isSupabaseConfigured, mapProperty, profileFromUser, requestPasswordReset, signIn, signUp, supabase } from './lib/supabase'
import type { Inquiry, InquiryStatus, Property, Role, SearchFilters, TenantPreferences, UserProfile } from './types'

type View = 'home' | 'search' | 'details' | 'tenant' | 'owner' | 'property-form'

const emptyFilters: SearchFilters = {
  location: '', minRent: 0, maxRent: 5000, propertyType: '', tenantType: '', furnishing: '', amenities: [],
  petsAllowed: false, foodPreference: '', genderPreference: '', availabilityDate: '', sort: 'recommended',
}

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const prettyDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

function propertyImageStyle(property: Property, offset = 0) {
  if (property.imageUrls?.[offset]) return { backgroundImage: `url(${property.imageUrls[offset]})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  const index = Math.min(5, (property.imageIndex + offset) % 6)
  return { backgroundImage: `url(${import.meta.env.BASE_URL}property-strip.png)`, backgroundSize: '600% 100%', backgroundPosition: `${index * 20}% center` }
}

function App() {
  const [view, setView] = useState<View>('home')
  const [properties, setProperties] = useState<Property[]>(() => isSupabaseConfigured ? [] : [...(JSON.parse(localStorage.getItem('roommatch:warrensburg:properties') || 'null') || demoProperties), ...nationwideDemoHomes].filter((p: Property, i: number, all: Property[]) => all.findIndex(item => item.id === p.id) === i))
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => isSupabaseConfigured ? [] : JSON.parse(localStorage.getItem('roommatch:warrensburg:inquiries') || 'null') || demoInquiries)
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(isSupabaseConfigured ? [] : JSON.parse(localStorage.getItem('roommatch:warrensburg:favorites') || '["p2"]')))
  const [user, setUser] = useState<UserProfile | null>(null)
  const [preferences, setPreferences] = useState<TenantPreferences>(() => JSON.parse(localStorage.getItem('roommatch:warrensburg:preferences') || 'null') || defaultPreferences)
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters)
  useEffect(() => {
    if (isSupabaseConfigured || !filters.location) return
    const samples = cityDemoHomes(filters.location)
    setProperties(current => [...current, ...samples.filter(sample => !current.some(item => item.id === sample.id))])
  }, [filters.location])
  const [selected, setSelected] = useState<Property | null>(null)
  const [editing, setEditing] = useState<Property | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const navigate = (next: View) => { setView(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    const client = supabase
    let active = true
    const load = async () => {
      try {
        const [{ data: auth }, { data: rows, error: propertyError }] = await Promise.all([
          client.auth.getUser(),
          client.from('properties').select('*, owner:profiles(name), property_preferences(*), property_amenities(*), property_images(*)').order('created_at', { ascending: false }),
        ])
        if (!active) return
        setUser(auth.user ? profileFromUser(auth.user) : null)
        if (auth.user) await loadPrivateData(auth.user.id)
        if (propertyError) throw propertyError
        setProperties((rows || []).map((row) => mapProperty({ ...row, status: String(row.status).toLowerCase(), property_type: row.property_type === 'Room' ? 'Private Room' : row.property_type })))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not connect to RoomMatch. Please try again.')
      } finally { if (active) setLoading(false) }
    }
    load()
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ? profileFromUser(session.user) : null
      setUser(next)
      // Do not await Supabase calls inside its auth lock callback.
      if (next) window.setTimeout(() => { if (active) void loadPrivateData(next.id) }, 0)
      else { setFavorites(new Set()); setInquiries([]) }
    })
    const channel = client.channel('roommatch-inquiries').on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, () => {
      client.auth.getUser().then(({ data }) => data.user && loadPrivateData(data.user.id))
    }).subscribe()
    return () => { active = false; listener.subscription.unsubscribe(); client.removeChannel(channel) }
  }, [])

  const loadPrivateData = async (userId: string) => {
    if (!supabase) return
    const [{ data: favs }, { data: inquiryRows }, { data: prefRows }] = await Promise.all([
      supabase.from('favorites').select('property_id').eq('user_id', userId),
      supabase.from('inquiries').select('*, tenant:profiles!inquiries_tenant_id_fkey(name)').order('created_at', { ascending: false }),
      supabase.from('tenant_preferences').select('*').eq('user_id', userId).maybeSingle(),
    ])
    setFavorites(new Set((favs || []).map((item) => String(item.property_id))))
    setInquiries((inquiryRows || []).map((row) => ({
      id: String(row.id), propertyId: String(row.property_id), tenantId: row.tenant_id,
      tenantName: (row.tenant as { name?: string } | null)?.name || 'Tenant', message: row.message,
      moveInDate: row.move_in_date, contactPreference: row.contact_preference, status: String(row.status).toLowerCase() as InquiryStatus, createdAt: row.created_at,
    })))
    if (prefRows) setPreferences({
      preferredCity: prefRows.preferred_city || '', preferredLocality: prefRows.preferred_locality || '', minBudget: prefRows.min_budget || 0,
      maxBudget: prefRows.max_budget || 5000, propertyType: prefRows.property_type || '', tenantType: prefRows.tenant_type || 'Anyone',
      furnishing: prefRows.furnishing || '', requiredAmenities: prefRows.required_amenities || [], petsRequired: prefRows.pets_required || false,
      foodPreference: prefRows.food_preference || 'No preference',
    })
  }

  useEffect(() => {
    if (isSupabaseConfigured) return
    localStorage.setItem('roommatch:warrensburg:properties', JSON.stringify(properties))
    localStorage.setItem('roommatch:warrensburg:inquiries', JSON.stringify(inquiries))
    localStorage.setItem('roommatch:warrensburg:favorites', JSON.stringify([...favorites]))
    localStorage.setItem('roommatch:warrensburg:preferences', JSON.stringify(preferences))
  }, [properties, inquiries, favorites, preferences])

  useEffect(() => {
    const openLogin = () => setAuthOpen(true)
    window.addEventListener('roommatch:login', openLogin)
    return () => window.removeEventListener('roommatch:login', openLogin)
  }, [])

  const scoredProperties = useMemo(() => properties.map((property) => ({ property, match: calculateRoomMatch(property, preferences) })), [properties, preferences])

  const openProperty = (property: Property) => { setSelected(property); navigate('details') }
  const requireUser = () => { if (!user) { setAuthOpen(true); notify('Sign in to continue'); return false } return true }

  const toggleFavorite = async (propertyId: string) => {
    if (!requireUser()) return
    const saved = favorites.has(propertyId)
    const next = new Set(favorites)
    saved ? next.delete(propertyId) : next.add(propertyId)
    setFavorites(next)
    try {
      if (supabase && user) {
        const { error: operationError } = saved
          ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', propertyId)
          : await supabase.from('favorites').insert({ user_id: user.id, property_id: propertyId })
        if (operationError) throw operationError
      }
      notify(saved ? 'Removed from saved homes' : 'Saved to your shortlist')
    } catch (caught) { setFavorites(favorites); notify('Could not update saved homes') }
  }

  const sendInquiry = async (draft: Omit<Inquiry, 'id' | 'tenantId' | 'tenantName' | 'status' | 'createdAt'>) => {
    if (!user || !selected) return
    try {
      if (supabase) {
        const { data, error: insertError } = await supabase.from('inquiries').insert({
          property_id: draft.propertyId, tenant_id: user.id, message: draft.message,
          move_in_date: draft.moveInDate, contact_preference: draft.contactPreference,
        }).select().single()
        if (insertError) throw insertError
        setInquiries((current) => [{ id: data.id, tenantId: user.id, tenantName: user.name, status: 'sent', createdAt: data.created_at, ...draft }, ...current])
      } else {
        setInquiries((current) => [{ id: crypto.randomUUID(), tenantId: user.id, tenantName: user.name, status: 'sent', createdAt: new Date().toISOString(), ...draft }, ...current])
      }
      notify('Inquiry sent securely')
      navigate('tenant')
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Could not send inquiry') }
  }

  const updateInquiryStatus = async (id: string, status: InquiryStatus) => {
    const previous = inquiries
    setInquiries((items) => items.map((item) => item.id === id ? { ...item, status } : item))
    if (supabase) {
      const { error: updateError } = await supabase.from('inquiries').update({ status }).eq('id', id)
      if (updateError) { setInquiries(previous); notify('Status update failed'); return }
    }
    notify('Inquiry status updated')
  }

  const savePreferences = async (next: TenantPreferences) => {
    setPreferences(next)
    if (supabase && user) {
      const { error: prefError } = await supabase.from('tenant_preferences').upsert({
        user_id: user.id, preferred_city: next.preferredCity, preferred_locality: next.preferredLocality,
        min_budget: next.minBudget, max_budget: next.maxBudget, property_type: next.propertyType,
        tenant_type: next.tenantType, furnishing: next.furnishing, required_amenities: next.requiredAmenities,
        pets_required: next.petsRequired, food_preference: next.foodPreference,
      })
      if (prefError) return notify('Preferences could not be saved')
    }
    notify('Preferences saved — recommendations refreshed')
  }

  const saveProperty = async (draft: Property, files: File[]) => {
    try {
      let completed = draft
      if (supabase && user) {
        const payload = {
          owner_id: user.id, title: draft.title, description: draft.description, address: draft.address, city: draft.city,
          locality: draft.locality, state: draft.state, zip_code: draft.zipCode, landmark: draft.landmark || null, property_type: draft.propertyType, number_of_rooms: draft.rooms,
          rent: draft.rent, deposit: draft.deposit, maintenance: draft.maintenance, electricity_charge: draft.electricityCharge,
          water_charge: draft.waterCharge, available_from: draft.availableFrom, status: draft.status,
        }
        const query = draft.id && !draft.id.startsWith('draft-')
          ? supabase.from('properties').update(payload).eq('id', draft.id).select().single()
          : supabase.from('properties').insert(payload).select().single()
        const { data: propertyRow, error: propertyError } = await query
        if (propertyError) throw propertyError
        const propertyId = String(propertyRow.id)
        const suitable = (key: string) => draft.suitableFor.includes(key)
        await Promise.all([
          supabase.from('property_preferences').upsert({ property_id: propertyId, students: suitable('Students'), bachelors: suitable('Individuals'), working_professionals: suitable('Working Professionals'), families: suitable('Families'), senior_citizens: suitable('Seniors'), anyone: suitable('Anyone'), gender_preference: draft.genderPreference, pets_allowed: draft.petsAllowed, smoking_allowed: draft.smokingAllowed, food_restrictions: draft.foodRestrictions }),
          supabase.from('property_amenities').upsert({ property_id: propertyId, wifi: draft.amenities.includes('Wi-Fi'), parking: draft.amenities.includes('Parking'), attached_bathroom: draft.amenities.includes('Private Bathroom'), ac: draft.amenities.includes('Air Conditioning'), kitchen: draft.amenities.includes('Kitchen'), washing_machine: draft.amenities.includes('In-unit Laundry'), power_backup: draft.amenities.includes('Utilities Included'), furnishing: draft.furnishing }),
        ])
        const urls: string[] = []
        if (files.length) await supabase.from('property_images').update({ is_primary: false }).eq('property_id', propertyId)
        for (const [index, file] of files.entries()) {
          const path = `${user.id}/${propertyId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`
          const { error: uploadError } = await supabase.storage.from('property-images').upload(path, file, { upsert: false })
          if (uploadError) throw uploadError
          const { data: publicUrl } = supabase.storage.from('property-images').getPublicUrl(path)
          urls.push(publicUrl.publicUrl)
          await supabase.from('property_images').insert({ property_id: propertyId, image_url: publicUrl.publicUrl, storage_path: path, is_primary: index === 0 })
        }
        completed = { ...draft, id: propertyId, imageUrls: urls.length ? urls : draft.imageUrls }
      }
      setProperties((items) => items.some((item) => item.id === completed.id) ? items.map((item) => item.id === completed.id ? completed : item) : [completed, ...items])
      notify(editing ? 'Property updated' : 'Property published')
      setEditing(null)
      navigate('owner')
    } catch (caught) { notify(caught instanceof Error ? caught.message : 'Property could not be saved') }
  }

  const removeProperty = async (id: string) => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    if (supabase) {
      const { data: imageRows } = await supabase.from('property_images').select('storage_path').eq('property_id', id)
      const paths = (imageRows || []).map((row) => row.storage_path as string).filter(Boolean)
      if (paths.length) await supabase.storage.from('property-images').remove(paths)
      const { error: deleteError } = await supabase.from('properties').delete().eq('id', id)
      if (deleteError) return notify('Could not delete this property')
    }
    setProperties((items) => items.filter((item) => item.id !== id))
    notify('Property removed')
  }

  const switchDemoRole = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) { notify(error.message); return }
    }
    setUser(null)
    navigate('home')
    notify('Signed out. You can now sign in with another account.')
  }

  return (
    <div className="app-shell">
      <Navbar user={user} view={view} mobileOpen={mobileNav} setMobileOpen={setMobileNav} onNavigate={navigate} onAuth={() => setAuthOpen(true)} onSwitch={switchDemoRole} />
      {!isSupabaseConfigured && <div className="demo-banner"><Sparkles size={15} /> Interactive demo mode <span>· Add Supabase keys to enable the live backend</span></div>}
      {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')}><X size={18} /></button></div>}
      {loading ? <LoadingPage /> : (
        <main>
          {view === 'home' && <Landing properties={scoredProperties.slice(0, 3)} onNavigate={navigate} onOpen={openProperty} onSearch={(next) => { setFilters((current) => ({ ...current, ...next })); navigate('search') }} favorites={favorites} onFavorite={toggleFavorite} />}
          {view === 'search' && <SearchPage items={scoredProperties} filters={filters} setFilters={setFilters} favorites={favorites} onFavorite={toggleFavorite} onOpen={openProperty} />}
          {view === 'details' && selected && <PropertyDetails property={selected} match={calculateRoomMatch(selected, preferences)} saved={favorites.has(selected.id)} onBack={() => navigate('search')} onFavorite={() => toggleFavorite(selected.id)} onInquiry={sendInquiry} requireUser={requireUser} />}
          {view === 'tenant' && <TenantDashboard user={user} properties={properties} inquiries={inquiries.filter((item) => !user || item.tenantId === user.id)} favorites={favorites} preferences={preferences} onSavePreferences={savePreferences} onOpen={openProperty} onFavorite={toggleFavorite} onBrowse={() => navigate('search')} />}
          {view === 'owner' && <OwnerDashboard user={user} properties={properties.filter((property) => !user || property.ownerId === user.id || (!isSupabaseConfigured && property.ownerId === 'owner-demo'))} inquiries={inquiries} favorites={favorites} onAdd={() => { setEditing(null); navigate('property-form') }} onEdit={(property) => { setEditing(property); navigate('property-form') }} onDelete={removeProperty} onStatus={async (property) => saveProperty({ ...property, status: property.status === 'available' ? 'rented' : 'available' }, [])} onInquiryStatus={updateInquiryStatus} />}
          {view === 'property-form' && (!user ? <LoginRequired onLogin={() => setAuthOpen(true)}/> : user.role !== 'owner' ? <OwnerRequired onSwitch={switchDemoRole}/> : <PropertyForm property={editing} user={user} onCancel={() => navigate('owner')} onSave={saveProperty} />)}
        </main>
      )}
      <Footer onNavigate={navigate} />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onDemo={(role) => { const next = role === 'owner' ? demoOwner : demoTenant; setUser(next); setAuthOpen(false); navigate(role === 'owner' ? 'owner' : 'search'); notify(`Welcome, ${next.name.split(' ')[0]}`) }} />}
      {toast && <div className="toast"><Check size={18} />{toast}</div>}
    </div>
  )
}

interface NavProps { user: UserProfile | null; view: View; mobileOpen: boolean; setMobileOpen: (value: boolean) => void; onNavigate: (view: View) => void; onAuth: () => void; onSwitch: () => void }
function Navbar({ user, view, mobileOpen, setMobileOpen, onNavigate, onAuth, onSwitch }: NavProps) {
  return <header className="navbar">
    <div className="nav-inner">
      <button className="brand" onClick={() => onNavigate('home')} aria-label="RoomMatch home"><span className="brand-mark"><Home size={20} /></span><span>Room<span>Match</span></span></button>
      <nav className={cx('nav-links', mobileOpen && 'open')} aria-label="Main navigation">
        <button className={view === 'search' ? 'active' : ''} onClick={() => onNavigate('search')}>Find a room</button>
        <button onClick={() => onNavigate(user?.role === 'owner' ? 'owner' : 'tenant')}>Dashboard</button>
        <button className="nav-list-button" onClick={() => user ? onNavigate('property-form') : onAuth()}><Plus size={16} /> List your property</button>
      </nav>
      <div className="nav-actions">
        {user ? <><div className="user-chip"><span>{user.name.slice(0, 1)}</span><span className="user-copy"><b>{user.name.split(' ')[0]}</b><small>{user.role} {isSupabaseConfigured ? '' : 'demo'}</small></span></div><button className="button button-sm button-ghost" onClick={onSwitch}>Sign out</button></> : <button className="button button-sm" onClick={onAuth}>Sign in / Sign up</button>}
        <button className="menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">{mobileOpen ? <X /> : <Menu />}</button>
      </div>
    </div>
  </header>
}

interface LandingProps { properties: Array<{ property: Property; match: ReturnType<typeof calculateRoomMatch> }>; favorites: Set<string>; onFavorite: (id: string) => void; onOpen: (property: Property) => void; onNavigate: (view: View) => void; onSearch: (filters: Partial<SearchFilters>) => void }
function Landing({ properties, favorites, onFavorite, onOpen, onNavigate, onSearch }: LandingProps) {
  const [location, setLocation] = useState('Warrensburg, MO')
  const [minRent, setMinRent] = useState('0')
  const [maxRent, setMaxRent] = useState('5000')
  const [tenantType, setTenantType] = useState('Working Professionals')
  const submit = (event: FormEvent) => { event.preventDefault(); onSearch({ location, minRent: Number(minRent) || 0, maxRent: Number(maxRent) || 5000, tenantType }) }
  return <>
    <section className="hero-section">
      <div className="hero-orb one"/><div className="hero-orb two"/>
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><Star size={15} fill="currentColor" /> Smarter rental discovery</div>
          <h1>Find a place that <em>fits your life.</em></h1>
          <p>Discover rooms and homes based on your budget, lifestyle, and who you're looking to live with.</p>
          <div className="hero-actions"><button className="button button-lg" onClick={() => onNavigate('search')}>Find a room <ChevronRight size={18}/></button><button className="button button-lg button-ghost" onClick={() => onNavigate('property-form')}>List your property</button></div>
          <div className="trust-row"><span><ShieldCheck size={18}/> Verified owners</span><span><Sparkles size={18}/> Smart matching</span><span><MessageCircle size={18}/> Private inquiries</span></div>
        </div>
        <div className="hero-visual" aria-label="Bright rental home interior">
          <div className="hero-photo" style={propertyImageStyle(demoProperties[2])} />
          <div className="floating-card match-float"><span className="score-ring">94%</span><span><b>Excellent match</b><small>Budget · Location · Lifestyle</small></span></div>
          <div className="floating-card verified-float"><ShieldCheck size={22}/><span><b>Owner verified</b><small>Identity checked</small></span></div>
        </div>
      </div>
      <form className="hero-search container" onSubmit={submit}>
        <label><span><MapPin size={16}/> Location</span><LocationPicker value={location} onChange={setLocation}/></label>
        <label><span><DollarSign size={16}/> Minimum rent</span><input type="number" min="0" value={minRent} onChange={(e) => setMinRent(e.target.value)} /></label>
        <label><span><DollarSign size={16}/> Maximum rent</span><input type="number" min="0" value={maxRent} onChange={(e) => setMaxRent(e.target.value)} /></label>
        <label><span><Users size={16}/> Looking for</span><select value={tenantType} onChange={(e) => setTenantType(e.target.value)}>{TENANT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <button className="button search-submit"><Search size={19}/> Search</button>
      </form>
    </section>

    <section className="section container how-section"><div className="section-heading center"><span>HOW IT WORKS</span><h2>A better way to find your next home</h2><p>More context, less guesswork. RoomMatch brings preference-led discovery and private communication into one simple flow.</p></div>
      <div className="steps-grid">{[
        [Search, '01', 'Tell us what fits', 'Set your location, budget, lifestyle, and must-have amenities.'],
        [Sparkles, '02', 'See your best matches', 'Every home gets a transparent compatibility score based on your needs.'],
        [MessageCircle, '03', 'Connect privately', 'Save a shortlist and send secure inquiries without exposing private details.'],
      ].map(([Icon, number, title, copy]) => { const StepIcon = Icon as typeof Search; return <article className="step-card" key={String(number)}><span className="step-number">{String(number)}</span><span className="step-icon"><StepIcon /></span><h3>{String(title)}</h3><p>{String(copy)}</p></article> })}</div>
    </section>

    <section className="section section-tint"><div className="container"><div className="section-heading row-heading"><div><span>CURATED FOR YOU</span><h2>Homes worth a closer look</h2></div><button className="text-link" onClick={() => onNavigate('search')}>Browse all homes <ChevronRight size={17}/></button></div>
      <div className="property-grid">{properties.map(({ property, match }) => <PropertyCard key={property.id} property={property} match={match} saved={favorites.has(property.id)} onFavorite={onFavorite} onOpen={onOpen}/>)}</div>
    </div></section>

    <section className="section container"><div className="benefit-grid">
      <article className="benefit-card tenant-benefit"><span className="mini-label">FOR RENT SEEKERS</span><h2>Stop scrolling.<br/>Start matching.</h2><p>Get recommendations that consider the details that actually shape daily life.</p><ul><li><Check/> Explainable RoomMatch Scores</li><li><Check/> Private owner inquiries</li><li><Check/> One place for saved homes</li></ul><button className="button button-light" onClick={() => onNavigate('search')}>Explore homes</button></article>
      <article className="benefit-card owner-benefit"><span className="mini-label">FOR PROPERTY OWNERS</span><h2>Meet tenants<br/>who truly fit.</h2><p>Share clear suitability details, manage listings, and organize qualified inquiries.</p><ul><li><Check/> Guided property listing</li><li><Check/> Inquiry status workflow</li><li><Check/> Performance snapshot</li></ul><button className="button button-dark" onClick={() => onNavigate('property-form')}>List a property</button></article>
    </div></section>
    <section className="cta-band"><div className="container"><div><span className="eyebrow light"><Sparkles size={15}/> Your next chapter starts here</span><h2>Ready to find your fit?</h2><p>Join RoomMatch and discover a rental experience built around real life.</p></div><button className="button button-light button-lg" onClick={() => onNavigate('search')}>Start searching <ChevronRight size={18}/></button></div></section>
  </>
}

interface CardProps { property: Property; match: ReturnType<typeof calculateRoomMatch>; saved: boolean; onFavorite: (id: string) => void; onOpen: (property: Property) => void }
function PropertyCard({ property, match, saved, onFavorite, onOpen }: CardProps) {
  return <article className="property-card">
    <div className="property-image" style={propertyImageStyle(property)}>
      <span className={cx('match-badge', match.score >= 85 && 'great')}><Sparkles size={13}/>{match.score}% match</span>
      <button className={cx('heart-button', saved && 'saved')} onClick={() => onFavorite(property.id)} aria-label={saved ? 'Remove from saved' : 'Save property'}><Heart size={19} fill={saved ? 'currentColor' : 'none'}/></button>
      {property.status === 'rented' && <span className="rented-overlay">Currently rented</span>}
    </div>
    <div className="property-body">
      <div className="property-topline"><span>{property.propertyType}</span><span>·</span><span>{property.furnishing}</span></div>
      <h3>{property.title}</h3>
      <p className="location"><MapPin size={15}/>{property.locality}, {property.city}, {property.state}</p>
      <div className="property-price"><strong>{money(property.rent)}</strong><span>/ month</span><small>Deposit {money(property.deposit)}</small></div>
      <div className="amenity-row">{property.amenities.slice(0, 3).map((item) => <span key={item}>{item === 'Wi-Fi' ? <Wifi/> : item === 'Private Bathroom' ? <Bath/> : item === 'Utilities Included' ? <Zap/> : <Check/>}{item}</span>)}</div>
      <div className="property-footer"><span><CalendarDays size={15}/> From {prettyDate(property.availableFrom)}</span><button onClick={() => onOpen(property)}>View details <ChevronRight size={16}/></button></div>
    </div>
  </article>
}

interface SearchProps { items: Array<{ property: Property; match: ReturnType<typeof calculateRoomMatch> }>; filters: SearchFilters; setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>; favorites: Set<string>; onFavorite: (id: string) => void; onOpen: (property: Property) => void }
function SearchPage({ items, filters, setFilters, favorites, onFavorite, onOpen }: SearchProps) {
  const [drawer, setDrawer] = useState(false)
  const toggleAmenity = (amenity: string) => setFilters((current) => ({ ...current, amenities: current.amenities.includes(amenity) ? current.amenities.filter((item) => item !== amenity) : [...current.amenities, amenity] }))
  const filtered = useMemo(() => {
    const location = filters.location.trim().toLowerCase()
    const date = filters.availabilityDate ? new Date(filters.availabilityDate) : null
    return [...items].filter(({ property }) => {
      const normalizedLocation = location.replace(/[^a-z0-9]/g, '')
      const propertyLocation = `${property.city} ${property.state} ${property.zipCode} ${property.locality}`.toLowerCase().replace(/[^a-z0-9]/g, '')
      const matchesLocation = !normalizedLocation || propertyLocation.includes(normalizedLocation)
      return matchesLocation && property.rent >= filters.minRent && property.rent <= filters.maxRent &&
        (!filters.propertyType || property.propertyType === filters.propertyType) &&
        (!filters.tenantType || property.suitableFor.includes(filters.tenantType) || property.suitableFor.includes('Anyone')) &&
        (!filters.furnishing || property.furnishing === filters.furnishing) && filters.amenities.every((item) => property.amenities.includes(item)) &&
        (!filters.petsAllowed || property.petsAllowed) && (!filters.genderPreference || property.genderPreference === filters.genderPreference) &&
        (!filters.foodPreference || property.foodRestrictions === filters.foodPreference || property.foodRestrictions === 'No restriction') &&
        (!date || new Date(property.availableFrom) <= date)
    }).sort((a, b) => filters.sort === 'lowest' ? a.property.rent - b.property.rent : filters.sort === 'highest' ? b.property.rent - a.property.rent : filters.sort === 'newest' ? +new Date(b.property.createdAt) - +new Date(a.property.createdAt) : b.match.score - a.match.score)
  }, [items, filters])
  const activeCount = [filters.propertyType, filters.tenantType, filters.furnishing, filters.petsAllowed, filters.genderPreference, filters.foodPreference, filters.availabilityDate, ...filters.amenities].filter(Boolean).length
  return <div className="search-page container">
    <div className="search-heading"><div><span className="eyebrow"><Sparkles size={14}/> Rooms picked for your life</span><h1>Find your next place</h1><p>Explore homes across the United States and see why each one matches.</p></div></div>
    <div className="search-bar-inline"><div><MapPin/><LocationPicker value={filters.location} onChange={location => setFilters({ ...filters, location })}/></div><div><DollarSign/><input type="number" value={filters.minRent || ''} onChange={(e) => setFilters({ ...filters, minRent: Number(e.target.value) || 0 })} placeholder="Min rent"/></div><div><DollarSign/><input type="number" value={filters.maxRent} onChange={(e) => setFilters({ ...filters, maxRent: Number(e.target.value) || 5000 })} placeholder="Max rent"/></div><button className="button" onClick={() => null}><Search/> Search</button></div>
    <button className="mobile-filter-button button button-ghost" onClick={() => setDrawer(true)}><SlidersHorizontal size={18}/> Filters {activeCount > 0 && <span>{activeCount}</span>}</button>
    <div className="search-layout">
      <aside className={cx('filter-panel', drawer && 'drawer-open')}><div className="filter-mobile-head"><h2>Filters</h2><button onClick={() => setDrawer(false)}><X/></button></div><FilterContent filters={filters} setFilters={setFilters} toggleAmenity={toggleAmenity}/><button className="button apply-filter" onClick={() => setDrawer(false)}>Show {filtered.length} homes</button></aside>
      {drawer && <button className="drawer-backdrop" aria-label="Close filters" onClick={() => setDrawer(false)}/>} 
      <section className="results-area">{!isSupabaseConfigured && <p className="demo-inventory-note">Demo inventory · Homes and prices are fictional examples, not real rental offers. Choose any city to explore sample homes.</p>}<div className="results-toolbar"><p><strong>{filtered.length}</strong> homes found {filters.location && <>near <b>{filters.location}</b></>}</p><label>Sort by <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as SearchFilters['sort'] })}><option value="recommended">Recommended</option><option value="lowest">Lowest rent</option><option value="highest">Highest rent</option><option value="newest">Newest</option></select></label></div>
        {filtered.length ? <div className="property-grid search-results">{filtered.map(({ property, match }) => <PropertyCard key={property.id} property={property} match={match} saved={favorites.has(property.id)} onFavorite={onFavorite} onOpen={onOpen}/>)}</div> : <EmptyState icon={Search} title="No rooms match your filters" copy="Try increasing your budget or expanding your search area." action="Clear filters" onAction={() => setFilters(emptyFilters)}/>} 
      </section>
    </div>
  </div>
}

function FilterContent({ filters, setFilters, toggleAmenity }: { filters: SearchFilters; setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>; toggleAmenity: (value: string) => void }) {
  return <div className="filter-content">
    <div className="filter-title"><span><SlidersHorizontal size={18}/> Filters</span><button onClick={() => setFilters(emptyFilters)}>Reset</button></div>
    <FilterGroup title="Property type"><div className="chip-grid">{PROPERTY_TYPES.map((item) => <button key={item} className={filters.propertyType === item ? 'selected' : ''} onClick={() => setFilters({ ...filters, propertyType: filters.propertyType === item ? '' : item })}>{item}</button>)}</div></FilterGroup>
    <FilterGroup title="Suitable for"><select value={filters.tenantType} onChange={(e) => setFilters({ ...filters, tenantType: e.target.value })}><option value="">Anyone</option>{TENANT_TYPES.slice(0, -1).map((item) => <option key={item}>{item}</option>)}</select></FilterGroup>
    <FilterGroup title="Furnishing"><div className="radio-stack">{FURNISHING.map((item) => <label key={item}><input type="radio" name="furnishing" checked={filters.furnishing === item} onChange={() => setFilters({ ...filters, furnishing: item })}/><span/>{item}</label>)}</div></FilterGroup>
    <FilterGroup title="Amenities"><div className="check-stack">{AMENITIES.map((item) => <label key={item}><input type="checkbox" checked={filters.amenities.includes(item)} onChange={() => toggleAmenity(item)}/><span><Check/></span>{item}</label>)}</div></FilterGroup>
    <FilterGroup title="Preferences"><label className="switch-row">Pets allowed <input type="checkbox" checked={filters.petsAllowed} onChange={(e) => setFilters({ ...filters, petsAllowed: e.target.checked })}/><span/></label><select value={filters.foodPreference} onChange={(e) => setFilters({ ...filters, foodPreference: e.target.value })}><option value="">Any food preference</option><option>Vegetarian only</option><option>Vegetarian preferred</option><option>No restriction</option></select><select value={filters.genderPreference} onChange={(e) => setFilters({ ...filters, genderPreference: e.target.value })}><option value="">Any gender preference</option><option>Any</option><option>Women</option><option>Men</option></select></FilterGroup>
    <FilterGroup title="Available by"><input type="date" value={filters.availabilityDate} onChange={(e) => setFilters({ ...filters, availabilityDate: e.target.value })}/></FilterGroup>
  </div>
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) { return <div className="filter-group"><h3>{title}</h3>{children}</div> }

interface DetailProps { property: Property; match: ReturnType<typeof calculateRoomMatch>; saved: boolean; onBack: () => void; onFavorite: () => void; onInquiry: (draft: Omit<Inquiry, 'id' | 'tenantId' | 'tenantName' | 'status' | 'createdAt'>) => void; requireUser: () => boolean }
function PropertyDetails({ property, match, saved, onBack, onFavorite, onInquiry, requireUser }: DetailProps) {
  const [inquiryOpen, setInquiryOpen] = useState(false)
  return <div className="details-page container">
    <button className="back-link" onClick={onBack}><ArrowLeft size={18}/> Back to results</button>
    <div className="gallery-grid"><div className="gallery-main" style={propertyImageStyle(property, 0)}/><div style={propertyImageStyle(property, 1)}/><div style={propertyImageStyle(property, 2)}/><span>{property.imageUrls?.length || 3} photos</span></div>
    <div className="detail-layout"><section className="detail-main">
      <div className="detail-title-row"><div><div className="property-topline"><span>{property.propertyType}</span><span>·</span><span>{property.furnishing}</span></div><h1>{property.title}</h1><p className="location"><MapPin size={17}/>{property.address}, {property.city}, {property.state} {property.zipCode}</p></div><button className={cx('save-detail', saved && 'saved')} onClick={onFavorite}><Heart fill={saved ? 'currentColor' : 'none'}/>{saved ? 'Saved' : 'Save'}</button></div>
      <div className="match-explanation"><div className="large-score">{match.score}<small>%</small></div><div><span><Sparkles size={15}/> RoomMatch Score</span><h3>{match.score >= 85 ? 'This looks like a great fit' : 'A promising match'}</h3><p>{match.explanation}</p></div></div>
      <div className="detail-stat-grid"><div><BedDouble/><span><b>{property.rooms}</b> room{property.rooms > 1 ? 's' : ''}</span></div><div><Building2/><span><b>{property.propertyType}</b> type</span></div><div><CalendarDays/><span><b>{prettyDate(property.availableFrom)}</b> available</span></div><div><ShieldCheck/><span><b>{property.ownerVerified ? 'Verified' : 'Unverified'}</b> owner</span></div></div>
      <DetailSection title="About this home"><p>{property.description}</p></DetailSection>
      <DetailSection title="Amenities"><div className="detail-amenities">{property.amenities.map((item) => <span key={item}>{item === 'Wi-Fi' ? <Wifi/> : item === 'Utilities Included' ? <Zap/> : item === 'Private Bathroom' ? <Bath/> : <Check/>}{item}</span>)}</div></DetailSection>
      <DetailSection title="House preferences"><div className="preference-grid"><span><Users/> Suitable for <b>{property.suitableFor.join(', ')}</b></span><span><CircleUserRound/> Gender preference <b>{property.genderPreference}</b></span><span><PawPrint/> Pets <b>{property.petsAllowed ? 'Allowed' : 'Not allowed'}</b></span><span><Zap/> Smoking <b>{property.smokingAllowed ? 'Allowed' : 'Not allowed'}</b></span></div></DetailSection>
      <DetailSection title="Approximate location"><div className="map-placeholder"><div className="map-lines"/><span className="map-pin"><MapPin fill="currentColor"/></span><div><b>{property.locality}, {property.city}, {property.state}</b><small>Exact address shared after the owner responds</small></div></div></DetailSection>
    </section>
    <aside className="contact-card"><div className="rent-line"><strong>{money(property.rent)}</strong><span>/ month</span></div><div className="cost-row"><span>Security deposit</span><b>{money(property.deposit)}</b></div><div className="cost-row"><span>Maintenance</span><b>{property.maintenance ? `${money(property.maintenance)}/mo` : 'Included'}</b></div><hr/><div className="owner-row"><span>{property.ownerName.slice(0, 1)}</span><div><small>PROPERTY OWNER</small><b>{property.ownerName}</b><em><ShieldCheck size={14}/> Identity verified</em></div></div>
      {property.status === 'available' ? <button className="button full" onClick={() => { if (requireUser()) setInquiryOpen(true) }}><MessageCircle size={18}/> Send inquiry</button> : <div className="unavailable-note">This property is currently rented.</div>}
      <button className="button button-ghost full" onClick={onFavorite}><Heart size={18}/>{saved ? 'Remove from saved' : 'Save property'}</button><p className="privacy-note"><ShieldCheck size={15}/> Owner contact details stay private until they choose to share them.</p>
    </aside></div>
    {inquiryOpen && <InquiryModal property={property} onClose={() => setInquiryOpen(false)} onSubmit={(draft) => { setInquiryOpen(false); onInquiry(draft) }}/>} 
  </div>
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="detail-section"><h2>{title}</h2>{children}</section> }

function InquiryModal({ property, onClose, onSubmit }: { property: Property; onClose: () => void; onSubmit: DetailProps['onInquiry'] }) {
  const [message, setMessage] = useState(`Hi, I'm interested in ${property.title}. Could we arrange a visit?`)
  const [moveInDate, setMoveInDate] = useState(property.availableFrom)
  const [contactPreference, setContactPreference] = useState('In-app chat')
  return <Modal title="Send a private inquiry" subtitle={property.title} onClose={onClose}><form className="modal-form" onSubmit={(e) => { e.preventDefault(); if (message.trim().length < 10) return; onSubmit({ propertyId: property.id, message: message.trim(), moveInDate, contactPreference }) }}><label>Message<textarea rows={5} required minLength={10} value={message} onChange={(e) => setMessage(e.target.value)}/></label><div className="form-two"><label>Preferred move-in<input type="date" required value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)}/></label><label>Contact preference<select value={contactPreference} onChange={(e) => setContactPreference(e.target.value)}><option>In-app chat</option><option>Email</option><option>Phone call, if shared</option></select></label></div><div className="privacy-box"><ShieldCheck/> Your contact details are only visible to the owner for this inquiry.</div><button className="button full" type="submit">Send inquiry <ChevronRight size={17}/></button></form></Modal>
}

interface TenantDashProps { user: UserProfile | null; properties: Property[]; inquiries: Inquiry[]; favorites: Set<string>; preferences: TenantPreferences; onSavePreferences: (next: TenantPreferences) => void; onOpen: (property: Property) => void; onFavorite: (id: string) => void; onBrowse: () => void }
function TenantDashboard({ user, properties, inquiries, favorites, preferences, onSavePreferences, onOpen, onFavorite, onBrowse }: TenantDashProps) {
  const [tab, setTab] = useState<'overview' | 'saved' | 'inquiries' | 'profile'>('overview')
  const saved = properties.filter((property) => favorites.has(property.id))
  const recommended = properties.map((property) => ({ property, match: calculateRoomMatch(property, preferences) })).sort((a, b) => b.match.score - a.match.score).slice(0, 3)
  if (!user) return <LoginRequired onLogin={() => window.dispatchEvent(new CustomEvent('roommatch:login'))}/>
  return <div className="dashboard-page container"><DashboardSidebar role="tenant" tab={tab} setTab={(value) => setTab(value as typeof tab)} user={user}/><div className="dashboard-content">
    {tab === 'overview' && <><div className="dash-welcome"><div><span>GOOD MORNING</span><h1>Welcome back, {user.name.split(' ')[0]}</h1><p>Your next place might be one of today's top matches.</p></div><button className="button" onClick={onBrowse}><Search size={18}/> Find a room</button></div>
      <div className="stats-grid"><StatCard icon={Heart} label="Saved homes" value={saved.length} note="In your shortlist"/><StatCard icon={MessageCircle} label="Active inquiries" value={inquiries.filter((i) => i.status !== 'closed').length} note="Awaiting owner updates"/><StatCard icon={Sparkles} label="Top match" value={`${recommended[0]?.match.score || 0}%`} note="Based on your profile"/><StatCard icon={Clock3} label="Recent searches" value="3" note="Warrensburg · Knob Noster"/></div>
      <div className="dashboard-section-head"><div><h2>Recommended for you</h2><p>Calculated from your saved preferences</p></div><button className="text-link" onClick={onBrowse}>View all <ChevronRight/></button></div><div className="property-grid dashboard-cards">{recommended.map(({ property, match }) => <PropertyCard key={property.id} property={property} match={match} saved={favorites.has(property.id)} onFavorite={onFavorite} onOpen={onOpen}/>)}</div>
      <div className="requirement-card"><div><span className="eyebrow light"><Sparkles/> NEW</span><h2>Can't find the right place?</h2><p>Post a requirement like “I need a one-bedroom in Warrensburg, budget $1,000, with parking.”</p></div><button className="button button-light" onClick={() => alert('Requirement saved as a draft for this demo.')}>Post a requirement</button></div>
    </>}
    {tab === 'saved' && <><PageTitle title="Saved properties" copy="Your shortlist, ready to compare."/><div className="compare-strip">{saved.length > 1 ? <><span><Sparkles/> Compare rent, amenities, and match scores side by side.</span><button className="button button-sm" onClick={() => document.getElementById('compare-table')?.scrollIntoView({ behavior: 'smooth' })}>Compare {saved.length}</button></> : <span>Save at least two homes to unlock comparison.</span>}</div>{saved.length ? <><div className="property-grid">{saved.map((property) => <PropertyCard key={property.id} property={property} match={calculateRoomMatch(property, preferences)} saved onFavorite={onFavorite} onOpen={onOpen}/>)}</div>{saved.length > 1 && <CompareTable properties={saved}/>}</> : <EmptyState icon={Heart} title="No saved properties yet" copy="Tap the heart on any listing to build your shortlist." action="Explore properties" onAction={onBrowse}/>}</>}
    {tab === 'inquiries' && <><PageTitle title="My inquiries" copy="Keep track of every conversation."/>{inquiries.length ? <div className="inquiry-list">{inquiries.map((inquiry) => { const property = properties.find((item) => item.id === inquiry.propertyId); return <article key={inquiry.id} className="inquiry-card"><div className="inquiry-image" style={property ? propertyImageStyle(property) : {}}/><div><div className="inquiry-card-top"><h3>{property?.title || 'Property'}</h3><StatusPill status={inquiry.status}/></div><p>“{inquiry.message}”</p><span><CalendarDays/> Move-in {prettyDate(inquiry.moveInDate)} · {inquiry.contactPreference}</span></div></article>})}</div> : <EmptyState icon={Mail} title="No inquiries yet" copy="When a home feels right, send the owner a private message." action="Find a room" onAction={onBrowse}/>}</>}
    {tab === 'profile' && <PreferencesForm user={user} value={preferences} onSave={onSavePreferences}/>} 
  </div></div>
}

interface OwnerDashProps { user: UserProfile | null; properties: Property[]; inquiries: Inquiry[]; favorites: Set<string>; onAdd: () => void; onEdit: (property: Property) => void; onDelete: (id: string) => void; onStatus: (property: Property) => void; onInquiryStatus: (id: string, status: InquiryStatus) => void }
function OwnerDashboard({ user, properties, inquiries, favorites, onAdd, onEdit, onDelete, onStatus, onInquiryStatus }: OwnerDashProps) {
  const [tab, setTab] = useState<'overview' | 'properties' | 'inquiries' | 'profile'>('overview')
  const propertyIds = new Set(properties.map((property) => property.id))
  const ownerInquiries = inquiries.filter((item) => propertyIds.has(item.propertyId))
  if (!user) return <LoginRequired onLogin={() => window.dispatchEvent(new CustomEvent('roommatch:login'))}/>
  return <div className="dashboard-page container"><DashboardSidebar role="owner" tab={tab} setTab={(value) => setTab(value as typeof tab)} user={user}/><div className="dashboard-content">
    {tab === 'overview' && <><div className="dash-welcome"><div><span>OWNER WORKSPACE</span><h1>Good to see you, {user.name.split(' ')[0]}</h1><p>Here is what is happening across your properties.</p></div><button className="button" onClick={onAdd}><Plus/> Add property</button></div><div className="stats-grid"><StatCard icon={Building2} label="Total listings" value={properties.length} note="Across your portfolio"/><StatCard icon={Check} label="Available" value={properties.filter((item) => item.status === 'available').length} note="Ready for tenants"/><StatCard icon={MessageCircle} label="New inquiries" value={ownerInquiries.filter((item) => item.status === 'sent').length} note="Need your attention"/><StatCard icon={Heart} label="Total saves" value={properties.reduce((sum, item) => sum + item.saves, 0) + favorites.size} note="Tenant interest"/></div>
      <div className="owner-overview-grid"><section className="panel"><div className="dashboard-section-head"><div><h2>Recent inquiries</h2><p>Your latest tenant interest</p></div><button className="text-link" onClick={() => setTab('inquiries')}>See all</button></div>{ownerInquiries.slice(0, 3).map((item) => <MiniInquiry key={item.id} inquiry={item} property={properties.find((p) => p.id === item.propertyId)}/>)}</section><section className="panel performance-panel"><div className="dashboard-section-head"><div><h2>Listing interest</h2><p>Current saves by property</p></div></div><div className="bar-chart">{properties.slice(0, 5).map((item, index) => <div key={item.id}><span style={{ height: `${Math.max(25, Math.min(100, item.saves * 1.7))}%` }}/><small>#{index + 1}</small></div>)}</div><p><Sparkles/> Tip: clear furnishing details make listings easier to compare.</p></section></div>
    </>}
    {tab === 'properties' && <><div className="dash-welcome compact"><div><h1>My properties</h1><p>Update availability, edit details, or add a new listing.</p></div><button className="button" onClick={onAdd}><Plus/> Add property</button></div>{properties.length ? <div className="owner-property-list">{properties.map((property) => <article key={property.id}><div className="owner-property-image" style={propertyImageStyle(property)}/><div className="owner-property-copy"><div><StatusPill status={property.status}/><h3>{property.title}</h3><p><MapPin/>{property.locality}, {property.city}, {property.state}</p></div><strong>{money(property.rent)}<small>/mo</small></strong></div><div className="owner-property-stats"><span><Heart/> {property.saves} saves</span><span><MessageCircle/> {ownerInquiries.filter((item) => item.propertyId === property.id).length} inquiries</span><span><CalendarDays/> {prettyDate(property.availableFrom)}</span></div><div className="owner-property-actions"><button onClick={() => onEdit(property)}>Edit details</button><button onClick={() => onStatus(property)}>Mark {property.status === 'available' ? 'rented' : 'available'}</button><button className="danger" onClick={() => onDelete(property.id)}>Delete</button></div></article>)}</div> : <EmptyState icon={Building2} title="No properties listed" copy="Create your first listing and start meeting suitable tenants." action="Add property" onAction={onAdd}/>}</>}
    {tab === 'inquiries' && <><PageTitle title="Tenant inquiries" copy="Respond faster and keep every conversation organized."/>{ownerInquiries.length ? <div className="inquiry-table-wrap"><table className="inquiry-table"><thead><tr><th>Tenant</th><th>Property</th><th>Move-in</th><th>Message</th><th>Status</th></tr></thead><tbody>{ownerInquiries.map((item) => <tr key={item.id}><td><b>{item.tenantName}</b><small>{item.contactPreference}</small></td><td>{properties.find((p) => p.id === item.propertyId)?.title || 'Property'}</td><td>{prettyDate(item.moveInDate)}</td><td><span className="message-cell">{item.message}</span></td><td><select value={item.status} onChange={(e) => onInquiryStatus(item.id, e.target.value as InquiryStatus)}><option value="sent">Sent</option><option value="viewed">Viewed</option><option value="responded">Responded</option><option value="closed">Closed</option></select></td></tr>)}</tbody></table></div> : <EmptyState icon={Mail} title="No inquiries yet" copy="New tenant messages will appear here."/>}</>}
    {tab === 'profile' && <div><PageTitle title="Owner profile" copy="Information tenants see when reviewing your listings."/><div className="profile-card"><span className="profile-avatar">{user.name.slice(0, 1)}</span><div><h2>{user.name}</h2><p>{user.email}</p><span><ShieldCheck/> Verified property owner</span></div><button className="button button-ghost">Edit profile</button></div><div className="privacy-box wide"><ShieldCheck/><div><b>Your contact details are protected</b><p>RoomMatch never displays your private phone number or email on public listings. You control when to share them.</p></div></div></div>}
  </div></div>
}

function DashboardSidebar({ role, tab, setTab, user }: { role: Role; tab: string; setTab: (value: string) => void; user: UserProfile }) {
  const items = role === 'owner' ? [['overview', LayoutDashboard, 'Overview'], ['properties', Building2, 'My properties'], ['inquiries', MessageCircle, 'Inquiries'], ['profile', CircleUserRound, 'Profile']] : [['overview', LayoutDashboard, 'Overview'], ['saved', Heart, 'Saved properties'], ['inquiries', MessageCircle, 'Inquiries'], ['profile', CircleUserRound, 'Profile & preferences']]
  return <aside className="dashboard-sidebar"><div className="sidebar-user"><span>{user.name.slice(0, 1)}</span><div><b>{user.name}</b><small>{role === 'owner' ? 'Property owner' : user.occupation || 'Room seeker'}</small></div></div><nav>{items.map(([id, Icon, label]) => { const NavIcon = Icon as typeof Home; return <button key={String(id)} className={tab === id ? 'active' : ''} onClick={() => setTab(String(id))}><NavIcon/>{String(label)}<ChevronRight/></button> })}</nav><div className="sidebar-help"><Sparkles/><b>RoomMatch tip</b><p>{role === 'owner' ? 'Complete listings with clear photos get more inquiries.' : 'Complete your preferences to improve every match score.'}</p></div></aside>
}

function StatCard({ icon: Icon, label, value, note }: { icon: typeof Heart; label: string; value: string | number; note: string }) { return <article className="stat-card"><span><Icon/></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article> }
function MiniInquiry({ inquiry, property }: { inquiry: Inquiry; property?: Property }) { return <div className="mini-inquiry"><span>{inquiry.tenantName.slice(0, 1)}</span><div><b>{inquiry.tenantName}</b><p>{property?.title || 'Property'}</p></div><StatusPill status={inquiry.status}/></div> }
function StatusPill({ status }: { status: InquiryStatus | Property['status'] }) { return <span className={cx('status-pill', status)}>{status.charAt(0).toUpperCase() + status.slice(1)}</span> }
function PageTitle({ title, copy }: { title: string; copy: string }) { return <div className="page-title"><h1>{title}</h1><p>{copy}</p></div> }

function CompareTable({ properties }: { properties: Property[] }) { return <div className="compare-table-wrap" id="compare-table"><h2>Quick comparison</h2><table className="compare-table"><thead><tr><th>Home</th>{properties.map((item) => <th key={item.id}>{item.title}</th>)}</tr></thead><tbody><tr><td>Monthly rent</td>{properties.map((item) => <td key={item.id}>{money(item.rent)}</td>)}</tr><tr><td>RoomMatch</td>{properties.map((item) => <td key={item.id}><b>{calculateRoomMatch(item, defaultPreferences).score}%</b></td>)}</tr><tr><td>Furnishing</td>{properties.map((item) => <td key={item.id}>{item.furnishing}</td>)}</tr><tr><td>Amenities</td>{properties.map((item) => <td key={item.id}>{item.amenities.slice(0,3).join(', ')}</td>)}</tr></tbody></table></div> }

function PreferencesForm({ user, value, onSave }: { user: UserProfile; value: TenantPreferences; onSave: (next: TenantPreferences) => void }) {
  const [draft, setDraft] = useState(value)
  const toggle = (item: string) => setDraft((current) => ({ ...current, requiredAmenities: current.requiredAmenities.includes(item) ? current.requiredAmenities.filter((value) => value !== item) : [...current.requiredAmenities, item] }))
  return <form className="preferences-form" onSubmit={(e) => { e.preventDefault(); onSave(draft) }}><PageTitle title="Profile & preferences" copy="These details power your explainable RoomMatch Score."/><section className="form-section"><div className="form-section-title"><CircleUserRound/><div><h2>About you</h2><p>Your private profile is only used for matching.</p></div></div><div className="form-grid"><label>Full name<input value={user.name} readOnly/></label><label>Occupation<input value={user.occupation || ''} readOnly/></label><label>I am a<select value={draft.tenantType} onChange={(e) => setDraft({ ...draft, tenantType: e.target.value })}>{TENANT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label></div></section><section className="form-section"><div className="form-section-title"><LocateFixed/><div><h2>Your ideal home</h2><p>Tell us where and what to look for.</p></div></div><div className="form-grid"><label>Preferred city<input value={draft.preferredCity} onChange={(e) => setDraft({ ...draft, preferredCity: e.target.value })}/></label><label>Preferred neighborhood<input value={draft.preferredLocality} onChange={(e) => setDraft({ ...draft, preferredLocality: e.target.value })}/></label><label>Property type<select value={draft.propertyType} onChange={(e) => setDraft({ ...draft, propertyType: e.target.value })}>{PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label>Minimum monthly budget ($)<input type="number" min="0" value={draft.minBudget} onChange={(e) => setDraft({ ...draft, minBudget: Number(e.target.value) })}/></label><label>Maximum monthly budget ($)<input type="number" min="1" value={draft.maxBudget} onChange={(e) => setDraft({ ...draft, maxBudget: Number(e.target.value) })}/></label><label>Furnishing<select value={draft.furnishing} onChange={(e) => setDraft({ ...draft, furnishing: e.target.value })}>{FURNISHING.map((type) => <option key={type}>{type}</option>)}</select></label></div><div className="amenity-picker">{AMENITIES.map((item) => <button type="button" key={item} className={draft.requiredAmenities.includes(item) ? 'selected' : ''} onClick={() => toggle(item)}><Check/>{item}</button>)}</div></section><button className="button" type="submit">Save preferences</button></form>
}

interface PropertyFormProps { property: Property | null; user: UserProfile; onCancel: () => void; onSave: (property: Property, files: File[]) => void }
function PropertyForm({ property, user, onCancel, onSave }: PropertyFormProps) {
  const base: Property = property || { id: `draft-${crypto.randomUUID()}`, ownerId: user.id, ownerName: user.name, ownerVerified: true, title: '', description: '', address: '', city: 'Warrensburg', state: 'MO', zipCode: '64093', locality: '', landmark: '', propertyType: 'Private Room', rooms: 1, rent: 0, deposit: 0, maintenance: 0, electricityCharge: 0, waterCharge: 0, availableFrom: new Date().toISOString().slice(0, 10), status: 'available', suitableFor: [], genderPreference: 'Any', petsAllowed: false, smokingAllowed: false, foodRestrictions: 'No preference', amenities: [], furnishing: 'Partially Furnished', imageIndex: 1, createdAt: new Date().toISOString(), saves: 0 }
  const [draft, setDraft] = useState(base)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>(property?.imageUrls || [])
  const [validation, setValidation] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const toggleArray = (key: 'suitableFor' | 'amenities', item: string) => setDraft((current) => ({ ...current, [key]: current[key].includes(item) ? current[key].filter((value) => value !== item) : [...current[key], item] }))
  const chooseFiles = (list: FileList | null) => { if (!list) return; const next = Array.from(list).filter((file) => file.type.startsWith('image/')).slice(0, 8); setFiles(next); setPreviews(next.map((file) => URL.createObjectURL(file))) }
  const submit = (event: FormEvent) => { event.preventDefault(); if (!draft.title.trim() || !draft.address.trim() || !draft.city.trim() || !draft.state.trim() || !draft.zipCode.trim() || !draft.locality.trim()) return setValidation('Add a title and complete the U.S. address.'); if (!(draft.rent > 0)) return setValidation('Monthly rent must be a positive number.'); if (!draft.suitableFor.length) return setValidation('Select at least one suitable renter category.'); setValidation(''); onSave(draft, files) }
  return <div className="property-form-page container"><button className="back-link" onClick={onCancel}><ArrowLeft/> Back to dashboard</button><div className="form-page-head"><div><span>{property ? 'EDIT LISTING' : 'NEW LISTING'}</span><h1>{property ? 'Update your property' : 'List a property that finds the right fit'}</h1><p>Clear, complete listings help tenants decide with confidence.</p></div><div className="form-progress"><span className="done"><Check/></span><i/><span>2</span><i/><span>3</span></div></div><form className="property-form" onSubmit={submit}>
    <FormSection number="01" title="The essentials" copy="Start with the details renters scan first."><div className="form-grid"><label className="span-2">Property title *<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Sunny one-bedroom near UCM"/></label><label className="span-2">Description *<textarea required rows={5} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Describe the space, neighborhood, and what makes it a good fit…"/></label><label>Property type<select value={draft.propertyType} onChange={(e) => setDraft({ ...draft, propertyType: e.target.value })}>{PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label>Number of bedrooms<input type="number" min="0" max="20" value={draft.rooms} onChange={(e) => setDraft({ ...draft, rooms: Number(e.target.value) })}/></label></div></FormSection>
    <FormSection number="02" title="Location" copy="Exact addresses stay private on public cards."><div className="form-grid"><label className="span-2">Street address *<input required value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })}/></label><label>City *<input required value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })}/></label><label>State *<input required maxLength={2} value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value.toUpperCase() })} placeholder="MO"/></label><label>ZIP code *<input required inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" value={draft.zipCode} onChange={(e) => setDraft({ ...draft, zipCode: e.target.value })} placeholder="64093"/></label><label>Neighborhood *<input required value={draft.locality} onChange={(e) => setDraft({ ...draft, locality: e.target.value })}/></label><label className="span-2">Nearby landmark <input value={draft.landmark} onChange={(e) => setDraft({ ...draft, landmark: e.target.value })}/></label></div></FormSection>
    <FormSection number="03" title="Rent & availability" copy="Make every monthly cost easy to understand."><div className="form-grid three"><NumberField label="Monthly rent *" value={draft.rent} onChange={(rent) => setDraft({ ...draft, rent })}/><NumberField label="Security deposit" value={draft.deposit} onChange={(deposit) => setDraft({ ...draft, deposit })}/><NumberField label="Maintenance / month" value={draft.maintenance} onChange={(maintenance) => setDraft({ ...draft, maintenance })}/><NumberField label="Electricity charge" value={draft.electricityCharge} onChange={(electricityCharge) => setDraft({ ...draft, electricityCharge })}/><NumberField label="Water charge" value={draft.waterCharge} onChange={(waterCharge) => setDraft({ ...draft, waterCharge })}/><label>Available from<input type="date" required value={draft.availableFrom} onChange={(e) => setDraft({ ...draft, availableFrom: e.target.value })}/></label></div><div className="segmented"><button type="button" className={draft.status === 'available' ? 'active' : ''} onClick={() => setDraft({ ...draft, status: 'available' })}>Available</button><button type="button" className={draft.status === 'rented' ? 'active' : ''} onClick={() => setDraft({ ...draft, status: 'rented' })}>Rented</button></div></FormSection>
    <FormSection number="04" title="Who is it suitable for?" copy="Choose at least one category to support better matching."><div className="choice-grid">{TENANT_TYPES.map((item) => <button type="button" key={item} className={draft.suitableFor.includes(item) ? 'selected' : ''} onClick={() => toggleArray('suitableFor', item)}><Users/>{item}<span><Check/></span></button>)}</div><div className="form-grid"><label>Gender preference<select value={draft.genderPreference} onChange={(e) => setDraft({ ...draft, genderPreference: e.target.value })}><option>Any</option><option>Women</option><option>Men</option></select></label><label>Food restrictions<select value={draft.foodRestrictions} onChange={(e) => setDraft({ ...draft, foodRestrictions: e.target.value })}><option>No restriction</option><option>Vegetarian only</option><option>Vegetarian preferred</option></select></label></div><div className="switches"><label>Pets allowed<input type="checkbox" checked={draft.petsAllowed} onChange={(e) => setDraft({ ...draft, petsAllowed: e.target.checked })}/><span/></label><label>Smoking allowed<input type="checkbox" checked={draft.smokingAllowed} onChange={(e) => setDraft({ ...draft, smokingAllowed: e.target.checked })}/><span/></label></div></FormSection>
    <FormSection number="05" title="Amenities & furnishing" copy="Help renters compare the everyday details."><div className="choice-grid amenities">{AMENITIES.map((item) => <button type="button" key={item} className={draft.amenities.includes(item) ? 'selected' : ''} onClick={() => toggleArray('amenities', item)}><Check/>{item}</button>)}</div><div className="furnishing-cards">{FURNISHING.map((item) => <button type="button" key={item} className={draft.furnishing === item ? 'selected' : ''} onClick={() => setDraft({ ...draft, furnishing: item })}><Building2/><b>{item}</b><span>{item === 'Furnished' ? 'Ready to move in' : item === 'Partially Furnished' ? 'Key furniture included' : 'A blank canvas'}</span></button>)}</div></FormSection>
    <FormSection number="06" title="Property photos" copy="Upload up to 8 images. The first image is your cover."><input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={(e) => chooseFiles(e.target.files)}/><button type="button" className="upload-zone" onClick={() => fileRef.current?.click()}><UploadCloud/><b>Drop images here or click to browse</b><span>JPG, PNG or WebP · up to 8 photos</span></button>{previews.length ? <div className="preview-grid">{previews.map((src, index) => <div key={src} style={{ backgroundImage: `url(${src})` }}>{index === 0 && <span>Cover photo</span>}<button type="button" onClick={() => { setPreviews((items) => items.filter((_, i) => i !== index)); setFiles((items) => items.filter((_, i) => i !== index)) }}><X/></button></div>)}</div> : <p className="photo-hint"><Sparkles/> Listings with clear photos get more interest. You can still publish this draft without one.</p>}</FormSection>
    {validation && <div className="validation-error">{validation}</div>}<div className="form-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Save as draft</button><button className="button button-lg" type="submit">{property ? 'Save changes' : 'Publish property'} <ChevronRight/></button></div>
  </form></div>
}

function FormSection({ number, title, copy, children }: { number: string; title: string; copy: string; children: React.ReactNode }) { return <section className="listing-form-section"><div className="listing-section-head"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div><div className="listing-section-body">{children}</div></section> }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label>{label}<div className="currency-input"><span>$</span><input type="number" min="0" step="1" value={value || ''} onChange={(e) => onChange(Number(e.target.value) || 0)}/></div></label> }

function AuthModal({ onClose, onDemo }: { onClose: () => void; onDemo: (role: Role) => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [role, setRole] = useState<Role>('tenant')
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const name = nameRef.current?.value.trim() || ''
    const email = emailRef.current?.value.trim() || ''
    const password = passwordRef.current?.value || ''
    try {
      if (!isSupabaseConfigured) { if (mode === 'forgot') { setMessage('Demo reset link sent.'); return } if (password.length < 6) throw new Error('Use at least 6 characters.'); onDemo(role); return }
      if (mode === 'forgot') { await requestPasswordReset(email); setMessage('Check your inbox for a secure reset link.') }
      else if (mode === 'signup') {
        const { session } = await signUp(name, email, password, role)
        if (session) { onClose(); return }
        if (passwordRef.current) passwordRef.current.value = ''
        setMode('login')
        setMessage('Account created! Open the confirmation email from Supabase and click “Confirm your email,” then sign in here. Check spam if you do not see it.')
      }
      else { await signIn(email, password); onClose() }
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Authentication failed.') } finally { setBusy(false) }
  }
  return <Modal title={mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your RoomMatch account' : 'Reset your password'} subtitle={mode === 'login' ? 'Sign in to save homes and manage inquiries.' : mode === 'signup' ? 'Choose how you want to use RoomMatch.' : 'We will send a secure recovery link.'} onClose={onClose}><form className="modal-form auth-form" onSubmit={submit}>{mode !== 'forgot' && <div className="role-picker"><button type="button" className={role === 'tenant' ? 'selected' : ''} onClick={() => setRole('tenant')}><Search/><b>I need a room</b><span>Find and save matching homes</span></button><button type="button" className={role === 'owner' ? 'selected' : ''} onClick={() => setRole('owner')}><Building2/><b>I own property</b><span>List and manage rentals</span></button></div>}{mode === 'signup' && <label>Full name<input ref={nameRef} required placeholder="Your name" autoComplete="name"/></label>}<label>Email address<input ref={emailRef} type="email" required placeholder="you@example.com" autoComplete="email"/></label>{mode !== 'forgot' && <label>Password<input ref={passwordRef} type="password" minLength={6} required placeholder="At least 6 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>}{message && <div className="auth-message">{message}</div>}<button className="button full" disabled={busy}>{busy && <LoaderCircle className="spin"/>}{mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}</button><div className="auth-switch">{mode === 'login' ? <><button type="button" onClick={() => setMode('forgot')}>Forgot password?</button><span>New here? <button type="button" onClick={() => setMode('signup')}>Create an account</button></span></> : <button type="button" onClick={() => setMode('login')}>← Back to sign in</button>}</div>{!isSupabaseConfigured && <p className="demo-auth-note"><Sparkles/> Demo mode: use any email and a 6+ character password.</p>}</form></Modal>
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal-card" role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose}><X/></button><div className="modal-head"><span className="brand-mark"><Home/></span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div></div> }
function EmptyState({ icon: Icon, title, copy, action, onAction }: { icon: typeof Search; title: string; copy: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><span><Icon/></span><h2>{title}</h2><p>{copy}</p>{action && <button className="button button-ghost" onClick={onAction}>{action}</button>}</div> }
function LoginRequired({ onLogin }: { onLogin: () => void }) { return <div className="container login-required"><ShieldCheck/><h1>Sign in to open your dashboard</h1><p>Your saved homes, inquiries, and private profile are protected.</p><button className="button" onClick={onLogin}>Sign in securely</button></div> }
function OwnerRequired({ onSwitch }: { onSwitch: () => void }) { return <div className="container login-required"><Building2/><h1>Use a property owner account</h1><p>Only verified owner profiles can create and manage listings.</p><button className="button" onClick={onSwitch}>{isSupabaseConfigured ? 'Sign in as an owner' : 'Switch to owner demo'}</button></div> }
function LoadingPage() { return <div className="loading-page"><LoaderCircle className="spin"/><b>Finding great homes…</b><div className="skeleton-row"><i/><i/><i/></div></div> }

function Footer({ onNavigate }: { onNavigate: (view: View) => void }) { return <footer><div className="container footer-grid"><div><button className="brand footer-brand" onClick={() => onNavigate('home')}><span className="brand-mark"><Home/></span><span>Room<span>Match</span></span></button><p>Find a place that fits your life.</p></div><div><b>Discover</b><button onClick={() => onNavigate('search')}>Find a room</button><button onClick={() => onNavigate('search')}>Popular categories</button><button onClick={() => onNavigate('tenant')}>Saved homes</button></div><div><b>For owners</b><button onClick={() => onNavigate('property-form')}>List a property</button><button onClick={() => onNavigate('owner')}>Owner dashboard</button><button onClick={() => onNavigate('owner')}>Manage inquiries</button></div><div><b>Trust & support</b><span>Privacy-first inquiries</span><span>Verified owner profiles</span><span>Help centre</span></div></div><div className="container footer-bottom"><span>© 2026 RoomMatch. Fictional demo data.</span><span>Built for better rental decisions.</span></div></footer> }

export default App

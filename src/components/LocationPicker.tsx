import { useId, useState } from 'react'
import cities from '../data/us-cities.json'

export function LocationPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const matches = cities.filter(city => city.toLowerCase().includes(query.toLowerCase())).slice(0, 60)
  const choose = (city: string) => { onChange(city); setOpen(false); setQuery(''); setActive(0) }
  return <div className="location-picker" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}>
    <input role="combobox" aria-label="City and state" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open && matches[active] ? id + '-' + active : undefined}
      value={open ? query : value} placeholder="All U.S. cities — type to search"
      onFocus={() => { setOpen(true); setQuery(value); setActive(0) }}
      onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
      onKeyDown={e => {
        if (e.key === 'Escape') setOpen(false)
        if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, matches.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
        if (e.key === 'Enter' && open) { e.preventDefault(); if (matches[active]) choose(matches[active]) }
      }}/>
    <button type="button" className="location-toggle" aria-label="Choose a city" onClick={() => { setOpen(!open); setQuery(''); setActive(0) }}>▾</button>
    {open && <div className="location-options">
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose('')}>All U.S. cities</button>
      <div id={id} role="listbox" aria-label="U.S. cities and states">
        {matches.map((city, i) => <button type="button" role="option" aria-selected={i === active} id={id + '-' + i} key={city}
          onMouseDown={e => e.preventDefault()} onClick={() => choose(city)}>{city}</button>)}
      </div>
      <small>{matches.length ? 'Type a city or state abbreviation to narrow the list.' : 'No matching cities. Try a different spelling.'}</small>
    </div>}
  </div>
}

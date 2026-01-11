/**
 * VenueSelector - レース場選択ドロップダウン
 */

function VenueSelector({ venuesData, selectedVenueId, onVenueChange }) {
  if (!venuesData || venuesData.length === 0) {
    return null
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      marginBottom: '2rem',
      padding: '1.5rem',
      background: 'white',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
    }}>
      <label htmlFor="venue-select" style={{
        marginBottom: '0',
        fontWeight: 'bold',
        fontSize: '1.1rem',
        color: '#1E293B'
      }}>
        レース場を選択:
      </label>
      <select
        id="venue-select"
        value={selectedVenueId || ''}
        onChange={(e) => onVenueChange(parseInt(e.target.value))}
        style={{
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          borderRadius: '8px',
          border: '2px solid #e2e8f0',
          backgroundColor: 'white',
          color: '#1e293b',
          cursor: 'pointer',
          minWidth: '250px',
          outline: 'none'
        }}
      >
        {venuesData.map(venue => (
          <option key={venue.placeCd} value={venue.placeCd}>
            {venue.placeName} ({venue.races.length}レース)
          </option>
        ))}
      </select>
    </div>
  )
}

export default VenueSelector

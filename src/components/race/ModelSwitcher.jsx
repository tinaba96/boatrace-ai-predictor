/**
 * ModelSwitcher - モデル選択ボタン
 */

function ModelSwitcher({ selectedModel, onSwitchModel }) {
  const models = [
    {
      key: 'standard',
      label: '⚖️ スタンダード',
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      shadowColor: 'rgba(14, 165, 233, 0.3)'
    },
    {
      key: 'safe-bet',
      label: '🎯 本命狙い',
      gradient: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
      shadowColor: 'rgba(76, 175, 80, 0.3)'
    },
    {
      key: 'upset-focus',
      label: '🌪️ 穴狙い',
      gradient: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
      shadowColor: 'rgba(255, 152, 0, 0.3)'
    }
  ]

  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      marginBottom: '1.5rem',
      flexWrap: 'wrap'
    }}>
      {models.map(model => (
        <button
          key={model.key}
          onClick={() => onSwitchModel(model.key)}
          style={{
            flex: '1',
            minWidth: '140px',
            padding: '0.75rem 1rem',
            background: selectedModel === model.key ? model.gradient : 'white',
            color: selectedModel === model.key ? 'white' : '#333',
            border: selectedModel === model.key ? 'none' : '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: selectedModel === model.key ? `0 4px 12px ${model.shadowColor}` : 'none'
          }}
        >
          {model.label}
        </button>
      ))}
    </div>
  )
}

export default ModelSwitcher

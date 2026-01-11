/**
 * ModelSelector - モデル選択タブ
 */

function ModelSelector({ selectedModel, onModelChange }) {
  return (
    <div className="model-selector" role="group" aria-label="予想モデル選択">
      <button
        className={selectedModel === 'standard' ? 'active' : ''}
        onClick={() => onModelChange('standard')}
      >
        スタンダード
      </button>
      <button
        className={selectedModel === 'safeBet' ? 'active' : ''}
        onClick={() => onModelChange('safeBet')}
      >
        本命狙い
      </button>
      <button
        className={selectedModel === 'upsetFocus' ? 'active' : ''}
        onClick={() => onModelChange('upsetFocus')}
      >
        穴狙い
      </button>
    </div>
  )
}

export default ModelSelector

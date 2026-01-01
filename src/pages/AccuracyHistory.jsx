import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './AccuracyHistory.css'

function AccuracyHistory() {
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedModel, setSelectedModel] = useState('standard')

    const modelNames = {
        standard: 'スタンダード',
        safeBet: '本命狙い',
        upsetFocus: '穴狙い'
    }

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                setLoading(true)
                const summaryUrl = import.meta.env.BASE_URL + 'data/predictions/summary.json?t=' + Date.now()
                const response = await fetch(summaryUrl)

                if (!response.ok) {
                    throw new Error('Summary data not available')
                }

                const data = await response.json()
                setSummary(data)
            } catch (err) {
                console.error('Failed to load accuracy summary:', err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchSummary()
    }, [])

    const formatPercent = (rate) => (rate * 100).toFixed(1) + '%'

    const getRecoveryClass = (rate) => {
        if (rate >= 1.0) return 'recovery-positive'
        if (rate >= 0.8) return 'recovery-neutral'
        return 'recovery-negative'
    }

    if (loading) {
        return (
            <div className="accuracy-history-page">
                <div className="page-header">
                    <Link to="/accuracy" className="back-link">← 成績ページへ戻る</Link>
                    <h1>月別成績アーカイブ</h1>
                </div>
                <div className="loading">データを読み込み中...</div>
            </div>
        )
    }

    if (error || !summary) {
        return (
            <div className="accuracy-history-page">
                <div className="page-header">
                    <Link to="/accuracy" className="back-link">← 成績ページへ戻る</Link>
                    <h1>月別成績アーカイブ</h1>
                </div>
                <div className="error-message">
                    <p>データの読み込みに失敗しました。</p>
                </div>
            </div>
        )
    }

    // 月別データを収集
    const getMonthlyData = () => {
        const months = []
        const models = ['standard', 'safeBet', 'upsetFocus']

        // lastMonth データを追加
        models.forEach(model => {
            if (summary.models && summary.models[model]?.lastMonth) {
                const lastMonth = summary.models[model].lastMonth
                if (lastMonth.totalRaces > 0) {
                    const key = `${lastMonth.year}-${lastMonth.month}`
                    let existing = months.find(m => m.key === key)
                    if (!existing) {
                        existing = {
                            key,
                            year: lastMonth.year,
                            month: lastMonth.month,
                            models: {}
                        }
                        months.push(existing)
                    }
                    existing.models[model] = lastMonth
                }
            }
        })

        // monthlyHistory データを追加（将来用）
        models.forEach(model => {
            if (summary.models && summary.models[model]?.monthlyHistory) {
                summary.models[model].monthlyHistory.forEach(monthData => {
                    if (monthData.totalRaces > 0) {
                        const key = `${monthData.year}-${monthData.month}`
                        let existing = months.find(m => m.key === key)
                        if (!existing) {
                            existing = {
                                key,
                                year: monthData.year,
                                month: monthData.month,
                                models: {}
                            }
                            months.push(existing)
                        }
                        existing.models[model] = monthData
                    }
                })
            }
        })

        // 新しい月順にソート
        months.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year
            return b.month - a.month
        })

        return months
    }

    const monthlyData = getMonthlyData()

    const renderMonthCard = (monthInfo) => {
        const modelData = monthInfo.models[selectedModel]
        if (!modelData) return null

        const recovery = modelData.actualRecovery || {}

        return (
            <div key={monthInfo.key} className="month-card">
                <h3 className="month-title">
                    {monthInfo.year}年{monthInfo.month}月
                </h3>
                <div className="month-stats">
                    <div className="stat-row">
                        <span className="stat-label">総レース数</span>
                        <span className="stat-value">{modelData.totalRaces}R</span>
                    </div>
                </div>

                <div className="hit-rates-section">
                    <h4>的中率</h4>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-label">1着的中</span>
                            <span className="stat-value">{formatPercent(modelData.topPickHitRate)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">複勝的中</span>
                            <span className="stat-value">{formatPercent(modelData.topPickPlaceRate)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">3連単的中</span>
                            <span className="stat-value">{formatPercent(modelData.top3HitRate)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">3連複的中</span>
                            <span className="stat-value">{formatPercent(modelData.top3IncludedRate)}</span>
                        </div>
                    </div>
                </div>

                <div className="recovery-section">
                    <h4>回収率</h4>
                    <div className="recovery-grid">
                        <div className="recovery-item">
                            <span className="recovery-label">単勝</span>
                            <span className={`recovery-value ${getRecoveryClass(recovery.win?.recoveryRate || 0)}`}>
                                {formatPercent(recovery.win?.recoveryRate || 0)}
                            </span>
                        </div>
                        <div className="recovery-item">
                            <span className="recovery-label">複勝</span>
                            <span className={`recovery-value ${getRecoveryClass(recovery.place?.recoveryRate || 0)}`}>
                                {formatPercent(recovery.place?.recoveryRate || 0)}
                            </span>
                        </div>
                        <div className="recovery-item">
                            <span className="recovery-label">3連単</span>
                            <span className={`recovery-value ${getRecoveryClass(recovery.trifecta?.recoveryRate || 0)}`}>
                                {formatPercent(recovery.trifecta?.recoveryRate || 0)}
                            </span>
                        </div>
                        <div className="recovery-item">
                            <span className="recovery-label">3連複</span>
                            <span className={`recovery-value ${getRecoveryClass(recovery.trio?.recoveryRate || 0)}`}>
                                {formatPercent(recovery.trio?.recoveryRate || 0)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="accuracy-history-page">
            <div className="page-header">
                <Link to="/accuracy" className="back-link">← 成績ページへ戻る</Link>
                <h1>月別成績アーカイブ</h1>
                <p className="page-description">過去の月別AI予想成績を確認できます</p>
            </div>

            <div className="model-selector">
                {Object.entries(modelNames).map(([key, name]) => (
                    <button
                        key={key}
                        className={`model-button ${selectedModel === key ? 'active' : ''}`}
                        onClick={() => setSelectedModel(key)}
                    >
                        {name}
                    </button>
                ))}
            </div>

            <div className="months-container">
                {monthlyData.length === 0 ? (
                    <div className="no-data">
                        <p>まだ月別データがありません。</p>
                        <p>月が終わるとここに成績が記録されます。</p>
                    </div>
                ) : (
                    monthlyData.map(monthInfo => renderMonthCard(monthInfo))
                )}
            </div>

            <div className="archive-notice">
                <p>※ 毎月月末に前月の成績が自動的にアーカイブされます</p>
                <p>※ 詳細な会場別分析は<Link to="/blog">ブログ</Link>の月間レポートをご覧ください</p>
            </div>
        </div>
    )
}

export default AccuracyHistory

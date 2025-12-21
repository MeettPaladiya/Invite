import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const API_BASE = '/api'

// Simple SVG Chart Components (No external library needed)
function LineChart({ data, width = 600, height = 200 }) {
    if (!data || data.length === 0) {
        return <div className="text-gray-400 text-center py-8">No data available</div>
    }

    const maxValue = Math.max(...data.map(d => d.count || 0), 1)
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (width - 60) + 30
        const y = height - 30 - ((d.count || 0) / maxValue) * (height - 60)
        return `${x},${y}`
    }).join(' ')

    return (
        <svg width={width} height={height} className="w-full">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                <line
                    key={i}
                    x1={30}
                    y1={height - 30 - ratio * (height - 60)}
                    x2={width - 30}
                    y2={height - 30 - ratio * (height - 60)}
                    stroke="rgba(255,255,255,0.1)"
                />
            ))}

            {/* Line */}
            <polyline
                points={points}
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Area fill */}
            <polygon
                points={`30,${height - 30} ${points} ${width - 30},${height - 30}`}
                fill="url(#areaGradient)"
            />

            {/* Dots */}
            {data.map((d, i) => {
                const x = (i / (data.length - 1)) * (width - 60) + 30
                const y = height - 30 - ((d.count || 0) / maxValue) * (height - 60)
                return (
                    <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#6366f1"
                        stroke="white"
                        strokeWidth="2"
                    />
                )
            })}

            {/* X-axis labels */}
            {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((d, i, arr) => {
                const originalIndex = data.indexOf(d)
                const x = (originalIndex / (data.length - 1)) * (width - 60) + 30
                return (
                    <text
                        key={i}
                        x={x}
                        y={height - 10}
                        textAnchor="middle"
                        fill="#9ca3af"
                        fontSize="10"
                    >
                        {d.date?.slice(5) || ''}
                    </text>
                )
            })}

            {/* Gradients */}
            <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(99, 102, 241, 0.3)" />
                    <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
                </linearGradient>
            </defs>
        </svg>
    )
}

function PieChart({ data, size = 200 }) {
    const total = data.reduce((sum, d) => sum + d.value, 0)
    if (total === 0) return <div className="text-gray-400 text-center py-8">No data</div>

    const radius = size / 2 - 20
    const cx = size / 2
    const cy = size / 2

    let currentAngle = -90
    const segments = data.map((d, i) => {
        const angle = (d.value / total) * 360
        const startAngle = currentAngle
        const endAngle = currentAngle + angle
        currentAngle = endAngle

        const startRad = (startAngle * Math.PI) / 180
        const endRad = (endAngle * Math.PI) / 180

        const x1 = cx + radius * Math.cos(startRad)
        const y1 = cy + radius * Math.sin(startRad)
        const x2 = cx + radius * Math.cos(endRad)
        const y2 = cy + radius * Math.sin(endRad)

        const largeArc = angle > 180 ? 1 : 0

        return {
            path: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
            color: d.color,
            label: d.label,
            percentage: ((d.value / total) * 100).toFixed(1)
        }
    })

    return (
        <div className="flex items-center gap-6">
            <svg width={size} height={size}>
                {segments.map((seg, i) => (
                    <path
                        key={i}
                        d={seg.path}
                        fill={seg.color}
                        stroke="rgba(0,0,0,0.3)"
                        strokeWidth="1"
                    />
                ))}
                {/* Center hole for donut effect */}
                <circle cx={cx} cy={cy} r={radius * 0.5} fill="#1a1a2e" />
            </svg>
            <div className="space-y-2">
                {segments.map((seg, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                        <span className="text-gray-400 text-sm">{seg.label}: {seg.percentage}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function Analytics() {
    const { token } = useAuth()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState(null)
    const [dailyData, setDailyData] = useState([])
    const [days, setDays] = useState(30)

    useEffect(() => {
        fetchAnalytics()
    }, [days])

    const fetchAnalytics = async () => {
        try {
            setLoading(true)

            // Fetch overview stats
            const overviewRes = await fetch(`${API_BASE}/analytics/overview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (overviewRes.ok) {
                const overviewData = await overviewRes.json()
                setStats(overviewData)
            }

            // Fetch WhatsApp stats
            const waRes = await fetch(`${API_BASE}/analytics/whatsapp?days=${days}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (waRes.ok) {
                const waData = await waRes.json()
                setDailyData(waData.daily || [])
            }
        } catch (err) {
            console.error('Failed to fetch analytics:', err)
        } finally {
            setLoading(false)
        }
    }

    const pieData = stats ? [
        { label: 'Sent', value: stats.successful_sends || 0, color: '#22c55e' },
        { label: 'Failed', value: stats.failed_sends || 0, color: '#ef4444' },
    ] : []

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">WhatsApp Analytics</h1>
                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white"
                >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={365}>Last year</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading analytics...</div>
            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                            <div className="text-3xl font-bold text-white">{stats?.total_sends || 0}</div>
                            <div className="text-sm text-gray-400">Total Messages</div>
                        </div>
                        <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                            <div className="text-3xl font-bold text-green-400">{stats?.successful_sends || 0}</div>
                            <div className="text-sm text-gray-400">Delivered</div>
                        </div>
                        <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                            <div className="text-3xl font-bold text-red-400">{stats?.failed_sends || 0}</div>
                            <div className="text-sm text-gray-400">Failed</div>
                        </div>
                        <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                            <div className="text-3xl font-bold text-primary">{stats?.success_rate || 0}%</div>
                            <div className="text-sm text-gray-400">Success Rate</div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Line Chart */}
                        <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                            <h3 className="text-lg font-semibold text-white mb-4">Messages Over Time</h3>
                            <LineChart data={dailyData} />
                        </div>

                        {/* Pie Chart */}
                        <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                            <h3 className="text-lg font-semibold text-white mb-4">Delivery Status</h3>
                            <div className="flex justify-center">
                                <PieChart data={pieData} />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

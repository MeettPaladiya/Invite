import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const API_BASE = '/api'

export default function Reports() {
    const { token } = useAuth()
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [formData, setFormData] = useState({
        title: 'Customer Work Report',
        include_sent: true,
        include_not_sent: true
    })

    useEffect(() => {
        fetchReports()
    }, [])

    const fetchReports = async () => {
        try {
            setLoading(true)
            const res = await fetch(`${API_BASE}/reports`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setReports(data.reports || [])
            }
        } catch (err) {
            console.error('Failed to fetch reports:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleGenerate = async () => {
        try {
            setGenerating(true)
            const res = await fetch(`${API_BASE}/reports/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                const data = await res.json()
                // Open report in new tab
                window.open(data.url, '_blank')
                // Refresh list
                fetchReports()
            }
        } catch (err) {
            console.error('Failed to generate report:', err)
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-white">Work Reports</h1>

            {/* Generate New Report */}
            <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">Generate New Report</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Report Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full max-w-md px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                        />
                    </div>

                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 text-white">
                            <input
                                type="checkbox"
                                checked={formData.include_sent}
                                onChange={(e) => setFormData({ ...formData, include_sent: e.target.checked })}
                                className="w-4 h-4"
                            />
                            Include Sent Cards
                        </label>
                        <label className="flex items-center gap-2 text-white">
                            <input
                                type="checkbox"
                                checked={formData.include_not_sent}
                                onChange={(e) => setFormData({ ...formData, include_not_sent: e.target.checked })}
                                className="w-4 h-4"
                            />
                            Include Pending
                        </label>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="px-6 py-2 bg-primary rounded-lg text-white hover:bg-primary/80 disabled:opacity-50"
                    >
                        {generating ? 'Generating...' : '📄 Generate Report'}
                    </button>
                </div>
            </div>

            {/* Previous Reports */}
            <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">Previous Reports</h2>

                {loading ? (
                    <div className="text-gray-400">Loading...</div>
                ) : reports.length === 0 ? (
                    <div className="text-gray-400">No reports generated yet</div>
                ) : (
                    <div className="space-y-3">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="flex items-center justify-between p-4 bg-dark-700 rounded-lg border border-white/5"
                            >
                                <div>
                                    <div className="text-white font-medium">{report.filename}</div>
                                    <div className="text-sm text-gray-400">
                                        {report.row_count} customers •
                                        Generated by {report.generated_by_name} •
                                        {new Date(report.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <a
                                    href={`/storage/reports/${report.filename}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30"
                                >
                                    View / Print
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

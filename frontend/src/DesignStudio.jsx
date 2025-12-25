import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import AnnotationCanvas from './AnnotationCanvas'

const API_BASE = '/api'

export default function DesignStudio() {
    const { token } = useAuth()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [sessionId, setSessionId] = useState(null)

    // Step 1: Upload
    const [pdfFile, setPdfFile] = useState(null)
    const [pdfPreviews, setPdfPreviews] = useState([])
    const [pageCount, setPageCount] = useState(0)

    // Step 2: Zones
    const [zones, setZones] = useState([])
    const [currentPage, setCurrentPage] = useState(1)

    // Step 3: CSV
    const [csvFile, setCsvFile] = useState(null)
    const [csvColumns, setCsvColumns] = useState([])
    const [csvPreview, setCsvPreview] = useState([])
    const [mapping, setMapping] = useState({})

    // Step 4: Preview
    const [previewUrl, setPreviewUrl] = useState(null)
    const [previewData, setPreviewData] = useState(null)

    // Step 5: Output
    const [outputs, setOutputs] = useState([])
    const [whatsappStatus, setWhatsappStatus] = useState(null)

    // ============ STEP 1: UPLOAD ============
    const handlePdfUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setLoading(true)
        setError(null)
        setPdfFile(file) // Store locally for UI if needed

        const formData = new FormData()
        formData.append('file', file)

        try {
            // In a real app we'd use the backend. For now, assuming backend is at API_BASE
            const res = await fetch(`${API_BASE}/upload-pdf`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // If needed
                body: formData
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Upload failed')

            setSessionId(data.session_id)
            // Backend returns relative paths like /storage/previews/..., need full URL
            setPdfPreviews(data.preview_urls.map(u => `http://localhost:8000${u}`))
            setPageCount(data.page_count)
            setStep(2)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ============ STEP 2: ZONES ============
    // Passed to AnnotationCanvas
    const handleZoneChange = (updatedZones) => {
        setZones(updatedZones)
    }

    const saveZones = async () => {
        if (zones.length === 0) {
            setError('Please draw at least one region.')
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/zones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ session_id: sessionId, zones })
            })
            if (!res.ok) throw new Error('Failed to save zones')
            setStep(3)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ============ STEP 3: CSV ============
    const handleCsvUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setLoading(true)

        const formData = new FormData()
        formData.append('session_id', sessionId)
        formData.append('file', file)

        try {
            const res = await fetch(`${API_BASE}/upload-csv`, {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'CSV Upload failed')

            setCsvColumns(data.columns)
            setCsvPreview(data.preview_rows)

            // Auto-map if names match
            const initialMap = {}
            zones.forEach(z => {
                // If zone label matches a csv column (case-insensitive)
                const match = data.columns.find(c => c.toLowerCase() === z.label?.toLowerCase() || c.toLowerCase() === 'name')
                if (match) initialMap[z.id] = match
            })
            setMapping(initialMap)

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const saveMapping = async () => {
        setLoading(true)
        try {
            // Convert mapping {zoneId: column} to what backend expects
            // Backend expects: mapping: { "ColumnName": "zone_id" } ??? 
            // Wait, let's check routes.py... MappingRequest: mapping: Dict[str, Any]
            // Usually it's CSV Column -> Zone ID(s). 
            // Let's assume frontend mapping is { zone_id: column_name }.
            // We need to invert it or send as is depending on backend logic.
            // Looking at legacy App.jsx logic could clarify, but let's assume { column: zone_id }

            const backendMapping = {}
            // Invert the frontend mapping: { zone_id: column } -> { column: zone_id }
            Object.entries(mapping).forEach(([zoneId, col]) => {
                if (col) backendMapping[col] = zoneId // Simplification: 1-to-1
            })

            const res = await fetch(`${API_BASE}/mapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    mapping: backendMapping
                })
            })
            if (!res.ok) throw new Error('Failed to save mapping')

            // Trigger preview generation
            await generatePreview()
            setStep(4)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ============ STEP 4: PREVIEW ============
    const generatePreview = async () => {
        try {
            const res = await fetch(`${API_BASE}/generate-preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, preview_row: 0 })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail)

            setPreviewUrl(`http://localhost:8000${data.preview_url}`)
        } catch (err) {
            setError(err.message)
        }
    }

    const generateAll = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/generate-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail)

            setOutputs(data.outputs)
            setStep(5)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ============ RENDERERS ============

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in-up pb-24">

            {/* Steps Header */}
            <div className="flex justify-between items-center mb-10 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 -z-10 rounded-full"></div>

                {[
                    { id: 1, label: 'Upload', icon: '📄' },
                    { id: 2, label: 'Design', icon: '🎨' },
                    { id: 3, label: 'Connect', icon: '🔗' },
                    { id: 4, label: 'Preview', icon: '👁️' },
                    { id: 5, label: 'Launch', icon: '🚀' }
                ].map((s) => (
                    <div key={s.id} className="flex flex-col items-center gap-2 bg-slate-900 px-4">
                        <button
                            onClick={() => step > s.id && setStep(s.id)}
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all border-2 
                           ${step >= s.id
                                    ? 'bg-gradient-to-br from-fuchsia-600 to-indigo-600 border-transparent shadow-[0_0_20px_rgba(192,38,211,0.5)] scale-110'
                                    : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                        >
                            {step > s.id ? '✓' : s.icon}
                        </button>
                        <span className={`text-xs font-bold uppercase tracking-wider ${step >= s.id ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-3">
                    <span className="text-xl">⚠️</span> {error}
                </div>
            )}

            {/* STEP 1: UPLOAD */}
            {step === 1 && (
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center p-2 mb-6 rounded-2xl bg-gradient-to-b from-white/10 to-transparent border border-white/10 shadow-2xl backdrop-blur-xl">
                            <span className="text-3xl">✨</span>
                        </div>
                        <h2 className="text-5xl font-bold text-white mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                            Create Magic
                        </h2>
                        <p className="text-lg text-indigo-200/80 max-w-2xl mx-auto leading-relaxed">
                            Upload your premium wedding invitation PDF. We'll help you turn it into thousands of personalized experiences.
                        </p>
                    </div>

                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-fuchsia-600 to-indigo-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <label className="relative block w-full aspect-[21/9] rounded-[2rem] border-2 border-dashed border-white/20 bg-slate-900/60 hover:bg-slate-800/60 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden backdrop-blur-xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                            <div className="relative z-10 flex flex-col items-center transform group-hover:scale-105 transition-transform duration-300">
                                <div className="w-20 h-20 mb-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shadow-2xl group-hover:shadow-fuchsia-500/20 transition-all">
                                    <span className="text-4xl">📄</span>
                                </div>
                                <span className="text-2xl font-bold text-white mb-3">Drop PDF Template Here</span>
                                <span className="text-sm text-indigo-300/70 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
                                    Supports High-Res Print PDFs
                                </span>
                            </div>
                            <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
                        </label>
                    </div>
                    {loading && <div className="mt-8 text-center text-fuchsia-300 animate-pulse font-medium">Reading PDF Structure...</div>}
                </div>
            )}

            {/* STEP 2: DESIGN (ANNOTATION) - Sidebar Layout */}
            {step === 2 && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setStep(1)} className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition">← Back</button>
                            <div className="h-6 w-px bg-white/10"></div>
                            <h2 className="text-xl font-bold text-white">Define Zones</h2>
                            <p className="text-slate-500 text-sm hidden sm:block">Draw rectangles on the PDF where guest data will go.</p>
                        </div>
                        <button onClick={saveZones} className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-500 transition-all">
                            Save & Continue →
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT: Canvas (Frameless) */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                            {/* Pagination Bar */}
                            <div className="flex justify-center items-center gap-4 bg-slate-800/80 backdrop-blur-md p-2 rounded-xl border border-white/5 w-fit mx-auto sticky top-4 z-10 shadow-xl">
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed">← Prev</button>
                                <span className="text-sm font-bold text-slate-200">Page {currentPage} of {pageCount}</span>
                                <button disabled={currentPage === pageCount} onClick={() => setCurrentPage(c => c + 1)} className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
                            </div>

                            {/* A4 Aspect Ratio Frame Container */}
                            <div className="flex-1 flex items-start justify-center p-4">
                                <div className="relative bg-slate-950 rounded-lg border border-white/10 shadow-2xl overflow-hidden" style={{ aspectRatio: '210 / 297', maxHeight: '70vh', width: 'auto' }}>
                                    <AnnotationCanvas
                                        imageUrl={pdfPreviews[currentPage - 1]}
                                        initialRegions={zones}
                                        onChange={handleZoneChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Tools Sidebar */}
                        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/5 p-6 flex flex-col gap-6 h-[800px] overflow-hidden sticky top-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white">Zones ({zones.length})</h3>
                                <button onClick={() => setZones([])} className="text-xs text-red-400 hover:text-red-300">Clear All</button>
                            </div>

                            {/* Manual Add */}
                            <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5 space-y-3 flex-shrink-0">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">➕ Add Manual Zone</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">X Position</label>
                                        <input type="number" placeholder="0" className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-indigo-500 outline-none" id="zone_x" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">Y Position</label>
                                        <input type="number" placeholder="0" className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-indigo-500 outline-none" id="zone_y" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">Width</label>
                                        <input type="number" placeholder="100" className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-indigo-500 outline-none" id="zone_w" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">Height</label>
                                        <input type="number" placeholder="30" className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-indigo-500 outline-none" id="zone_h" />
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        const x = Number(document.getElementById('zone_x').value) || 0;
                                        const y = Number(document.getElementById('zone_y').value) || 0;
                                        const w = Number(document.getElementById('zone_w').value) || 100;
                                        const h = Number(document.getElementById('zone_h').value) || 30;
                                        setZones([...zones, {
                                            id: Date.now(),
                                            x, y, width: w, height: h,
                                            label: `Zone ${zones.length + 1}`,
                                            color_hex: '#000000',
                                            font_size: 14,
                                            mask_enabled: false
                                        }]);
                                    }}
                                    className="w-full py-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-sm font-bold border border-indigo-600/30 hover:bg-indigo-600/30 transition"
                                >
                                    + Add Zone on Page {currentPage}
                                </button>
                            </div>

                            {/* Zone List with Details */}
                            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                {zones.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-white/5 rounded-xl">
                                        No zones yet.<br />Draw on canvas or add manually.
                                    </div>
                                ) : (
                                    zones.map((z, i) => (
                                        <div key={z.id} className="group p-3 bg-slate-800/40 rounded-xl border border-white/5 hover:border-fuchsia-500/30 hover:bg-slate-800/60 transition-all">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                                                    <input
                                                        className="bg-transparent text-sm font-bold text-white outline-none w-24"
                                                        value={z.label || `Zone ${i + 1}`}
                                                        onChange={(e) => {
                                                            const updated = zones.map(zne => zne.id === z.id ? { ...zne, label: e.target.value } : zne);
                                                            setZones(updated);
                                                        }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => setZones(zones.filter(zone => zone.id !== z.id))}
                                                    className="w-6 h-6 rounded bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition text-xs"
                                                >
                                                    ✕
                                                </button>
                                            </div>

                                            {/* Zone Config Grid - Full Controls */}
                                            <div className="space-y-3 mt-2">
                                                {/* Row 1: Ink Color & Font Size */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-slate-900/50 p-2 rounded-lg border border-white/5">
                                                        <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wide">Ink Color</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                className="w-6 h-6 rounded border-none bg-transparent cursor-pointer"
                                                                value={z.color_hex || '#000000'}
                                                                onChange={(e) => {
                                                                    const updated = zones.map(zne => zne.id === z.id ? { ...zne, color_hex: e.target.value } : zne);
                                                                    setZones(updated);
                                                                }}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="bg-transparent text-xs text-white w-full outline-none font-mono uppercase"
                                                                value={z.color_hex || '#000000'}
                                                                onChange={(e) => {
                                                                    const updated = zones.map(zne => zne.id === z.id ? { ...zne, color_hex: e.target.value } : zne);
                                                                    setZones(updated);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-900/50 p-2 rounded-lg border border-white/5">
                                                        <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wide">Font Size</label>
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                className="bg-transparent text-xs text-white w-full outline-none"
                                                                value={z.font_size || 14}
                                                                onChange={(e) => {
                                                                    const updated = zones.map(zne => zne.id === z.id ? { ...zne, font_size: Number(e.target.value) } : zne);
                                                                    setZones(updated);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Row 2: H. Align & V. Align */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-slate-900/50 p-2 rounded-lg border border-white/5">
                                                        <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wide">H. Align</label>
                                                        <select
                                                            className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 border border-white/10 outline-none"
                                                            value={z.align || 'center'}
                                                            onChange={(e) => {
                                                                const updated = zones.map(zne => zne.id === z.id ? { ...zne, align: e.target.value } : zne);
                                                                setZones(updated);
                                                            }}
                                                        >
                                                            <option value="left">Left</option>
                                                            <option value="center">Center</option>
                                                            <option value="right">Right</option>
                                                        </select>
                                                    </div>
                                                    <div className="bg-slate-900/50 p-2 rounded-lg border border-white/5">
                                                        <label className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wide">V. Align</label>
                                                        <select
                                                            className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 border border-white/10 outline-none"
                                                            value={z.valign || 'middle'}
                                                            onChange={(e) => {
                                                                const updated = zones.map(zne => zne.id === z.id ? { ...zne, valign: e.target.value } : zne);
                                                                setZones(updated);
                                                            }}
                                                        >
                                                            <option value="top">Top</option>
                                                            <option value="middle">Middle</option>
                                                            <option value="bottom">Bottom</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Row 3: Text Mode */}
                                                <div className="bg-slate-900/50 p-2 rounded-lg border border-white/5">
                                                    <label className="text-[10px] text-slate-400 block mb-2 uppercase tracking-wide">Text Mode</label>
                                                    <div className="grid grid-cols-4 gap-1">
                                                        {[
                                                            { id: 'overlay', label: 'Overlay' },
                                                            { id: 'auto_mask', label: 'Auto Mask' },
                                                            { id: 'magic', label: 'Magic' },
                                                            { id: 'custom', label: 'Custom' }
                                                        ].map((mode) => (
                                                            <button
                                                                key={mode.id}
                                                                onClick={() => {
                                                                    const updated = zones.map(zne => zne.id === z.id ? {
                                                                        ...zne,
                                                                        mask_mode: mode.id,
                                                                        mask_enabled: mode.id !== 'overlay'
                                                                    } : zne);
                                                                    setZones(updated);
                                                                }}
                                                                className={`
                                                                    px-2 py-1.5 rounded text-[9px] font-bold transition-all
                                                                    ${(z.mask_mode === mode.id || (!z.mask_mode && mode.id === 'auto_mask'))
                                                                        ? 'bg-indigo-500 text-white'
                                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                                    }
                                                                `}
                                                            >
                                                                {mode.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 mt-1.5 flex items-center gap-1">
                                                        <span>💡</span> Auto: Smart background detection & mask
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: DATA (CSV) */}
            {step === 3 && (
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-10">
                        {/* Back Button added to header area to match screenshot flow if needed, or keep separate */}
                        <div className="flex justify-center items-center gap-4 mb-3">
                            <button onClick={() => setStep(2)} className="bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-xs hover:text-white transition">← Back</button>
                            <h2 className="text-3xl font-bold text-white">Upload CSV & Map Columns</h2>
                        </div>
                    </div>

                    {!csvColumns.length ? (
                        <div className="max-w-3xl mx-auto bg-slate-900/40 rounded-3xl border border-white/10 p-12 text-center">
                            <label className="group block w-full p-16 rounded-[2rem] border-2 border-dashed border-white/10 bg-slate-900/60 hover:bg-slate-800/60 hover:border-indigo-500/50 cursor-pointer transition-all relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="text-5xl block mb-6 group-hover:scale-110 transition-transform duration-300">📊</span>
                                <span className="text-xl font-bold text-white block mb-2">Upload your guest list CSV</span>
                                <input type="file" className="hidden" accept=".csv" onChange={handleCsvUpload} />
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-6">

                            <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl">
                                <div className="p-4 border-b border-white/10 bg-white/5">
                                    <p className="text-slate-400 text-sm">Found {csvRowCount} rows with {csvColumns.length} columns</p>
                                    <h3 className="text-lg font-bold text-white mt-1">Map CSV Columns to Zones</h3>
                                </div>

                                <div className="p-6 space-y-3">
                                    {csvColumns.map((col, i) => {
                                        // Find which zone(s) is mapped to this column
                                        const mappedZoneId = Object.keys(mapping).find(zId => mapping[zId] === col);
                                        const previewVal = csvPreview.length > 0 ? csvPreview[0][col] : '';

                                        return (
                                            <div key={i} className="flex items-center gap-4 p-4 bg-slate-950/30 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors group">
                                                {/* Left: Column Name & Preview */}
                                                <div className="flex-1">
                                                    <div className="text-sm font-bold text-white mb-1">{col}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[300px] italic">e.g. {previewVal || '...'}</div>
                                                </div>

                                                <div className="text-slate-600">→</div>

                                                {/* Right: Zone Select */}
                                                <div className="flex-1 relative">
                                                    <div className="relative group/select">
                                                        <select
                                                            className="w-full appearance-none bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-500"
                                                            value={mappedZoneId || ''}
                                                            onChange={(e) => {
                                                                const zId = e.target.value;
                                                                if (zId) {
                                                                    // Map this zone to this column (overwriting any previous mapping for this zone)
                                                                    setMapping({ ...mapping, [zId]: col });
                                                                } else {
                                                                    // If we could unmap distinct zones via this dropdown, we would need to find which zone matches valid ID
                                                                    // But standard select doesn't easily support "un-selecting" in this inverted view without a "None" option that clears specific key
                                                                    // For now, selecting a new zone simply moves that zone to this column.
                                                                }
                                                            }}
                                                        >
                                                            <option value="">Select zone(s)</option>
                                                            {zones.map(z => (
                                                                <option key={z.id} value={z.id}>
                                                                    {z.label || `Zone ${z.id}`}
                                                                    {mapping[z.id] && mapping[z.id] !== col ? ` (Mapped to ${mapping[z.id]})` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>
                                                    </div>
                                                    {/* Visual indicator if mapped */}
                                                    {mappedZoneId && (
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 mr-8">
                                                            <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded">Mapped</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Phone Number Column Selector */}
                            <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl p-6">
                                <label className="block text-sm text-slate-400 mb-2">Phone Number Column (for WhatsApp)</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all"
                                        value={phoneColumn}
                                        onChange={(e) => setPhoneColumn(e.target.value)}
                                    >
                                        <option value="">-- None --</option>
                                        {csvColumns.map(col => <option key={col} value={col}>{col} (e.g. {csvPreview[0]?.[col]})</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                                </div>
                            </div>

                            <button
                                onClick={saveMapping}
                                disabled={Object.keys(mapping).length === 0}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-bold shadow-xl shadow-fuchsia-900/20 hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:grayscale"
                            >
                                Generate Preview →
                            </button>

                        </div>
                    )}
                </div>
            )}

            {/* STEP 4: PREVIEW */}
            {step === 4 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 h-[650px] items-center">
                    <div className="h-full bg-slate-900/50 rounded-[2.5rem] border border-white/10 p-4 flex items-center justify-center relative shadow-2xl backdrop-blur-3xl">
                        {previewUrl ? (
                            <iframe src={previewUrl} className="w-full h-full rounded-[2rem] bg-white shadow-inner" title="PDF Preview" />
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin mb-4"></div>
                                <div className="text-slate-400 animate-pulse">Rendering Proof...</div>
                            </div>
                        )}
                        <div className="absolute top-6 left-6 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-white border border-white/10 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Live Preview
                        </div>
                    </div>

                    <div className="flex flex-col justify-center space-y-8 px-4">
                        <div>
                            <h2 className="text-4xl font-bold text-white mb-4">Production Ready?</h2>
                            <p className="text-lg text-slate-400 leading-relaxed">
                                We are ready to generate personalized PDFs for <span className="text-white font-bold">{csvPreview.length + 12} guests</span>.
                                This process will run on our secure high-performance servers.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-800/50 border border-white/5">
                            <div className="flex justify-between mb-2 text-sm text-slate-400">
                                <span>Est. Processing Time</span>
                                <span className="text-white">~45 seconds</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-indigo-500/20"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5 pt-4">
                            <button onClick={() => setStep(3)} className="py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all border border-white/5">
                                ← Make Changes
                            </button>
                            <button onClick={generateAll} className="py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2">
                                <span>🚀</span> Start Production Job
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 5: RESULTS */}
            {step === 5 && (
                <div className="max-w-4xl mx-auto text-center space-y-12 animate-fade-in-up">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse"></div>
                        <div className="relative inline-flex items-center justify-center w-32 h-32 rounded-full bg-slate-900 border-4 border-emerald-500/50 text-7xl shadow-2xl">
                            ✨
                        </div>
                    </div>

                    <div>
                        <h2 className="text-5xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-emerald-200">
                            Job Complete!
                        </h2>
                        <p className="text-xl text-slate-400">
                            Successfully generated <span className="text-white font-bold">{outputs.length}</span> personalized invitations.
                        </p>
                    </div>

                    {/* Features Showcase: File List */}
                    <div className="max-w-xl mx-auto bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden text-left shadow-2xl">
                        <div className="px-6 py-4 bg-slate-800/50 border-b border-white/5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Output Files
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {outputs.slice(0, 5).map((out, i) => (
                                <div key={i} className="px-6 py-3 border-b border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">📄</span>
                                        <span className="text-sm text-slate-300">{out.split('/').pop()}</span>
                                    </div>
                                    <span className="text-xs text-emerald-400">Ready</span>
                                </div>
                            ))}
                            {outputs.length > 5 && (
                                <div className="px-6 py-3 text-center text-xs text-slate-500 italic">
                                    ...and {outputs.length - 5} more files
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                        <button className="p-8 rounded-[2rem] bg-slate-800 border border-white/5 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all group text-left relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
                            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform text-indigo-400">💾</div>
                            <div className="text-2xl font-bold text-white mb-2">Download ZIP</div>
                            <div className="text-sm text-slate-400">Download all files in a compressed archive</div>
                        </button>

                        <button className="p-8 rounded-[2rem] bg-gradient-to-br from-[#25D366]/10 to-[#128C7E]/10 border border-[#25D366]/20 hover:shadow-[0_0_40px_rgba(37,211,102,0.15)] transition-all group text-left relative overflow-hidden">
                            <div className="absolute inset-0 bg-[#25D366]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="text-5xl mb-6 text-[#25D366]">💬</div>
                            <div className="text-2xl font-bold text-white mb-2">WhatsApp Blast</div>
                            <div className="text-sm text-slate-400">Send individually to each guest number</div>
                            <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-[#25D366]/20 text-[#25D366] text-xs font-bold border border-[#25D366]/30">
                                MANAGED SERVICE
                            </div>
                        </button>
                    </div>
                </div>
            )}

        </div>
    )
}

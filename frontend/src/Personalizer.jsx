import { useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, ProtectedRoute } from './AuthContext.jsx'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import './index.css'

const API_BASE = '/api'

// Main Personalizer Component (existing app logic)
function Personalizer() {
  const { user, logout } = useAuth()
  const [step, setStep] = useState(1)
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Step 1: PDF Upload
  const [pdfPreviews, setPdfPreviews] = useState([])  // All page preview URLs
  const [currentPage, setCurrentPage] = useState(1)   // Current page (1-indexed)
  const [pageCount, setPageCount] = useState(0)

  // Step 2: Zones
  const [zones, setZones] = useState([])
  const [currentZone, setCurrentZone] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)  // For live drawing preview

  // Step 3: CSV & Mapping
  const [csvColumns, setCsvColumns] = useState([])
  const [csvRowCount, setCsvRowCount] = useState(0)
  const [csvPreview, setCsvPreview] = useState([])
  const [mapping, setMapping] = useState({})
  const [phoneColumn, setPhoneColumn] = useState('')

  // Step 4: Preview
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewData, setPreviewData] = useState(null)

  // Step 5: Outputs
  const [outputs, setOutputs] = useState([])

  // WhatsApp
  const [senderNumber, setSenderNumber] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [whatsappReport, setWhatsappReport] = useState(null)
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)
  const [showAdvancedWa, setShowAdvancedWa] = useState(false)
  const [apiToken, setApiToken] = useState('')
  const [phoneId, setPhoneId] = useState('')

  // ============ Step 1: Upload PDF ============
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/upload-pdf`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Upload failed')

      setSessionId(data.session_id)
      setPdfPreviews(data.preview_urls)  // Store all pages
      setCurrentPage(1)
      setPageCount(data.page_count)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ============ Step 2: Zone Drawing ============
  const handleMouseDown = (e) => {
    // Don't start drawing if clicking on an existing zone
    if (e.target.classList.contains('zone-rect')) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setIsDrawing(true)
    setDrawStart({ x, y })
    setDrawCurrent({ x, y })
  }

  const handleMouseMove = (e) => {
    if (!isDrawing || !drawStart) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    setDrawCurrent({ x, y })
  }

  const handleMouseUp = (e) => {
    if (!isDrawing || !drawStart) return

    const rect = e.currentTarget.getBoundingClientRect()
    // e.clientX is relative to viewport. rect is the container.
    // We need the IMAGE element to get the ratio between visual size and natural size (150 DPI)
    const imgElement = document.getElementById('pdf-preview-img')
    // If we can't find the image, valid fallback or return
    if (!imgElement) return

    const scaleX = imgElement.naturalWidth / imgElement.clientWidth
    const scaleY = imgElement.naturalHeight / imgElement.clientHeight

    // Mouse coordinates in visual pixels relative to container
    const visualX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const visualY = Math.max(0, Math.min(e.clientY - rect.top, rect.height))

    const startX = drawStart.x
    const startY = drawStart.y

    const w = Math.abs(visualX - startX)
    const h = Math.abs(visualY - startY)
    const x = Math.min(visualX, startX)
    const y = Math.min(visualY, startY)

    // Convert visual pixels -> Image pixels (150 DPI) -> PDF points (72 DPI)
    const imgX = x * scaleX
    const imgY = y * scaleY
    const imgW = w * scaleX
    const imgH = h * scaleY

    // PDF Scale (72 DPI / 150 DPI)
    const pdfScale = 72 / 150

    // Final PDF Points
    const pdfX = imgX * pdfScale
    const pdfY = imgY * pdfScale
    const pdfW = imgW * pdfScale
    const pdfH = imgH * pdfScale

    const newZone = {
      zone_id: `zone_${zones.length + 1}`,
      page_number: currentPage,
      x: pdfX,
      y: pdfY,
      width: pdfW,
      height: pdfH,
      font_size: Math.max(8, pdfH * 0.6),
      color_hex: '#000000',
      align: 'center',
      valign: 'middle',
      mask_enabled: true,
      mask_mode: 'auto_sample',
      _px: { x, y, width: w, height: h }
    }

    // Minimum zone size of 20px (visual)
    if (w > 20 && h > 15) {
      setZones([...zones, newZone])
      setCurrentZone(zones.length)
    }

    setIsDrawing(false)
    setDrawStart(null)
    setDrawCurrent(null)
  }

  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false)
      setDrawStart(null)
      setDrawCurrent(null)
    }
  }

  // Calculate live drawing preview rectangle
  const getDrawPreview = () => {
    if (!isDrawing || !drawStart || !drawCurrent) return null
    return {
      x: Math.min(drawStart.x, drawCurrent.x),
      y: Math.min(drawStart.y, drawCurrent.y),
      width: Math.abs(drawCurrent.x - drawStart.x),
      height: Math.abs(drawCurrent.y - drawStart.y)
    }
  }

  const updateZone = (index, updates) => {
    const updated = [...zones]
    updated[index] = { ...updated[index], ...updates }
    setZones(updated)
  }

  const deleteZone = (index) => {
    setZones(zones.filter((_, i) => i !== index))
    setCurrentZone(null)
  }

  const saveZones = async () => {
    if (zones.length === 0) {
      setError('Please draw at least one zone')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // ============ Step 3: CSV Upload & Mapping ============
  const handleCsvUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('session_id', sessionId)
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/upload-csv`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Upload failed')

      setCsvColumns(data.columns)
      setCsvRowCount(data.row_count)
      setCsvPreview(data.preview_rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveMapping = async () => {
    if (Object.keys(mapping).length === 0) {
      setError('Please map at least one column to a zone')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          mapping,
          phone_column: phoneColumn || null
        })
      })

      if (!res.ok) throw new Error('Failed to save mapping')

      setStep(4)
      generatePreview()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ============ Step 4: Preview ============
  const generatePreview = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/generate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, preview_row: 0 })
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Preview failed')

      setPreviewUrl(`${data.preview_url}`)
      setPreviewData(data.guest_data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateAll = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/generate-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Generation failed')

      setOutputs(data.outputs)
      setStep(5)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ============ Step 5: WhatsApp ============
  const handleSendWhatsapp = async () => {
    if (!senderNumber) {
      setError('Please enter your WhatsApp number')
      return
    }

    setSendingWhatsapp(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          sender_number: senderNumber,
          message: customMessage,
          api_token: apiToken || null,
          phone_id: phoneId || null
        })
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'WhatsApp send failed')

      setWhatsappReport(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingWhatsapp(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="app-title">🎊 Invitewala</h1>
          <p className="app-subtitle">Wedding Card Personalization System</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            👤 {user?.name || user?.email} ({user?.role})
          </span>
          <button
            onClick={logout}
            style={{
              padding: '8px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Step Indicators */}
      <div className="steps-container">
        {[
          { num: 1, label: 'Upload PDF' },
          { num: 2, label: 'Define Zones' },
          { num: 3, label: 'Map CSV' },
          { num: 4, label: 'Preview' },
          { num: 5, label: 'Generate & Send' }
        ].map(s => (
          <div
            key={s.num}
            className={`step-indicator ${step === s.num ? 'active' : ''} ${step > s.num ? 'completed' : ''}`}
            onClick={() => {
              // Allow going back to any completed step
              if (s.num <= step) setStep(s.num)
            }}
            style={{ cursor: s.num <= step ? 'pointer' : 'default' }}
          >
            <span className="step-number">{step > s.num ? '✓' : s.num}</span>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="glass-card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)', marginBottom: 24 }}>
          <p style={{ color: 'var(--danger)' }}>❌ {error}</p>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}

      {/* Step 1: Upload PDF */}
      {step === 1 && !loading && (
        <section className="section">
          <h2 className="section-title">Upload Wedding Card PDF</h2>
          <div className="glass-card">
            <label htmlFor="pdf-upload" className="upload-zone">
              <div className="upload-icon">📄</div>
              <p className="upload-text">Drag & drop your wedding card PDF here</p>
              <p className="upload-hint">or click to browse</p>
              <input
                type="file"
                id="pdf-upload"
                accept=".pdf"
                onChange={handlePdfUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </section>
      )}

      {/* Step 2: Zone Selection */}
      {step === 2 && !loading && (
        <section className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ padding: '8px 16px' }}>
              ← Back
            </button>
            <h2 className="section-title" style={{ margin: 0 }}>Define Zones</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            Draw rectangles on the PDF to mark areas where guest data will be inserted.
          </p>

          <div className="glass-card">
            {/* Page Navigation */}
            {pageCount > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                marginBottom: 20,
                padding: 12,
                background: 'var(--bg-tertiary)',
                borderRadius: 12
              }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '8px 16px' }}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
                  disabled={currentPage === pageCount}
                  style={{ padding: '8px 16px' }}
                >
                  Next →
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
              {/* PDF Preview with Zone Drawing */}
              <div className="zone-canvas-container" style={{ position: 'relative' }}>
                <img
                  id="pdf-preview-img"
                  src={`${pdfPreviews[currentPage - 1]}`}
                  alt={`PDF Page ${currentPage}`}
                  style={{ display: 'block', width: '100%', userSelect: 'none' }}
                  draggable={false}
                />
                <div
                  className="zone-overlay"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: isDrawing ? 'crosshair' : 'crosshair' }}
                >
                  {/* Existing zones for current page */}
                  {zones.filter(z => z.page_number === currentPage).map((zone, i) => {
                    const actualIndex = zones.findIndex(z2 => z2 === zone)
                    return (
                      <div
                        key={actualIndex}
                        className="zone-rect"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCurrentZone(actualIndex)
                        }}
                        style={{
                          left: zone._px.x,
                          top: zone._px.y,
                          width: zone._px.width,
                          height: zone._px.height,
                          borderColor: currentZone === actualIndex ? '#f59e0b' : zone.color_hex,
                          background: zone.mask_enabled
                            ? (zone.mask_mode === 'solid' ? 'rgba(255,255,255,0.4)' : `${zone.color_hex}33`)
                            : 'transparent',
                          borderWidth: currentZone === actualIndex ? 3 : 2,
                          borderStyle: zone.mask_enabled ? 'solid' : 'dashed'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2
                        }}>
                          <span style={{
                            background: 'rgba(0,0,0,0.8)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            whiteSpace: 'nowrap'
                          }}>
                            {zone.zone_id}
                          </span>
                          <span style={{
                            background: zone.mask_enabled
                              ? (zone.mask_mode === 'solid' ? 'rgba(255,255,255,0.9)' : 'rgba(99, 102, 241, 0.9)')
                              : 'rgba(245, 158, 11, 0.9)',
                            color: zone.mask_enabled && zone.mask_mode === 'solid' ? '#000' : '#fff',
                            padding: '1px 4px',
                            borderRadius: 3,
                            fontSize: 8,
                            fontWeight: 600
                          }}>
                            {!zone.mask_enabled ? 'OVERLAY' : zone.mask_mode === 'solid' ? 'SOLID' : 'MASK'}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Live drawing preview */}
                  {isDrawing && drawStart && drawCurrent && (() => {
                    const preview = getDrawPreview()
                    if (!preview || preview.width < 5 || preview.height < 5) return null
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          left: preview.x,
                          top: preview.y,
                          width: preview.width,
                          height: preview.height,
                          border: '2px dashed #6366f1',
                          background: 'rgba(99, 102, 241, 0.15)',
                          pointerEvents: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <span style={{
                          background: 'rgba(0,0,0,0.8)',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'monospace'
                        }}>
                          {Math.round(preview.width * 72 / 150)} × {Math.round(preview.height * 72 / 150)} pt
                        </span>
                      </div>
                    )
                  })()}
                </div>

                {/* Drawing hint */}
                <div style={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11
                }}>
                  🖱️ Click & drag to draw zones
                </div>
              </div>

              {/* Zone Config Panel */}
              <div>
                <h3 style={{ marginBottom: 16 }}>Zones ({zones.length})</h3>

                {/* Manual Zone Add Form */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 16,
                  border: '1px dashed var(--border-glass)'
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    ➕ Add Zone Manually (PDF points, 72 DPI)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11 }}>X</label>
                      <input
                        type="number"
                        id="manual-x"
                        placeholder="0"
                        style={{ padding: '6px 8px', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11 }}>Y</label>
                      <input
                        type="number"
                        id="manual-y"
                        placeholder="0"
                        style={{ padding: '6px 8px', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11 }}>Width</label>
                      <input
                        type="number"
                        id="manual-width"
                        placeholder="100"
                        style={{ padding: '6px 8px', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11 }}>Height</label>
                      <input
                        type="number"
                        id="manual-height"
                        placeholder="30"
                        style={{ padding: '6px 8px', fontSize: 12 }}
                      />
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const x = parseFloat(document.getElementById('manual-x').value) || 0
                      const y = parseFloat(document.getElementById('manual-y').value) || 0
                      const width = parseFloat(document.getElementById('manual-width').value) || 100
                      const height = parseFloat(document.getElementById('manual-height').value) || 30

                      // Convert PDF points to pixels at 150 DPI for display
                      const scale = 150 / 72
                      const newZone = {
                        zone_id: `zone_${zones.length + 1}`,
                        page_number: currentPage,
                        x: x,
                        y: y,
                        width: width,
                        height: height,
                        font_size: height * 0.6,
                        color_hex: '#000000',
                        align: 'center',
                        valign: 'top',
                        mask_enabled: true,
                        mask_mode: 'auto_sample',
                        _px: {
                          x: x * scale,
                          y: y * scale,
                          width: width * scale,
                          height: height * scale
                        }
                      }
                      setZones([...zones, newZone])
                      setCurrentZone(zones.length)

                      // Clear inputs
                      document.getElementById('manual-x').value = ''
                      document.getElementById('manual-y').value = ''
                      document.getElementById('manual-width').value = ''
                      document.getElementById('manual-height').value = ''
                    }}
                    style={{ width: '100%', marginTop: 10, padding: '8px 12px', fontSize: 12 }}
                  >
                    ➕ Add Zone on Page {currentPage}
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      try {
                        setLoading(true)
                        setError(null)
                        const res = await fetch(`${API_BASE}/auto-detect/${sessionId}`, { method: 'POST' })
                        if (!res.ok) throw new Error('Auto-detect failed')
                        const data = await res.json()

                        // Scale: Backend (Preview Image) -> Frontend (PDF Points)
                        // Preview is 150 DPI. PDF Points are 72 DPI.
                        const scale = 72 / 150;

                        const newZones = data.zones.map((z, i) => ({
                          zone_id: `auto_${Date.now()}_${i}`,
                          page_number: 1, // Auto-detect runs on Page 1
                          x: z.x * scale,
                          y: z.y * scale,
                          width: z.width * scale,
                          height: z.height * scale,
                          font_size: 20,
                          color_hex: '#000000',
                          align: 'center',
                          valign: 'middle',
                          mask_enabled: true,
                          mask_mode: 'auto',
                          manual_bg_color: '',
                          text: { font_size: 20, color_hex: '#000000', align: 'center', valign: 'top' }, // Robustness
                          rect: { x: z.x * scale, y: z.y * scale, width: z.width * scale, height: z.height * scale } // Robustness
                        }))

                        setZones([...zones, ...newZones])
                      } catch (e) {
                        setError('Auto-detect error: ' + e.message)
                      } finally {
                        setLoading(false)
                      }
                    }}
                    style={{ width: '100%', marginTop: 10, padding: '8px 12px', fontSize: 12, background: 'var(--accent)' }}
                  >
                    ✨ Auto Detect Suggested Zones (Beta)
                  </button>
                </div>

                {zones.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Draw rectangles on the PDF or add zones manually above.
                  </p>
                )}

                {zones.map((zone, i) => (
                  <div
                    key={i}
                    className="zone-config-item"
                    style={{
                      marginBottom: 12,
                      borderColor: currentZone === i ? 'var(--accent-primary)' : undefined,
                      opacity: zone.page_number === currentPage ? 1 : 0.6
                    }}
                    onClick={() => {
                      setCurrentZone(i)
                      setCurrentPage(zone.page_number)  // Jump to zone's page
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <span style={{
                          background: 'var(--accent-gradient)',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          P{zone.page_number}
                        </span>
                        <input
                          type="text"
                          value={zone.zone_id}
                          onChange={(e) => updateZone(i, { zone_id: e.target.value })}
                          style={{ flex: 1 }}
                          placeholder="Zone name"
                        />
                      </div>
                      <button className="btn btn-danger" onClick={() => deleteZone(i)} style={{ padding: '6px 12px', marginLeft: 8 }}>
                        🗑️
                      </button>
                    </div>

                    <div className="zone-config-row">
                      <div>
                        <label>Ink Color</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="color"
                            value={zone.color_hex}
                            onChange={(e) => updateZone(i, { color_hex: e.target.value })}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{zone.color_hex}</span>
                        </div>
                      </div>
                      <div>
                        <label>Font Size</label>
                        <input
                          type="number"
                          value={Math.round(zone.font_size)}
                          onChange={(e) => updateZone(i, { font_size: parseFloat(e.target.value) })}
                          min={8}
                          max={72}
                        />
                      </div>
                    </div>

                    <div className="zone-config-row">
                      <div>
                        <label>H. Align</label>
                        <select
                          value={zone.align}
                          onChange={(e) => updateZone(i, { align: e.target.value })}
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div>
                        <label>V. Align</label>
                        <select
                          value={zone.valign || 'top'}
                          onChange={(e) => updateZone(i, { valign: e.target.value })}
                        >
                          <option value="top">Top</option>
                          <option value="middle">Middle</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>
                    </div>

                    {/* Zone Mode: Overlay vs Mask */}
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-glass)' }}>
                      <label style={{ marginBottom: 8 }}>Text Mode</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className={`btn ${!zone.mask_enabled ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateZone(i, { mask_enabled: false })
                          }}
                          style={{ flex: 1, padding: '8px 6px', fontSize: 11 }}
                          title="Text appears on top of existing content"
                        >
                          📝 Overlay
                        </button>
                        <button
                          className={`btn ${zone.mask_enabled && zone.mask_mode === 'auto_sample' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateZone(i, { mask_enabled: true, mask_mode: 'auto_sample' })
                          }}
                          style={{ flex: 1, padding: '8px 6px', fontSize: 11 }}
                          title="Auto-detect background and mask"
                        >
                          🎨 Auto Mask
                        </button>
                        <button
                          className={`btn ${zone.mask_enabled && zone.mask_mode === 'magic_erase' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateZone(i, { mask_enabled: true, mask_mode: 'magic_erase' })
                          }}
                          style={{ flex: 1, padding: '8px 6px', fontSize: 11 }}
                          title="Smart Object Removal: Keeps texture"
                        >
                          🪄 Magic
                        </button>
                        <button
                          className={`btn ${zone.mask_enabled && zone.mask_mode === 'solid' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateZone(i, { mask_enabled: true, mask_mode: 'solid' })
                          }}
                          style={{ flex: 1, padding: '8px 6px', fontSize: 11 }}
                          title="White background mask"
                        >
                          ⬜ Custom
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6 }}>
                        {!zone.mask_enabled
                          ? '📝 Overlay: Text added on top of existing content'
                          : zone.mask_mode === 'solid'
                            ? '⬜ Custom Fill: Pick exact background color'
                            : zone.mask_mode === 'magic_erase'
                              ? '🪄 Magic: Removes text objects, keeps texture'
                              : '🎨 Auto: Smart background detection & mask'
                        }
                      </div>

                      {/* Manual Background Color Picker */}
                      {zone.mask_enabled && zone.mask_mode === 'solid' && (
                        <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 600 }}>Mask Color</label>
                            <span style={{ fontSize: 10, opacity: 0.7 }}>Click to pick</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                              type="color"
                              value={zone.manual_bg_color || '#ffffff'}
                              onChange={(e) => updateZone(i, { manual_bg_color: e.target.value })}
                              style={{
                                width: '100%',
                                height: 32,
                                padding: 0,
                                border: '1px solid var(--border-glass)',
                                borderRadius: 4,
                                cursor: 'pointer',
                                background: 'transparent'
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
                            💡 Pick the <b>Card Color</b> (e.g. Cream) to perfectly hide the White Box.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  className="btn btn-primary"
                  onClick={saveZones}
                  disabled={zones.length === 0}
                  style={{ width: '100%', marginTop: 16 }}
                >
                  Continue to CSV Mapping →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Step 3: CSV & Mapping */}
      {step === 3 && !loading && (
        <section className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ padding: '8px 16px' }}>
              ← Back
            </button>
            <h2 className="section-title" style={{ margin: 0 }}>Upload CSV & Map Columns</h2>
          </div>

          <div className="glass-card" style={{ marginBottom: 24 }}>
            <label htmlFor="csv-upload" className="upload-zone" style={{ padding: 40 }}>
              <div className="upload-icon">📊</div>
              <p className="upload-text">Upload your guest list CSV</p>
              <input
                type="file"
                id="csv-upload"
                accept=".csv"
                onChange={handleCsvUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {csvColumns.length > 0 && (
            <div className="glass-card">
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
                Found {csvRowCount} rows with {csvColumns.length} columns
              </p>

              <h3 style={{ marginBottom: 16 }}>Map CSV Columns to Zones</h3>

              <div className="mapping-grid">
                {csvColumns.map(col => {
                  const selectedZones = mapping[col] || []
                  const selectedZonesArray = Array.isArray(selectedZones) ? selectedZones : (selectedZones ? [selectedZones] : [])

                  return (
                    <div key={col} className="mapping-row" style={{ gridTemplateColumns: '1fr 40px 1fr', alignItems: 'start' }}>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8 }}>
                        <strong>{col}</strong>
                        {csvPreview[0] && (
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                            e.g., {csvPreview[0][col]}
                          </span>
                        )}
                      </div>
                      <div className="mapping-arrow">→</div>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          Select zone(s):
                        </div>
                        {zones.map(z => (
                          <label
                            key={z.zone_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 8px',
                              marginBottom: 4,
                              background: selectedZonesArray.includes(z.zone_id) ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedZonesArray.includes(z.zone_id)}
                              onChange={(e) => {
                                let newSelected
                                if (e.target.checked) {
                                  newSelected = [...selectedZonesArray, z.zone_id]
                                } else {
                                  newSelected = selectedZonesArray.filter(id => id !== z.zone_id)
                                }
                                setMapping({
                                  ...mapping,
                                  [col]: newSelected.length === 0 ? undefined : (newSelected.length === 1 ? newSelected[0] : newSelected)
                                })
                              }}
                              style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            <span style={{
                              background: 'var(--accent-gradient)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600
                            }}>
                              P{z.page_number}
                            </span>
                            <span style={{ fontSize: 13 }}>{z.zone_id}</span>
                          </label>
                        ))}
                        {zones.length === 0 && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No zones defined</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border-glass)' }}>
                <label>Phone Number Column (for WhatsApp)</label>
                <select
                  value={phoneColumn}
                  onChange={(e) => setPhoneColumn(e.target.value)}
                  style={{ marginTop: 8 }}
                >
                  <option value="">-- None --</option>
                  {csvColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={saveMapping}
                style={{ width: '100%', marginTop: 24 }}
              >
                Generate Preview →
              </button>
            </div>
          )}
        </section>
      )}

      {/* Step 4: Preview */}
      {step === 4 && !loading && (
        <section className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ padding: '8px 16px' }}>
              ← Back to Mapping
            </button>
            <h2 className="section-title" style={{ margin: 0 }}>Preview</h2>
          </div>

          <div className="glass-card">
            <div className="preview-container">
              <div className="preview-pdf">
                {previewUrl && (
                  <embed
                    src={previewUrl}
                    type="application/pdf"
                    style={{ width: '100%', height: 600 }}
                  />
                )}
              </div>

              <div className="preview-info">
                <h3 style={{ marginBottom: 16 }}>Preview Data</h3>
                {previewData && Object.entries(previewData).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <label>{key}</label>
                    <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                      {value}
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 24 }}>
                  <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ marginRight: 12 }}>
                    ← Back
                  </button>
                  <button className="btn btn-success" onClick={generateAll}>
                    ✓ Confirm & Generate All ({csvRowCount})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Step 5: Outputs & WhatsApp */}
      {step === 5 && !loading && (
        <section className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(4)} style={{ padding: '8px 16px' }}>
              ← Back to Preview
            </button>
            <h2 className="section-title" style={{ margin: 0 }}>Generated PDFs ({outputs.length})</h2>
            <button
              className="btn btn-primary"
              onClick={() => {
                setStep(1)
                setSessionId(null)
                setPdfPreviews([])
                setZones([])
                setMapping({})
                setOutputs([])
              }}
              style={{ marginLeft: 'auto', padding: '8px 16px' }}
            >
              🔄 Start New
            </button>
          </div>

          {/* WhatsApp Sender UI */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3>📱 WhatsApp Distribution</h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  Your WhatsApp Number (Sender)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="+91 99999 99999"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  style={{ marginBottom: '15px' }}
                />

                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  Message (Optional, use {'{name}'} for guest name)
                </label>
                <textarea
                  className="input-field"
                  placeholder="Dear {name}, Please find your invitation attached..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', marginBottom: '15px' }}
                />

                {/* Advanced Toggle */}
                <div
                  onClick={() => setShowAdvancedWa(!showAdvancedWa)}
                  style={{
                    cursor: 'pointer', color: 'var(--primary)',
                    fontSize: '14px', userSelect: 'none', marginBottom: '10px'
                  }}
                >
                  {showAdvancedWa ? '▼ Hide Cloud API Settings' : '▶ Show Cloud API Settings (Background Sending) ⚡'}
                </div>

                {showAdvancedWa && (
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>
                      Get free credentials from <a href="https://developers.facebook.com" target="_blank" style={{ color: 'var(--primary)' }}>Meta Developers</a>.
                      Recommended for bulk sending without opening browser.
                    </div>

                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Phone Number ID</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 1092837465..."
                      value={phoneId}
                      onChange={(e) => setPhoneId(e.target.value)}
                      style={{ marginBottom: '10px' }}
                    />

                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>System User Access Token</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="EA..."
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSendWhatsapp}
                disabled={sendingWhatsapp || (!senderNumber && !apiToken)}
                style={{ height: '42px', minWidth: '120px', marginTop: '28px' }}
              >
                {sendingWhatsapp ? 'Sending...' : (apiToken ? '🚀 Send Background' : '🚀 Send Web')}
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px' }}>
              <strong>⚠️ Note:</strong>
              <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                <li>This will open WhatsApp Web for each contact.</li>
                <li>Guests without numbers will have their PDFs <strong>REVOKED (Deleted)</strong>.</li>
                <li>Report will be generated automatically.</li>
              </ul>
            </div>

            {whatsappReport && (
              <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0, 255, 150, 0.1)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>📊 Delivery Report</h4>
                <div>Total: {whatsappReport.total}</div>
                <div style={{ color: '#4ade80' }}>Sent: {whatsappReport.sent}</div>
                <div style={{ color: '#f87171' }}>Failed/Revoked: {whatsappReport.failed}</div>

                <div style={{ marginTop: '10px', maxHeight: '150px', overflowY: 'auto', fontSize: '11px' }}>
                  {whatsappReport.details.map((d, i) => (
                    <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {d.status === 'sent' ? '✅' : d.status === 'revoked' ? '🗑️' : '❌'} {d.guest_name || d.filename}: {d.status} ({d.error || 'OK'})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="glass-card">
            <div className="output-gallery">
              {outputs.map((output, i) => (
                <div key={i} className="output-card">
                  <div className="output-icon">📄</div>
                  <div className="output-name">{output.filename}</div>
                  {output.phone && <div className="output-phone">📱 {output.phone}</div>}
                  <a
                    href={`${output.url}`}
                    download
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                  >
                    ⬇️ Download
                  </a>
                </div>
              ))}
            </div>
          </div>

        </section>
      )}
    </div>
  )
}

// Main App Component with Routing
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredRole="sudo_admin">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/personalize"
        element={
          <ProtectedRoute requiredRole="admin">
            <Personalizer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute requiredRole="designer">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute requiredRole="sudo_admin">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute requiredRole="admin">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute requiredRole="designer">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredRole="sudo_admin">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredRole="sudo_admin">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App

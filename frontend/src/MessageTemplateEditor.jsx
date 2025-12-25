import React, { useState, useEffect } from 'react';

// Common placeholders for wedding invites
const PLACEHOLDERS = [
    { label: 'Guest Name', value: '{name}' },
    { label: 'Event Date', value: '{event_date}' },
    { label: 'Venue', value: '{venue}' },
    { label: 'Host Line', value: '{host_line}' },
    { label: 'Custom Note', value: '{custom_note}' }
];

// Pre-built templates for quick start
const PRESETS = {
    en: "Namaste {name},\n\nYou are cordially invited to the wedding of our children. Please find the attached invitation card.\n\nDate: {event_date}\nVenue: {venue}\n\nWe look forward to your blessings.\n\nRegards,\n{host_line}",
    gu: "જય શ્રી કૃષ્ણ {name},\n\nઅમારા પરિવારના આંગણે રૂડા અવસરના આપ સહુને ભાવભર્યું આમંત્રણ છે. સાથે જોડેલી કંકોત્રી સ્વીકારશો.\n\nતારીખ: {event_date}\nસ્થળ: {venue}\n\nઆપની ઉપસ્થિતિ અમારા માટે આશીર્વાદરૂપ રહેશે.\n\nલિ.,\n{host_line}",
    hi: "नमस्ते {name},\n\nहमारे बच्चों के विवाह समारोह में आप सादर आमंत्रित हैं। कृपया निमंत्रण पत्र देखें।\n\nदिनांक: {event_date}\nस्थल: {venue}\n\nहम आपके आशीर्वाद की कामना करते हैं।\n\nभवदीय,\n{host_line}"
};

export default function MessageTemplateEditor({ initialValue = "", onSave }) {
    const [text, setText] = useState(initialValue || PRESETS.en);
    const [lang, setLang] = useState('en');
    const [previewData, setPreviewData] = useState({
        name: 'Rameshbhai Patel',
        event_date: '25 Dec 2024',
        venue: 'Grand Hyatt, Mumbai',
        host_line: 'The Patel Family',
        custom_note: ''
    });

    // Handle preset change
    useEffect(() => {
        if (!initialValue) {
            setText(PRESETS[lang]);
        }
    }, [lang, initialValue]);

    const insertPlaceholder = (phValue) => {
        const textarea = document.getElementById('msg-editor');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = text.substring(0, start) + phValue + text.substring(end);
        setText(newText);

        // Restore focus and cursor position (approximate)
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + phValue.length, start + phValue.length);
        }, 0);
    };

    const getPreview = () => {
        let preview = text;
        Object.keys(previewData).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'g');
            preview = preview.replace(regex, previewData[key]);
        });
        return preview;
    };

    return (
        <div className="relative p-1 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 shadow-2xl backdrop-blur-xl group overflow-hidden animate-fade-in-up">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none rounded-[2.5rem]"></div>

            {/* Header */}
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center px-8 py-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <span className="text-4xl filter drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">💬</span>
                    <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Message Studio</h3>
                        <p className="text-fuchsia-200/60 text-sm">Compose personalized WhatsApp templates</p>
                    </div>
                </div>
                <div className="relative group">
                    <select
                        value={lang}
                        onChange={e => setLang(e.target.value)}
                        className="appearance-none bg-slate-900/80 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-fuchsia-500/50 hover:bg-slate-800 transition-colors cursor-pointer min-w-[150px]"
                    >
                        <option value="en">🇬🇧 English</option>
                        <option value="gu">🇮🇳 Gujarati</option>
                        <option value="hi">🇮🇳 Hindi</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                </div>
            </div>

            <div className="relative z-10 p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Editor Column */}
                <div className="space-y-6">
                    {/* Placeholder Chips */}
                    <div className="flex flex-wrap gap-2">
                        {PLACEHOLDERS.map(ph => (
                            <button
                                key={ph.value}
                                onClick={() => insertPlaceholder(ph.value)}
                                className="group relative px-3 py-1.5 rounded-full bg-slate-800/50 border border-white/10 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/10 transition-all cursor-pointer overflow-hidden"
                                title={`Insert ${ph.label}`}
                            >
                                <span className="relative z-10 text-xs font-semibold text-slate-300 group-hover:text-fuchsia-300 transition-colors">
                                    + {ph.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="relative group">
                        <textarea
                            id="msg-editor"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            className="w-full h-[500px] p-6 bg-slate-950/40 border border-white/10 rounded-2xl font-mono text-sm leading-relaxed text-slate-200 focus:border-fuchsia-500/50 focus:bg-slate-900/60 outline-none resize-none transition-all shadow-inner"
                            placeholder="Type your WhatsApp message template here..."
                            spellCheck="false"
                        />
                        {/* Corner Glow */}
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl pointer-events-none group-focus-within:bg-fuchsia-500/20 transition-all"></div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={() => onSave?.(text, lang)}
                            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-bold shadow-[0_0_20px_rgba(192,38,211,0.3)] hover:shadow-[0_0_30px_rgba(192,38,211,0.5)] transition-all transform hover:-translate-y-0.5"
                        >
                            Save Template
                        </button>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="space-y-6">
                    {/* Phone Frame */}
                    <div className="bg-slate-950 rounded-[3rem] border-[8px] border-slate-800 h-full min-h-[600px] relative overflow-hidden shadow-2xl">
                        {/* Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-20"></div>

                        {/* WhatsApp Header */}
                        <div className="bg-[#202c33] h-24 pt-8 flex items-center px-6 gap-3 border-b border-white/5 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-slate-500 to-slate-600 flex items-center justify-center text-white text-xs font-bold">G</div>
                            <div>
                                <div className="text-white font-medium text-sm">Guest Preview</div>
                                <div className="text-[10px] text-slate-400">online</div>
                            </div>
                            <div className="ml-auto flex gap-4 text-slate-400 text-lg">
                                <span>📹</span>
                                <span>📞</span>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="p-4 bg-[#0b141a] h-full overflow-y-auto" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}>
                            <div className="flex flex-col gap-2">
                                {/* Date Divider */}
                                <div className="flex justify-center my-4">
                                    <span className="bg-[#182229] text-[#8696a0] text-[10px] px-3 py-1.5 rounded-lg shadow-sm font-medium uppercase tracking-wide">Today</span>
                                </div>

                                {/* Incoming Message Bubble */}
                                <div className="bg-[#202c33] rounded-xl p-1 shadow-sm max-w-[90%] self-start rounded-tl-none relative group animate-slide-in-left">
                                    {/* PDF attachment mock */}
                                    <div className="flex items-center gap-3 m-1 bg-[#2a3942] p-3 rounded-lg cursor-pointer hover:bg-[#32404a] transition border border-white/5">
                                        <div className="w-10 h-12 bg-red-500/20 text-red-400 flex items-center justify-center rounded text-[10px] font-bold border border-red-500/30">PDF</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-gray-200 truncate font-medium">Invitation Card.pdf</div>
                                            <div className="text-[10px] text-gray-400">1.4 MB • 1 page</div>
                                        </div>
                                    </div>

                                    <div className="whitespace-pre-wrap text-[14px] text-gray-100 leading-relaxed font-[Roboto] px-3 pb-6 pt-2">
                                        {getPreview()}
                                    </div>

                                    <div className="absolute bottom-1 right-2 flex items-center gap-1">
                                        <span className="text-[10px] text-gray-400">10:30 AM</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Variable Controls */}
                    <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
                        <h4 className="font-bold text-fuchsia-400 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
                            <span>🧪</span> Live Preview Variables
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(previewData).filter(([k]) => k !== 'custom_note').map(([key, val]) => (
                                <div key={key} className="space-y-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">{key.replace('_', ' ')}</label>
                                    <input
                                        value={val}
                                        onChange={e => setPreviewData({ ...previewData, [key]: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-xs text-white focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 outline-none transition-all"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

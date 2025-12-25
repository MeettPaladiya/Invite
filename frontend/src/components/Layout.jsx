import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout({ children, user, title }) {
    const [sidebarOpen, setSidebarOpen] = useState(true)

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-fuchsia-500/30 overflow-hidden relative">

            {/* Background Ambient Glows (Shared) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-fuchsia-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] mix-blend-overlay"></div>
            </div>

            {/* Sidebar */}
            <Sidebar user={user} open={sidebarOpen} setOpen={setSidebarOpen} />

            {/* Main Content Area */}
            <div
                className={`
                    flex flex-col h-screen transition-all duration-300 ease-in-out relative z-10
                    ${sidebarOpen ? 'ml-72' : 'ml-24'}
                `}
            >
                <Header title={title} user={user} />

                {/* Content Scroll Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto px-8 pb-8 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}

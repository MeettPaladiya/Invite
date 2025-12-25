import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const NAV_ITEMS = (role) => {
    const all = [
        { icon: '📊', label: 'Dashboard', path: '/dashboard', roles: ['sudo_admin', 'admin'] },
        { icon: '🎨', label: 'Design Studio', path: '/personalize', roles: ['sudo_admin', 'admin'] },
        { icon: '👥', label: 'Customers', path: '/customers', roles: ['sudo_admin', 'admin', 'designer'] },
        { icon: '📈', label: 'Analytics', path: '/analytics', roles: ['sudo_admin'] },
        { icon: '📄', label: 'Reports', path: '/reports', roles: ['sudo_admin', 'admin'] },
        { icon: '✅', label: 'Tasks', path: '/tasks', roles: ['sudo_admin', 'admin', 'designer'] },
        { icon: '👤', label: 'Users', path: '/users', roles: ['sudo_admin'] },
        { icon: '⚙️', label: 'Settings', path: '/settings', roles: ['sudo_admin'] },
    ]
    return all.filter(item => item.roles.includes(role))
}

export default function Sidebar({ user, open, setOpen }) {
    const navigate = useNavigate()
    const location = useLocation()
    const items = NAV_ITEMS(user?.role || 'admin')

    return (
        <aside
            className={`
                fixed top-0 left-0 h-screen z-40 transition-all duration-300 ease-in-out
                ${open ? 'w-72' : 'w-24'}
                bg-slate-900/80 backdrop-blur-xl border-r border-white/5
            `}
        >
            {/* Logo Area */}
            <div className="h-24 flex items-center justify-center border-b border-white/5 relative">
                <div className={`flex items-center gap-3 transition-opacity duration-300 ${!open ? 'opacity-0 absolute' : 'opacity-100'}`}>
                    <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">🎐</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Invitewala
                    </span>
                </div>
                {/* Collapsed Logo */}
                {!open && (
                    <span className="text-3xl absolute filter drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">🎐</span>
                )}
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-2 mt-4">
                {items.map((item) => {
                    const isActive = location.pathname.startsWith(item.path)
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            title={!open ? item.label : ''}
                            className={`
                                group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200
                                ${isActive
                                    ? 'bg-gradient-to-r from-fuchsia-600/20 to-indigo-600/20 text-white border border-white/10 shadow-[0_0_20px_rgba(192,38,211,0.1)]'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            <span className={`text-xl transition-transform group-hover:scale-110 ${isActive ? 'text-fuchsia-400' : ''}`}>
                                {item.icon}
                            </span>
                            <span className={`font-medium whitespace-nowrap transition-all duration-300 ${!open ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                                {item.label}
                            </span>

                            {/* Active glow indicator */}
                            {isActive && open && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-fuchsia-500 shadow-[0_0_5px_#d946ef]"></div>
                            )}
                        </button>
                    )
                })}
            </nav>

            {/* Collapse Toggle */}
            <button
                onClick={() => setOpen(!open)}
                className="absolute bottom-6 right-6 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
            >
                {open ? '◀' : '▶'}
            </button>
        </aside>
    )
}

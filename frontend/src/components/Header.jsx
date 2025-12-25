import React from 'react'
import { useAuth } from '../AuthContext'

export default function Header({ title, user }) {
    const { logout } = useAuth()

    return (
        <header className="h-24 px-8 flex items-center justify-between bg-transparent relative z-30">
            {/* Ambient Breadcrumb */}
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-white capitalize tracking-tight drop-shadow-lg">
                    {title}
                </h1>
                <div className="h-1 w-20 bg-gradient-to-r from-fuchsia-500/50 to-transparent rounded-full blur-[1px]"></div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-6">
                {/* Search Bar (Visual Only) */}
                <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-white/5 text-slate-400 focus-within:bg-slate-800 focus-within:text-white focus-within:border-fuchsia-500/30 transition-all">
                    <span>🔍</span>
                    <input
                        type="text"
                        placeholder="Search jobs, guests..."
                        className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-slate-600"
                    />
                </div>

                {/* Notifications */}
                <button className="relative p-2 rounded-full hover:bg-white/5 transition-colors group">
                    <span className="text-xl">🔔</span>
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border border-slate-900"></span>
                    <div className="absolute top-full right-0 mt-2 w-64 p-4 rounded-xl bg-slate-900 border border-white/10 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                        <div className="text-xs font-bold text-slate-400 mb-2">NOTIFICATIONS</div>
                        <div className="text-sm text-slate-300">WhatsApp Batch #204 completed</div>
                    </div>
                </button>

                {/* Profile Pill */}
                <div className="flex items-center gap-3 pl-4 border-l border-white/5">
                    <div className="text-right hidden sm:block">
                        <div className="text-white font-medium text-sm leading-tight">{user?.name}</div>
                        <div className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wider">{user?.role}</div>
                    </div>

                    <div className="relative group">
                        <button className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 p-[1px]">
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm hover:bg-slate-800 transition-colors">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                        </button>

                        {/* Dropdown */}
                        <div className="absolute right-0 top-full mt-2 w-48 py-2 rounded-xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50">
                            <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors">Settings</button>
                            <button className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors">Support</button>
                            <div className="h-px bg-white/5 my-1"></div>
                            <button onClick={logout} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors">Sign Out</button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}

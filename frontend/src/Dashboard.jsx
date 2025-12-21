import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import Customers from './Customers'
import Analytics from './Analytics'
import Reports from './Reports'
import Tasks from './Tasks'

const API_BASE = '/api'

// Sidebar Navigation Items
const getNavItems = (role) => {
    const items = [
        { icon: '📊', label: 'Dashboard', path: '/dashboard', roles: ['sudo_admin'] },
        { icon: '🎨', label: 'Personalize', path: '/personalize', roles: ['sudo_admin', 'admin'] },
        { icon: '👥', label: 'Customers', path: '/customers', roles: ['sudo_admin', 'admin', 'designer'] },
        { icon: '📈', label: 'Analytics', path: '/analytics', roles: ['sudo_admin'] },
        { icon: '📄', label: 'Reports', path: '/reports', roles: ['sudo_admin', 'admin'] },
        { icon: '✅', label: 'Tasks', path: '/tasks', roles: ['sudo_admin', 'admin', 'designer'] },
        { icon: '👤', label: 'Users', path: '/users', roles: ['sudo_admin'] },
        { icon: '⚙️', label: 'Settings', path: '/settings', roles: ['sudo_admin'] },
    ]
    return items.filter(item => item.roles.includes(role))
}

// KPI Card Component
function KPICard({ icon, label, value, change, color = 'primary' }) {
    const colors = {
        primary: 'from-indigo-500 to-purple-500',
        success: 'from-green-500 to-emerald-500',
        warning: 'from-amber-500 to-orange-500',
        danger: 'from-red-500 to-pink-500',
    }

    return (
        <div className="bg-dark-800 rounded-xl p-6 border border-white/10 hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{icon}</span>
                <span className={`text-sm px-2 py-1 rounded-full ${change >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {change >= 0 ? '+' : ''}{change}%
                </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
        </div>
    )
}

// Main Dashboard Component
export default function Dashboard() {
    const { user, logout, isSudoAdmin } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [stats, setStats] = useState({
        totalCustomers: 0,
        cardsSent: 0,
        pendingTasks: 0,
        successRate: 0
    })
    const [sidebarOpen, setSidebarOpen] = useState(true)

    // Fetch dashboard stats
    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            // Mock data for now
            setStats({
                totalCustomers: 248,
                cardsSent: 1547,
                pendingTasks: 12,
                successRate: 94.5
            })
        } catch (err) {
            console.error('Failed to fetch stats:', err)
        }
    }

    const navItems = getNavItems(user?.role || 'admin')

    return (
        <div className="min-h-screen bg-dark-900 flex">
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-dark-800 border-r border-white/10 transition-all duration-300 flex flex-col`}>
                {/* Logo */}
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🎊</span>
                        {sidebarOpen && <span className="text-xl font-bold text-white">Invitewala</span>}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${location.pathname === item.path
                                ? 'bg-primary/20 text-primary'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <span className="text-xl">{item.icon}</span>
                            {sidebarOpen && <span>{item.label}</span>}
                        </button>
                    ))}
                </nav>

                {/* Toggle */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-4 border-t border-white/10 text-gray-400 hover:text-white"
                >
                    {sidebarOpen ? '◀' : '▶'}
                </button>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="h-16 bg-dark-800 border-b border-white/10 flex items-center justify-between px-6">
                    <div>
                        <h1 className="text-xl font-semibold text-white">
                            {navItems.find(n => n.path === location.pathname)?.label || 'Dashboard'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">
                            👤 {user?.name}
                            <span className="ml-2 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs">
                                {user?.role}
                            </span>
                        </span>
                        <button
                            onClick={logout}
                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 p-6 overflow-auto">
                    {/* Route-based content */}
                    {location.pathname === '/customers' ? (
                        <Customers />
                    ) : location.pathname === '/analytics' ? (
                        <Analytics />
                    ) : location.pathname === '/reports' ? (
                        <Reports />
                    ) : location.pathname === '/tasks' ? (
                        <Tasks />
                    ) : (
                        <>
                            {/* KPI Cards */}
                            {isSudoAdmin && location.pathname === '/dashboard' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                    <KPICard
                                        icon="👥"
                                        label="Total Customers"
                                        value={stats.totalCustomers.toLocaleString()}
                                        change={12}
                                        color="primary"
                                    />
                                    <KPICard
                                        icon="📨"
                                        label="Cards Sent"
                                        value={stats.cardsSent.toLocaleString()}
                                        change={8}
                                        color="success"
                                    />
                                    <KPICard
                                        icon="📋"
                                        label="Pending Tasks"
                                        value={stats.pendingTasks}
                                        change={-5}
                                        color="warning"
                                    />
                                    <KPICard
                                        icon="✅"
                                        label="Success Rate"
                                        value={`${stats.successRate}%`}
                                        change={2}
                                        color="success"
                                    />
                                </div>
                            )}

                            {/* Placeholder for other content */}
                            <div className="bg-dark-800 rounded-xl p-6 border border-white/10">
                                <h2 className="text-lg font-semibold text-white mb-4">
                                    Welcome to Invitewala Platform
                                </h2>
                                <p className="text-gray-400">
                                    {isSudoAdmin
                                        ? 'You have full admin access. Use the sidebar to navigate.'
                                        : 'Select an option from the sidebar to get started.'}
                                </p>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}

import React, { createContext, useState, useContext, useEffect } from 'react'

const API_BASE = '/api'

// Create Auth Context
const AuthContext = createContext(null)

// Auth Provider Component
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('token'))
    const [loading, setLoading] = useState(true)

    // Check token validity on mount
    useEffect(() => {
        if (token) {
            fetchUser()
        } else {
            setLoading(false)
        }
    }, [])

    const fetchUser = async () => {
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setUser(data)
            } else {
                // Token invalid, clear it
                logout()
            }
        } catch (err) {
            console.error('Auth check failed:', err)
            logout()
        } finally {
            setLoading(false)
        }
    }

    const login = async (email, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.detail || 'Login failed')
        }

        const data = await res.json()
        localStorage.setItem('token', data.access_token)
        setToken(data.access_token)
        setUser(data.user)
        return data.user
    }

    const logout = () => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
    }

    // Role check helpers
    const isSudoAdmin = user?.role === 'sudo_admin'
    const isAdmin = user?.role === 'admin' || user?.role === 'sudo_admin'
    const isDesigner = user?.role === 'designer'

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            login,
            logout,
            isSudoAdmin,
            isAdmin,
            isDesigner
        }}>
            {children}
        </AuthContext.Provider>
    )
}

// Hook to use auth context
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

// Protected Route Component
export function ProtectedRoute({ children, requiredRole = null }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'var(--bg-dark)',
                color: 'var(--text-primary)'
            }}>
                <div>Loading...</div>
            </div>
        )
    }

    if (!user) {
        // Redirect to login
        window.location.href = '/login'
        return null
    }

    // Role check
    if (requiredRole) {
        const roleHierarchy = { 'sudo_admin': 3, 'admin': 2, 'designer': 1 }
        const userLevel = roleHierarchy[user.role] || 0
        const requiredLevel = roleHierarchy[requiredRole] || 0

        if (userLevel < requiredLevel) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    background: 'var(--bg-dark)',
                    color: 'var(--text-primary)'
                }}>
                    <h1>🚫 Access Denied</h1>
                    <p>You don't have permission to access this page.</p>
                    <p>Required: {requiredRole}, Your role: {user.role}</p>
                </div>
            )
        }
    }

    return children
}

export default AuthContext

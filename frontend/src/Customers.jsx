import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const API_BASE = '/api'

export default function Customers() {
    const { token, isAdmin } = useAuth()
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [showModal, setShowModal] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', phone: '', email: '', city: '', wedding_date: '', notes: ''
    })

    useEffect(() => {
        fetchCustomers()
    }, [page, search])

    const fetchCustomers = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({ page, limit: 20 })
            if (search) params.append('search', search)

            const res = await fetch(`${API_BASE}/customers?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!res.ok) throw new Error('Failed to fetch customers')

            const data = await res.json()
            setCustomers(data.customers)
            setTotalPages(data.pages)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const url = editingCustomer
                ? `${API_BASE}/customers/${editingCustomer.id}`
                : `${API_BASE}/customers`

            const res = await fetch(url, {
                method: editingCustomer ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            })

            if (!res.ok) throw new Error('Failed to save customer')

            setShowModal(false)
            setEditingCustomer(null)
            setFormData({ first_name: '', last_name: '', phone: '', email: '', city: '', wedding_date: '', notes: '' })
            fetchCustomers()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this customer?')) return

        try {
            const res = await fetch(`${API_BASE}/customers/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!res.ok) throw new Error('Failed to delete customer')
            fetchCustomers()
        } catch (err) {
            setError(err.message)
        }
    }

    const openEdit = (customer) => {
        setEditingCustomer(customer)
        setFormData({
            first_name: customer.first_name || '',
            last_name: customer.last_name || '',
            phone: customer.phone || '',
            email: customer.email || '',
            city: customer.city || '',
            wedding_date: customer.wedding_date || '',
            notes: customer.notes || ''
        })
        setShowModal(true)
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Customers</h1>
                {isAdmin && (
                    <button
                        onClick={() => { setEditingCustomer(null); setFormData({ first_name: '', last_name: '', phone: '', email: '', city: '', wedding_date: '', notes: '' }); setShowModal(true) }}
                        className="px-4 py-2 bg-primary rounded-lg text-white hover:bg-primary/80"
                    >
                        + Add Customer
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by name, phone, or email..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    className="w-full max-w-md px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-primary focus:outline-none"
                />
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-dark-800 rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-dark-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Phone</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Email</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">City</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Wedding Date</th>
                            {isAdmin && <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td>
                            </tr>
                        ) : customers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No customers found</td>
                            </tr>
                        ) : (
                            customers.map((customer) => (
                                <tr key={customer.id} className="border-t border-white/5 hover:bg-white/5">
                                    <td className="px-4 py-3 text-white">
                                        {customer.first_name} {customer.last_name}
                                    </td>
                                    <td className="px-4 py-3 text-gray-400">{customer.phone || '-'}</td>
                                    <td className="px-4 py-3 text-gray-400">{customer.email || '-'}</td>
                                    <td className="px-4 py-3 text-gray-400">{customer.city || '-'}</td>
                                    <td className="px-4 py-3 text-gray-400">{customer.wedding_date || '-'}</td>
                                    {isAdmin && (
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <button
                                                onClick={() => openEdit(customer)}
                                                className="px-3 py-1 text-sm bg-primary/20 text-primary rounded hover:bg-primary/30"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(customer.id)}
                                                className="px-3 py-1 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-gray-400">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-white/10">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingCustomer ? 'Edit Customer' : 'Add Customer'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="First Name *"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    required
                                    className="px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                                />
                                <input
                                    type="text"
                                    placeholder="Last Name"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    className="px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                                />
                            </div>
                            <input
                                type="tel"
                                placeholder="Phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            />
                            <input
                                type="text"
                                placeholder="City"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            />
                            <input
                                type="date"
                                placeholder="Wedding Date"
                                value={formData.wedding_date}
                                onChange={(e) => setFormData({ ...formData, wedding_date: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            />
                            <textarea
                                placeholder="Notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            />
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white hover:bg-dark-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-primary rounded-lg text-white hover:bg-primary/80"
                                >
                                    {editingCustomer ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

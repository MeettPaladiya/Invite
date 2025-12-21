import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const API_BASE = '/api'

const statusColors = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30'
}

const priorityBadge = {
    low: 'bg-gray-500/20 text-gray-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400'
}

export default function Tasks() {
    const { token, isAdmin } = useAuth()
    const [tasks, setTasks] = useState({ pending: [], in_progress: [], completed: [] })
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'pending',
        priority: 'medium',
        due_date: ''
    })

    useEffect(() => {
        fetchTasks()
    }, [])

    const fetchTasks = async () => {
        try {
            setLoading(true)
            const res = await fetch(`${API_BASE}/tasks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setTasks(data.grouped)
            }
        } catch (err) {
            console.error('Failed to fetch tasks:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateTask = async (e) => {
        e.preventDefault()
        try {
            const res = await fetch(`${API_BASE}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                setShowModal(false)
                setFormData({ title: '', description: '', status: 'pending', priority: 'medium', due_date: '' })
                fetchTasks()
            }
        } catch (err) {
            console.error('Failed to create task:', err)
        }
    }

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            await fetch(`${API_BASE}/tasks/${taskId}/status?status=${newStatus}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            fetchTasks()
        } catch (err) {
            console.error('Failed to update status:', err)
        }
    }

    const handleDelete = async (taskId) => {
        if (!confirm('Delete this task?')) return
        try {
            await fetch(`${API_BASE}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            fetchTasks()
        } catch (err) {
            console.error('Failed to delete task:', err)
        }
    }

    const TaskCard = ({ task }) => (
        <div className="bg-dark-700 rounded-lg p-4 border border-white/5 space-y-2">
            <div className="flex justify-between items-start">
                <h4 className="text-white font-medium">{task.title}</h4>
                <span className={`text-xs px-2 py-1 rounded ${priorityBadge[task.priority]}`}>
                    {task.priority}
                </span>
            </div>
            {task.description && (
                <p className="text-sm text-gray-400">{task.description}</p>
            )}
            {task.due_date && (
                <p className="text-xs text-gray-500">📅 Due: {task.due_date}</p>
            )}
            {task.customer_name && (
                <p className="text-xs text-gray-500">👤 {task.customer_name}</p>
            )}
            <div className="flex gap-2 pt-2">
                {task.status !== 'pending' && (
                    <button
                        onClick={() => handleStatusChange(task.id, 'pending')}
                        className="text-xs px-2 py-1 bg-amber-500/10 text-amber-400 rounded"
                    >
                        ← Pending
                    </button>
                )}
                {task.status !== 'in_progress' && (
                    <button
                        onClick={() => handleStatusChange(task.id, 'in_progress')}
                        className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded"
                    >
                        🔄 In Progress
                    </button>
                )}
                {task.status !== 'completed' && (
                    <button
                        onClick={() => handleStatusChange(task.id, 'completed')}
                        className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded"
                    >
                        ✓ Done
                    </button>
                )}
                {isAdmin && (
                    <button
                        onClick={() => handleDelete(task.id)}
                        className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded ml-auto"
                    >
                        🗑
                    </button>
                )}
            </div>
        </div>
    )

    const KanbanColumn = ({ title, tasks, status }) => (
        <div className="flex-1 min-w-[280px]">
            <div className={`rounded-lg p-2 mb-4 border ${statusColors[status]}`}>
                <h3 className="font-semibold text-center">{title} ({tasks.length})</h3>
            </div>
            <div className="space-y-3">
                {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                ))}
                {tasks.length === 0 && (
                    <div className="text-center text-gray-500 py-8">No tasks</div>
                )}
            </div>
        </div>
    )

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Task Management</h1>
                {isAdmin && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-primary rounded-lg text-white hover:bg-primary/80"
                    >
                        + New Task
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading tasks...</div>
            ) : (
                <div className="flex gap-6 overflow-x-auto pb-4">
                    <KanbanColumn title="📋 Pending" tasks={tasks.pending || []} status="pending" />
                    <KanbanColumn title="🔄 In Progress" tasks={tasks.in_progress || []} status="in_progress" />
                    <KanbanColumn title="✅ Completed" tasks={tasks.completed || []} status="completed" />
                </div>
            )}

            {/* Create Task Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-white/10">
                        <h2 className="text-xl font-bold text-white mb-4">Create Task</h2>
                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <input
                                type="text"
                                placeholder="Task title *"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            />
                            <textarea
                                placeholder="Description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            />
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            >
                                <option value="low">Low Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="high">High Priority</option>
                            </select>
                            <input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white"
                            />
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-dark-700 rounded-lg text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-primary rounded-lg text-white"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

"""
Task management endpoints for Invitewala Platform.
Kanban-style task tracking.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

from .auth import get_current_user, require_admin
from .database import get_cursor

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    status: str = "pending"
    priority: str = "medium"
    due_date: Optional[date] = None
    related_customer_id: Optional[int] = None


class TaskUpdate(TaskCreate):
    pass


@router.get("")
async def list_tasks(
    status: Optional[str] = None,
    assigned_to: Optional[int] = None,
    user: dict = Depends(get_current_user)
):
    """List all tasks, optionally filtered."""
    with get_cursor() as cursor:
        query = """
            SELECT t.*, 
                   u.name as assigned_to_name,
                   c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN customers c ON t.related_customer_id = c.id
            WHERE 1=1
        """
        params = []
        
        if status:
            query += " AND t.status = ?"
            params.append(status)
        
        if assigned_to:
            query += " AND t.assigned_to = ?"
            params.append(assigned_to)
        
        query += " ORDER BY t.created_at DESC"
        cursor.execute(query, params)
        tasks = [dict(row) for row in cursor.fetchall()]
        
        # Group by status for Kanban view
        grouped = {
            "pending": [t for t in tasks if t['status'] == 'pending'],
            "in_progress": [t for t in tasks if t['status'] == 'in_progress'],
            "completed": [t for t in tasks if t['status'] == 'completed']
        }
        
        return {"tasks": tasks, "grouped": grouped}


@router.get("/{task_id}")
async def get_task(task_id: int, user: dict = Depends(get_current_user)):
    """Get a single task."""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT t.*, u.name as assigned_to_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.id = ?
        """, (task_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return dict(row)


@router.post("")
async def create_task(data: TaskCreate, user: dict = Depends(require_admin)):
    """Create a new task."""
    with get_cursor() as cursor:
        cursor.execute(
            """INSERT INTO tasks 
               (title, description, assigned_to, status, priority, due_date, related_customer_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (data.title, data.description, data.assigned_to, data.status,
             data.priority, data.due_date, data.related_customer_id)
        )
        task_id = cursor.lastrowid
        return {"id": task_id, "message": "Task created"}


@router.put("/{task_id}")
async def update_task(task_id: int, data: TaskUpdate, user: dict = Depends(get_current_user)):
    """Update a task."""
    with get_cursor() as cursor:
        cursor.execute("SELECT id FROM tasks WHERE id = ?", (task_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Task not found")
        
        cursor.execute(
            """UPDATE tasks SET 
               title=?, description=?, assigned_to=?, status=?, priority=?, due_date=?, related_customer_id=?
               WHERE id=?""",
            (data.title, data.description, data.assigned_to, data.status,
             data.priority, data.due_date, data.related_customer_id, task_id)
        )
        return {"message": "Task updated"}


@router.patch("/{task_id}/status")
async def update_task_status(task_id: int, status: str, user: dict = Depends(get_current_user)):
    """Quick update just the task status (for drag-and-drop)."""
    if status not in ('pending', 'in_progress', 'completed'):
        raise HTTPException(status_code=400, detail="Invalid status")
    
    with get_cursor() as cursor:
        cursor.execute("UPDATE tasks SET status = ? WHERE id = ?", (status, task_id))
        return {"message": "Status updated"}


@router.delete("/{task_id}")
async def delete_task(task_id: int, user: dict = Depends(require_admin)):
    """Delete a task."""
    with get_cursor() as cursor:
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return {"deleted": True}

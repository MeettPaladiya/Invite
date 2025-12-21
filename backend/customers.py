"""
Customer management endpoints for Invitewala Platform.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import csv
import io

from .auth import require_admin, require_sudo, get_current_user
from .database import get_cursor

router = APIRouter(prefix="/api/customers", tags=["Customers"])


# ============ Pydantic Models ============

class CustomerCreate(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    wedding_date: Optional[date] = None
    notes: Optional[str] = None


class CustomerUpdate(CustomerCreate):
    pass


class CustomerResponse(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    city: Optional[str]
    wedding_date: Optional[date]
    designer_id: Optional[int]
    notes: Optional[str]
    created_at: str


# ============ Endpoints ============

@router.get("")
async def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    city: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """List all customers with pagination and filtering."""
    offset = (page - 1) * limit
    
    with get_cursor() as cursor:
        # Build query
        query = "SELECT * FROM customers WHERE 1=1"
        params = []
        
        if search:
            query += " AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)"
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term, search_term])
        
        if city:
            query += " AND city = ?"
            params.append(city)
        
        # Count total
        count_query = query.replace("SELECT *", "SELECT COUNT(*)")
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]
        
        # Get page
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        cursor.execute(query, params)
        
        customers = [dict(row) for row in cursor.fetchall()]
        
        return {
            "customers": customers,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }


@router.get("/{customer_id}")
async def get_customer(customer_id: int, user: dict = Depends(get_current_user)):
    """Get a single customer by ID."""
    with get_cursor() as cursor:
        cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return dict(row)


@router.post("", response_model=CustomerResponse)
async def create_customer(data: CustomerCreate, user: dict = Depends(require_admin)):
    """Create a new customer."""
    with get_cursor() as cursor:
        cursor.execute(
            """INSERT INTO customers 
               (first_name, last_name, phone, email, city, wedding_date, notes, designer_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.first_name, data.last_name, data.phone, data.email, 
             data.city, data.wedding_date, data.notes, user["id"])
        )
        customer_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        return dict(cursor.fetchone())


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: int, data: CustomerUpdate, user: dict = Depends(require_admin)):
    """Update a customer."""
    with get_cursor() as cursor:
        cursor.execute("SELECT id FROM customers WHERE id = ?", (customer_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Customer not found")
        
        cursor.execute(
            """UPDATE customers SET 
               first_name=?, last_name=?, phone=?, email=?, city=?, wedding_date=?, notes=?
               WHERE id=?""",
            (data.first_name, data.last_name, data.phone, data.email,
             data.city, data.wedding_date, data.notes, customer_id)
        )
        
        cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        return dict(cursor.fetchone())


@router.delete("/{customer_id}")
async def delete_customer(customer_id: int, user: dict = Depends(require_admin)):
    """Delete a customer."""
    with get_cursor() as cursor:
        cursor.execute("SELECT id FROM customers WHERE id = ?", (customer_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Customer not found")
        
        cursor.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
        return {"deleted": True}


@router.post("/import-csv")
async def import_customers_csv(user: dict = Depends(require_admin)):
    """
    Import customers from CSV.
    Expects CSV body with columns: first_name, last_name, phone, email, city, wedding_date, notes
    """
    # This is a placeholder - actual CSV upload would use UploadFile
    return {"message": "CSV import endpoint ready", "expected_columns": [
        "first_name", "last_name", "phone", "email", "city", "wedding_date", "notes"
    ]}


@router.get("/stats/summary")
async def get_customer_stats(user: dict = Depends(require_sudo)):
    """Get customer statistics for dashboard."""
    with get_cursor() as cursor:
        # Total customers
        cursor.execute("SELECT COUNT(*) FROM customers")
        total = cursor.fetchone()[0]
        
        # By city
        cursor.execute("SELECT city, COUNT(*) as count FROM customers WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC LIMIT 5")
        by_city = [dict(row) for row in cursor.fetchall()]
        
        # Recent (last 30 days)
        cursor.execute("SELECT COUNT(*) FROM customers WHERE created_at >= datetime('now', '-30 days')")
        recent = cursor.fetchone()[0]
        
        return {
            "total": total,
            "recent": recent,
            "by_city": by_city
        }

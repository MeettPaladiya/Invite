"""
Authentication module for Invitewala Platform.
Handles JWT token generation/verification and auth endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import jwt
from datetime import datetime, timedelta
import os

from .database import verify_user, get_user_by_id, create_user, list_users

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "invitewala-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()


# ============ Pydantic Models ============

class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "admin"


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str


# ============ JWT Helpers ============

def create_access_token(user_id: int, role: str) -> str:
    """Create a JWT access token."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============ Dependencies ============

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user."""
    payload = decode_access_token(credentials.credentials)
    user_id = int(payload.get("sub"))
    user = get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Remove password hash from response
    user.pop("password_hash", None)
    return user


async def require_admin(user: dict = Depends(get_current_user)):
    """Dependency to require admin or sudo_admin role."""
    if user["role"] not in ("admin", "sudo_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_sudo(user: dict = Depends(get_current_user)):
    """Dependency to require sudo_admin role."""
    if user["role"] != "sudo_admin":
        raise HTTPException(status_code=403, detail="Sudo admin access required")
    return user


# ============ Endpoints ============

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Login endpoint. Returns JWT token on success.
    """
    user = verify_user(request.email, request.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create token
    access_token = create_access_token(user["id"], user["role"])
    
    # Remove password hash from response
    user.pop("password_hash", None)
    
    return LoginResponse(
        access_token=access_token,
        user=user
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """
    Get current authenticated user.
    """
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        role=user["role"]
    )


@router.post("/users", response_model=UserResponse)
async def create_new_user(request: UserCreate, admin: dict = Depends(require_sudo)):
    """
    Create a new user (sudo_admin only).
    """
    try:
        user_id = create_user(
            email=request.email,
            password=request.password,
            name=request.name,
            role=request.role
        )
        return UserResponse(
            id=user_id,
            email=request.email,
            name=request.name,
            role=request.role
        )
    except Exception as e:
        if "UNIQUE constraint" in str(e):
            raise HTTPException(status_code=400, detail="Email already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def get_all_users(admin: dict = Depends(require_sudo)):
    """
    List all users (sudo_admin only).
    """
    return {"users": list_users()}

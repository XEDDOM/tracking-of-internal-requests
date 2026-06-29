from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List
from models import TicketStatus, TicketPriority


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    priority: TicketPriority = TicketPriority.normal


class TicketUpdateStatus(BaseModel):
    status: TicketStatus


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    status: TicketStatus
    priority: TicketPriority
    created_at: datetime
    updated_at: datetime


class TicketList(BaseModel):
    items: List[TicketOut]
    total: int
    page: int
    page_size: int


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class ErrorResponse(BaseModel):
    detail: str

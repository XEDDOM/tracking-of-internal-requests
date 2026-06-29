from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_user,
    require_admin,
)
from database import engine, get_db, Base
from models import Ticket, User, TicketStatus, TicketPriority
from schemas import (
    TicketCreate,
    TicketUpdateStatus,
    TicketOut,
    TicketList,
    LoginRequest,
    Token,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Ticket Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def seed_admin():
    db = next(get_db())
    try:
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                password_hash=hash_password("admin"),
                is_admin=1,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


@app.post("/api/auth/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )
    token = create_access_token({"sub": user.username, "admin": bool(user.is_admin)})
    return Token(access_token=token)


@app.get("/api/auth/me")
def me(user: Optional[User] = Depends(get_current_user)):
    if user is None:
        return {"authenticated": False, "username": None, "is_admin": False}
    return {
        "authenticated": True,
        "username": user.username,
        "is_admin": bool(user.is_admin),
    }


PRIORITY_ORDER = {
    TicketPriority.low: 0,
    TicketPriority.normal: 1,
    TicketPriority.high: 2,
}


@app.post("/api/tickets", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    ticket = Ticket(
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        priority=payload.priority,
        status=TicketStatus.new,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@app.get("/api/tickets", response_model=TicketList)
def list_tickets(
    status_filter: Optional[TicketStatus] = Query(None, alias="status"),
    priority: Optional[TicketPriority] = Query(None),
    search: Optional[str] = Query(None, max_length=200),
    sort_by: str = Query("created_at", pattern="^(created_at|priority)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Ticket)

    if status_filter is not None:
        q = q.filter(Ticket.status == status_filter)
    if priority is not None:
        q = q.filter(Ticket.priority == priority)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(Ticket.title.ilike(term), Ticket.description.ilike(term)))

    total = q.count()

    if sort_by == "priority":
        order_col = Ticket.priority
        if sort_dir == "asc":
            q = q.order_by(Ticket.priority.asc())
        else:
            q = q.order_by(Ticket.priority.desc())
    else:
        order_col = Ticket.created_at
        q = q.order_by(order_col.asc() if sort_dir == "asc" else order_col.desc())

    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return TicketList(items=items, total=total, page=page, page_size=page_size)


@app.patch("/api/tickets/{ticket_id}/status", response_model=TicketOut)
def update_ticket_status(
    ticket_id: int,
    payload: TicketUpdateStatus,
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if ticket.status == TicketStatus.done:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Заявку в статусе 'done' нельзя редактировать",
        )

    if payload.status == TicketStatus.done and ticket.status == TicketStatus.done:
        pass

    ticket.status = payload.status
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    return ticket


@app.delete("/api/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if ticket.status == TicketStatus.done:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Заявку в статусе 'done' нельзя удалять",
        )
    db.delete(ticket)
    db.commit()
    return None

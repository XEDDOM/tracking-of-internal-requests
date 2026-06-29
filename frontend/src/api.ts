import type { Ticket, TicketListResponse, MeResponse, Filters, TicketStatus } from "./types";

const API_BASE = "/api";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as unknown as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.detail as string)) || `Ошибка ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  async me(): Promise<MeResponse> {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    return handle<MeResponse>(res);
  },

  async login(username: string, password: string): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await handle<{ access_token: string }>(res);
    return data.access_token;
  },

  async listTickets(f: Filters): Promise<TicketListResponse> {
    const params = new URLSearchParams();
    if (f.status) params.set("status", f.status);
    if (f.priority) params.set("priority", f.priority);
    if (f.search && f.search.trim()) params.set("search", f.search.trim());
    params.set("sort_by", f.sort_by);
    params.set("sort_dir", f.sort_dir);
    params.set("page", String(f.page));
    params.set("page_size", String(f.page_size));
    const res = await fetch(`${API_BASE}/tickets?${params.toString()}`, {
      headers: authHeaders(),
    });
    return handle<TicketListResponse>(res);
  },

  async createTicket(title: string, description: string, priority: string): Promise<Ticket> {
    const res = await fetch(`${API_BASE}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title, description: description || null, priority }),
    });
    return handle<Ticket>(res);
  },

  async updateStatus(id: number, status: TicketStatus): Promise<Ticket> {
    const res = await fetch(`${API_BASE}/tickets/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    return handle<Ticket>(res);
  },

  async deleteTicket(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/tickets/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    await handle<void>(res);
  },
};

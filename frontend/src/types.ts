export type TicketStatus = "new" | "in_progress" | "done";
export type TicketPriority = "low" | "normal" | "high";

export interface Ticket {
  id: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
}

export interface Filters {
  status?: TicketStatus | "";
  priority?: TicketPriority | "";
  search?: string;
  sort_by: "created_at" | "priority";
  sort_dir: "asc" | "desc";
  page: number;
  page_size: number;
}

export interface MeResponse {
  authenticated: boolean;
  username: string | null;
  is_admin: boolean;
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
};

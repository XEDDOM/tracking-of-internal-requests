import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "./api";
import type {
  Ticket,
  TicketListResponse,
  Filters,
  TicketStatus,
  TicketPriority,
  MeResponse,
} from "./types";
import { STATUS_LABEL, PRIORITY_LABEL } from "./types";

const ALL_STATUSES: TicketStatus[] = ["new", "in_progress", "done"];
const ALL_PRIORITIES: TicketPriority[] = ["low", "normal", "high"];
const NEXT_STATUS: Record<TicketStatus, TicketStatus | null> = {
  new: "in_progress",
  in_progress: "done",
  done: null,
};

const INITIAL_FILTERS: Filters = {
  status: "",
  priority: "",
  search: "",
  sort_by: "created_at",
  sort_dir: "desc",
  page: 1,
  page_size: 10,
};

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [data, setData] = useState<TicketListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.listTickets(filters);
      setData(d);
    } catch (e: any) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe({ authenticated: false, username: null, is_admin: false }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.page_size));
  }, [data]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (title.trim().length < 3) {
      setFormError("Заголовок должен быть от 3 символов");
      return;
    }
    setCreating(true);
    try {
      await api.createTicket(title.trim(), description, priority);
      setTitle("");
      setDescription("");
      setPriority("normal");
      setFilters((f) => ({ ...f, page: 1 }));
    } catch (e: any) {
      setFormError(e.message || "Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (t: Ticket, next: TicketStatus) => {
    try {
      await api.updateStatus(t.id, next);
      await load();
    } catch (e: any) {
      alert(e.message || "Ошибка изменения статуса");
    }
  };

  const handleDelete = async (t: Ticket) => {
    if (!confirm(`Удалить заявку «${t.title}»?`)) return;
    try {
      await api.deleteTicket(t.id);
      await load();
    } catch (e: any) {
      alert(e.message || "Ошибка удаления");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const token = await api.login(loginUser, loginPass);
      localStorage.setItem("token", token);
      const m = await api.me();
      setMe(m);
      setLoginOpen(false);
      setLoginUser("");
      setLoginPass("");
    } catch (e: any) {
      setLoginError(e.message || "Ошибка входа");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setMe({ authenticated: false, username: null, is_admin: false });
  };

  const toggleSort = (by: "created_at" | "priority") => {
    setFilters((f) => ({
      ...f,
      sort_by: by,
      sort_dir: f.sort_by === by && f.sort_dir === "desc" ? "asc" : "desc",
      page: 1,
    }));
  };

  const isAdmin = !!me?.is_admin;
  const searchValue = filters.search ?? "";

  return (
    <div className="app">
      <header className="header">
        <h1>Учёт заявок</h1>
        <div className="auth">
          {me?.authenticated ? (
            <>
              <span>
                {me.username} {isAdmin && <span className="badge admin">admin</span>}
              </span>
              <button className="btn primary" onClick={handleLogout}>Выйти</button>
            </>
          ) : (
            <button className="btn primary" onClick={() => setLoginOpen(true)}>Войти как админ</button>
          )}
        </div>
      </header>

      <section className="card">
        <h2>Новая заявка</h2>
        <form className="create-form" onSubmit={handleCreate}>
          <input
            className="input"
            placeholder="Заголовок (3–120 символов)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
          />
          <textarea
            className="input"
            placeholder="Описание (необязательно, до 1000 символов)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={2}
          />
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
          >
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                Приоритет: {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <button className="btn primary" type="submit" disabled={creating}>
            {creating ? "Создание…" : "Создать"}
          </button>
        </form>
        {formError && <div className="error">{formError}</div>}
      </section>

      <section className="card">
        <div className="toolbar">
          <input
            className="input search"
            placeholder="Поиск по заголовку и описанию"
            value={searchValue}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))
            }
          />
          <select
            className="input"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value as any, page: 1 }))
            }
          >
            <option value="">Все статусы</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={filters.priority}
            onChange={(e) =>
              setFilters((f) => ({ ...f, priority: e.target.value as any, page: 1 }))
            }
          >
            <option value="">Все приоритеты</option>
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={filters.page_size}
            onChange={(e) =>
              setFilters((f) => ({ ...f, page_size: Number(e.target.value), page: 1 }))
            }
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                По {n}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="error">{error}</div>}

        {loading && <div className="muted">Загрузка…</div>}

        {!loading && data && data.items.length === 0 && (
          <div className="empty">Заявок не найдено</div>
        )}

        {!loading && data && data.items.length > 0 && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th className="col-id">ID</th>
                  <th>Заголовок</th>
                  <th
                    className="sortable"
                    onClick={() => toggleSort("priority")}
                    title="Сортировать по приоритету"
                  >
                    Приоритет {sortIcon(filters, "priority")}
                  </th>
                  <th>Статус</th>
                  <th
                    className="sortable"
                    onClick={() => toggleSort("created_at")}
                    title="Сортировать по дате"
                  >
                    Создано {sortIcon(filters, "created_at")}
                  </th>
                  <th className="col-actions">Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => {
                  const next = NEXT_STATUS[t.status];
                  return (
                    <tr key={t.id} className={`priority-${t.priority}`}>
                      <td className="col-id">{t.id}</td>
                      <td>
                        <div className="title">{t.title}</div>
                        {t.description && <div className="desc">{t.description}</div>}
                      </td>
                      <td>
                        <span className={`chip priority-${t.priority}`}>
                          {PRIORITY_LABEL[t.priority]}
                        </span>
                      </td>
                      <td>
                        <span className={`chip status-${t.status}`}>
                          {STATUS_LABEL[t.status]}
                        </span>
                      </td>
                      <td className="muted">{new Date(t.created_at).toLocaleString("ru-RU")}</td>
                      <td className="col-actions">
                        {next && (
                          <button
                            className="btn small"
                            onClick={() => handleStatusChange(t, next)}
                          >
                            → {STATUS_LABEL[next]}
                          </button>
                        )}
                        {isAdmin && t.status !== "done" && (
                          <button
                            className="btn small danger"
                            onClick={() => handleDelete(t)}
                          >
                            Удалить
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="pagination">
              <button
                className="btn small"
                disabled={filters.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                ← Назад
              </button>
              <span className="muted">
                Стр. {filters.page} из {totalPages} · всего: {data.total}
              </span>
              <button
                className="btn small"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Вперёд →
              </button>
            </div>
          </>
        )}
      </section>

      {loginOpen && (
        <div className="modal" onClick={() => setLoginOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Вход администратора</h3>
            <form onSubmit={handleLogin}>
              <input
                className="input"
                placeholder="Логин"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                autoFocus
              />
              <input
                className="input"
                type="password"
                placeholder="Пароль"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
              />
              {loginError && <div className="error">{loginError}</div>}
              <div className="row">
                <button className="btn primary" type="submit">
                  Войти
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setLoginOpen(false)}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function sortIcon(filters: Filters, by: "created_at" | "priority") {
  if (filters.sort_by !== by) return "";
  return filters.sort_dir === "asc" ? "▲" : "▼";
}

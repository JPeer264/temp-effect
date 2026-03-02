import { Effect } from "effect"
import { useCallback, useEffect, useState } from "react"
import type { CreateTodoInput, Todo, UpdateTodoInput } from "./api.js"
import { ApiClient, runApiEffect } from "./api.js"

export function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTitle, setNewTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await runApiEffect(
        Effect.gen(function* () {
          const api = yield* ApiClient
          return yield* api.listTodos()
        })
      )
      setTodos(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch todos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      const input: CreateTodoInput = { title: newTitle.trim() }
      await runApiEffect(
        Effect.gen(function* () {
          const api = yield* ApiClient
          return yield* api.createTodo(input)
        })
      )
      setNewTitle("")
      fetchTodos()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create todo")
    }
  }

  const handleToggle = async (todo: Todo) => {
    try {
      const input: UpdateTodoInput = { completed: !todo.completed }
      await runApiEffect(
        Effect.gen(function* () {
          const api = yield* ApiClient
          return yield* api.updateTodo(todo.id, input)
        })
      )
      fetchTodos()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update todo")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await runApiEffect(
        Effect.gen(function* () {
          const api = yield* ApiClient
          return yield* api.deleteTodo(id)
        })
      )
      fetchTodos()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete todo")
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Effect.ts Todo App</h1>
        
        <form onSubmit={handleCreate} style={styles.form}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs to be done?"
            style={styles.input}
          />
          <button type="submit" style={styles.addButton}>
            Add
          </button>
        </form>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : (
          <ul style={styles.list}>
            {todos.length === 0 ? (
              <li style={styles.emptyState}>No todos yet. Add one above!</li>
            ) : (
              todos.map((todo) => (
                <li key={todo.id} style={styles.item}>
                  <label style={styles.label}>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggle(todo)}
                      style={styles.checkbox}
                    />
                    <span
                      style={{
                        ...styles.text,
                        textDecoration: todo.completed ? "line-through" : "none",
                        color: todo.completed ? "#9ca3af" : "#1f2937"
                      }}
                    >
                      {todo.title}
                    </span>
                  </label>
                  <button
                    onClick={() => handleDelete(todo.id)}
                    style={styles.deleteButton}
                  >
                    Delete
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        <div style={styles.footer}>
          <span>{todos.filter((t) => !t.completed).length} items left</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    padding: "32px",
    width: "100%",
    maxWidth: "500px"
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: "24px",
    textAlign: "center" as const
  },
  form: {
    display: "flex",
    gap: "12px",
    marginBottom: "24px"
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "16px",
    outline: "none",
    transition: "border-color 0.2s"
  },
  addButton: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s"
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px"
  },
  loading: {
    textAlign: "center" as const,
    color: "#6b7280",
    padding: "24px"
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0
  },
  emptyState: {
    textAlign: "center" as const,
    color: "#9ca3af",
    padding: "24px",
    fontStyle: "italic"
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px",
    borderBottom: "1px solid #e5e7eb"
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    flex: 1
  },
  checkbox: {
    width: "20px",
    height: "20px",
    cursor: "pointer"
  },
  text: {
    fontSize: "16px",
    transition: "all 0.2s"
  },
  deleteButton: {
    padding: "6px 12px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s"
  },
  footer: {
    marginTop: "16px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
    textAlign: "center" as const,
    color: "#6b7280",
    fontSize: "14px"
  }
}

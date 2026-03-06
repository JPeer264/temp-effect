import { Effect, Stream } from "effect"
import type { AppState, Todo } from "./api.js"
import { AppStore, runAppEffectFork } from "./api.js"

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    background-color: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .card {
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 32px;
    width: 100%;
    max-width: 500px;
  }
  .title {
    font-size: 28px;
    font-weight: bold;
    color: #1f2937;
    margin-bottom: 24px;
    text-align: center;
  }
  .form {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }
  .input {
    flex: 1;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s;
  }
  .input:focus { border-color: #3b82f6; }
  .add-button {
    padding: 12px 24px;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .add-button:hover { background-color: #2563eb; }
  .error {
    background-color: #fee2e2;
    color: #dc2626;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .loading {
    text-align: center;
    color: #6b7280;
    padding: 24px;
  }
  .list {
    list-style: none;
  }
  .empty-state {
    text-align: center;
    color: #9ca3af;
    padding: 24px;
    font-style: italic;
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  .label {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    flex: 1;
  }
  .checkbox {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
  .text {
    font-size: 16px;
    transition: all 0.2s;
  }
  .text.completed {
    text-decoration: line-through;
    color: #9ca3af;
  }
  .delete-button {
    padding: 6px 12px;
    background-color: #ef4444;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .delete-button:hover { background-color: #dc2626; }
  .footer {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
    color: #6b7280;
    font-size: 14px;
  }
`

const renderTodoItem = (todo: Todo): string => `
  <li class="item" data-id="${todo.id}">
    <label class="label">
      <input type="checkbox" class="checkbox" ${todo.completed ? "checked" : ""} data-action="toggle" data-id="${todo.id}">
      <span class="text ${todo.completed ? "completed" : ""}">${escapeHtml(todo.title)}</span>
    </label>
    <button class="delete-button" data-action="delete" data-id="${todo.id}">Delete</button>
  </li>
`

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const renderApp = (state: AppState): string => `
  <div class="card">
    <h1 class="title">Effect.ts Todo App</h1>
    
    <form class="form" id="todo-form">
      <input
        type="text"
        class="input"
        id="new-title"
        placeholder="What needs to be done?"
        value="${escapeHtml(state.newTitle)}"
      >
      <button type="submit" class="add-button">Add</button>
    </form>

    ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ""}

    ${
      state.loading
        ? '<div class="loading">Loading...</div>'
        : `
      <ul class="list">
        ${
          state.todos.length === 0
            ? '<li class="empty-state">No todos yet. Add one above!</li>'
            : state.todos.map(renderTodoItem).join("")
        }
      </ul>
    `
    }

    <div class="footer">
      <span>${state.todos.filter((t) => !t.completed).length} items left</span>
    </div>
  </div>
`

const setupEventHandlers = Effect.gen(function* () {
  const store = yield* AppStore

  yield* Effect.sync(() => {
    const root = document.getElementById("root")!

    root.addEventListener("submit", (e) => {
      if ((e.target as HTMLElement).id === "todo-form") {
        e.preventDefault()
        const input = document.getElementById("new-title") as HTMLInputElement
        runAppEffectFork(store.createTodo(input.value))
      }
    })

    root.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement
      if (target.id === "new-title") {
        runAppEffectFork(store.setNewTitle(target.value))
      }
    })

    root.addEventListener("click", (e) => {
      const target = e.target as HTMLElement
      const action = target.dataset.action
      const id = target.dataset.id

      if (action === "delete" && id) {
        runAppEffectFork(store.deleteTodo(id))
      }
    })

    root.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement
      if (target.dataset.action === "toggle" && target.dataset.id) {
        const state = (root as any).__state as AppState
        const todo = state.todos.find((t) => t.id === target.dataset.id)
        if (todo) {
          runAppEffectFork(store.toggleTodo(todo))
        }
      }
    })
  })
})

const render = (state: AppState) =>
  Effect.sync(() => {
    const root = document.getElementById("root")!
    const activeElement = document.activeElement
    const activeId = activeElement?.id
    const selectionStart = (activeElement as HTMLInputElement)?.selectionStart
    const selectionEnd = (activeElement as HTMLInputElement)?.selectionEnd

    ;(root as any).__state = state
    root.innerHTML = renderApp(state)

    if (activeId) {
      const element = document.getElementById(activeId) as HTMLInputElement
      if (element) {
        element.focus()
        if (selectionStart !== null && selectionEnd !== null && element.setSelectionRange) {
          element.setSelectionRange(selectionStart, selectionEnd)
        }
      }
    }
  })

export const runApp = Effect.gen(function* () {
  yield* Effect.sync(() => {
    const styleEl = document.createElement("style")
    styleEl.textContent = styles
    document.head.appendChild(styleEl)
  })

  const store = yield* AppStore

  yield* setupEventHandlers

  yield* store.fetchTodos

  yield* store.changes.pipe(
    Stream.runForEach((state) => render(state))
  )
})

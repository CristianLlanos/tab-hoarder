export class SearchBar {
  private el: HTMLElement
  private input: HTMLInputElement
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private onSearch: (query: string) => void

  constructor(onSearch: (query: string) => void) {
    this.onSearch = onSearch

    this.el = document.createElement('div')
    this.el.className = 'search-bar titlebar-no-drag'
    this.el.innerHTML = `
      <div class="search-bar__wrapper">
        <svg class="search-bar__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" class="glass-input search-bar__input" placeholder="Search tabs..." />
        <kbd class="search-bar__shortcut">⌘F</kbd>
      </div>
    `

    this.input = this.el.querySelector('input')!
    this.input.addEventListener('input', () => this.handleInput())

    // Style
    const style = document.createElement('style')
    style.textContent = `
      .search-bar { padding: 0 0 16px; }
      .search-bar__wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-bar__icon {
        position: absolute;
        left: 14px;
        color: var(--text-tertiary);
        pointer-events: none;
      }
      .search-bar__input {
        padding-left: 42px;
        padding-right: 52px;
        height: 44px;
        font-size: 14px;
        border-radius: var(--glass-radius-sm);
      }
      .search-bar__shortcut {
        position: absolute;
        right: 12px;
        padding: 3px 8px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--glass-border);
        border-radius: 6px;
        font-size: 11px;
        color: var(--text-tertiary);
        font-family: -apple-system, sans-serif;
        pointer-events: none;
      }
    `
    this.el.appendChild(style)
  }

  private handleInput(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.onSearch(this.input.value.trim())
    }, 300)
  }

  focus(): void {
    this.input.focus()
    this.input.select()
  }

  clear(): void {
    this.input.value = ''
    this.onSearch('')
  }

  render(): HTMLElement {
    return this.el
  }
}

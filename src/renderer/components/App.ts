import { Sidebar } from './Sidebar'
import { SearchBar } from './SearchBar'
import { TabGrid } from './TabGrid'
import type { GroupBy, SortBy } from './TabGrid'
import { ImportModal } from './ImportModal'
import { CollectionForm } from './CollectionForm'
import { showToast } from './Toast'
import * as api from '../services/api'
import type { Tab } from '../../shared/types'

export class App {
  private root: HTMLElement
  private sidebar: Sidebar
  private searchBar: SearchBar
  private tabGrid: TabGrid
  private currentCollectionId: number | null = null
  private currentSearch = ''
  private collectionNames: Map<number, string> = new Map()
  private detailPanel: HTMLElement | null = null

  constructor(root: HTMLElement) {
    this.root = root

    // Create components
    this.sidebar = new Sidebar({
      onSelect: (collectionId) => {
        this.currentCollectionId = collectionId
        this.loadTabs()
        this.loadCollections()
      },
      onCreateCollection: () => {
        new CollectionForm(() => this.loadCollections()).show()
      }
    })

    this.searchBar = new SearchBar((query) => {
      this.currentSearch = query
      this.loadTabs()
    })

    this.tabGrid = new TabGrid({
      onDelete: (id) => {
        this.tabGrid.removeCard(id)
        this.closeDetailPanel()
        this.loadCollections()
      },
      onMove: (id) => {
        showToast('Drag the tab to a collection in the sidebar', 'info')
      },
      onUpdate: (_tab) => {
        this.loadTabs()
      },
      onDetail: (tab) => {
        this.showDetailPanel(tab)
      }
    })

    this.buildLayout()
    this.registerKeyboardShortcuts()
    this.setupThumbnailProgress()
    this.loadData()
  }

  private buildLayout(): void {
    this.root.innerHTML = ''

    const layout = document.createElement('div')
    layout.className = 'app-layout'

    // Sidebar
    layout.appendChild(this.sidebar.render())

    // Main content
    const main = document.createElement('main')
    main.className = 'app-main'

    // Header with titlebar drag region
    const header = document.createElement('header')
    header.className = 'app-header titlebar-drag'

    const headerContent = document.createElement('div')
    headerContent.className = 'app-header__content titlebar-no-drag'

    // Toolbar buttons
    const toolbar = document.createElement('div')
    toolbar.className = 'app-toolbar'

    const importBtn = document.createElement('button')
    importBtn.className = 'glass-button glass-button--accent'
    importBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Import Chrome Tabs
    `
    importBtn.addEventListener('click', () => this.showImportModal())

    const captureBtn = document.createElement('button')
    captureBtn.className = 'glass-button'
    captureBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="m21 15-5-5L5 21"/>
      </svg>
      Capture Thumbnails
    `
    captureBtn.addEventListener('click', () => this.captureAllThumbnails())

    const closeBtn = document.createElement('button')
    closeBtn.className = 'glass-button glass-button--danger'
    closeBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      Close in Chrome
    `
    closeBtn.addEventListener('click', () => this.closeVisibleTabsInChrome())

    toolbar.appendChild(importBtn)
    toolbar.appendChild(captureBtn)
    toolbar.appendChild(closeBtn)

    headerContent.appendChild(toolbar)
    header.appendChild(headerContent)

    // Content area
    const content = document.createElement('div')
    content.className = 'app-content'
    content.appendChild(this.searchBar.render())
    content.appendChild(this.buildControls())
    content.appendChild(this.tabGrid.render())

    main.appendChild(header)
    main.appendChild(content)
    layout.appendChild(main)

    // Detail sidebar panel (hidden by default)
    this.detailPanel = document.createElement('aside')
    this.detailPanel.className = 'detail-panel glass-panel-solid'
    this.detailPanel.innerHTML = '<div class="detail-panel__empty">Click a tab\'s info to inspect it</div>'
    layout.appendChild(this.detailPanel)

    this.root.appendChild(layout)

    // Inject layout styles
    const style = document.createElement('style')
    style.textContent = `
      .app-layout {
        display: flex;
        height: 100%;
      }

      .app-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
      }

      .app-header {
        padding: 44px 28px 12px;
        flex-shrink: 0;
        position: relative;
        z-index: 2;
        background: var(--bg-gradient);
      }

      .app-header::after {
        content: '';
        position: absolute;
        bottom: -24px;
        left: 0;
        right: 0;
        height: 24px;
        background: linear-gradient(to bottom, #0d1628, transparent);
        pointer-events: none;
        z-index: 2;
      }

      .app-header__content {
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      .app-toolbar {
        display: flex;
        gap: 10px;
      }

      .app-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px 28px;
      }

      .app-progress {
        padding: 0 28px;
      }

      .app-progress__info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--text-secondary);
      }

      /* Detail Panel */
      .detail-panel {
        width: 0;
        height: 100%;
        border-radius: 0;
        border-left: 1px solid var(--glass-border);
        border-right: none;
        border-top: none;
        border-bottom: none;
        flex-shrink: 0;
        overflow: hidden;
        transition: width 0.3s var(--ease-smooth);
      }

      .detail-panel--open {
        width: 360px;
      }

      .detail-panel__inner {
        width: 360px;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }

      .detail-panel__close {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 1;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        border: 1px solid var(--glass-border);
        border-radius: 50%;
        color: var(--text-secondary);
        font-size: 14px;
        cursor: pointer;
        transition: all var(--duration-fast) var(--ease-smooth);
      }

      .detail-panel__close:hover {
        background: rgba(255, 255, 255, 0.15);
        color: var(--text-primary);
      }

      .detail-panel__preview {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 10;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.03);
        flex-shrink: 0;
      }

      .detail-panel__preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .detail-panel__preview-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 100%);
      }

      .detail-panel__body {
        padding: 20px;
        user-select: text;
        -webkit-user-select: text;
      }

      .detail-panel__title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.2px;
        line-height: 1.3;
        margin-bottom: 8px;
        color: var(--text-primary);
      }

      .detail-panel__url {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 20px;
      }

      .detail-panel__url-text {
        font-size: 11px;
        color: var(--accent);
        word-break: break-all;
        line-height: 1.4;
      }

      .detail-panel__meta {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .detail-panel__meta-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }

      .detail-panel__meta-row:last-child {
        border-bottom: none;
      }

      .detail-panel__meta-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .detail-panel__meta-value {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .detail-panel__profile-badge {
        color: var(--accent);
        background: var(--accent-light);
        padding: 2px 10px;
        border-radius: 10px;
        font-weight: 600;
      }

      .detail-panel__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 16px 20px 20px;
        border-top: 1px solid var(--glass-border);
        margin-top: auto;
      }

      .detail-panel__empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-tertiary);
        font-size: 13px;
        padding: 20px;
        text-align: center;
      }

      .detail-panel__refresh-thumb {
        position: absolute;
        top: 12px;
        right: 48px;
        z-index: 1;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        border: 1px solid var(--glass-border);
        border-radius: 50%;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all var(--duration-fast) var(--ease-smooth);
      }

      .detail-panel__refresh-thumb:hover {
        background: rgba(255, 255, 255, 0.15);
        color: var(--text-primary);
      }

      .detail-panel__thumb-content {
        width: 100%;
        height: 100%;
      }

      .detail-panel__thumb-content img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .detail-panel__field {
        margin-bottom: 14px;
      }

      .detail-panel__field-label {
        display: block;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--text-tertiary);
        margin-bottom: 6px;
      }

      .detail-panel__title-input {
        font-size: 15px;
        font-weight: 600;
        padding: 8px 12px;
      }

      .detail-panel__url-input {
        font-size: 12px;
        padding: 8px 12px;
        color: var(--accent);
      }

      .detail-panel__notes-input {
        font-size: 13px;
        padding: 10px 12px;
        resize: vertical;
        min-height: 60px;
        line-height: 1.5;
        border-radius: var(--glass-radius-xs);
      }
    `
    this.root.appendChild(style)
  }

  private buildControls(): HTMLElement {
    const controls = document.createElement('div')
    controls.className = 'tab-grid__controls'

    controls.innerHTML = `
      <div class="tab-grid__control-group">
        <span class="tab-grid__control-label">Group</span>
        <select class="tab-grid__control-select" data-control="group">
          <option value="none">None</option>
          <option value="category">Category</option>
          <option value="related">Related Sites</option>
          <option value="time-period">Time Period</option>
          <option value="profile">Profile</option>
          <option value="collection">Collection</option>
          <option value="domain">Domain</option>
        </select>
      </div>
      <div class="tab-grid__control-group">
        <span class="tab-grid__control-label">Sort</span>
        <select class="tab-grid__control-select" data-control="sort">
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
          <option value="domain-asc">Domain A–Z</option>
        </select>
      </div>
    `

    controls.querySelector('[data-control="group"]')!.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value as GroupBy
      this.tabGrid.setGroupBy(value)
      this.loadTabs()
    })

    controls.querySelector('[data-control="sort"]')!.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value as SortBy
      this.tabGrid.setSortBy(value)
      this.loadTabs()
    })

    return controls
  }

  private registerKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.metaKey && e.key === 'f') {
        e.preventDefault()
        this.searchBar.focus()
      }
      if (e.key === 'Escape') {
        this.closeDetailPanel()
        this.searchBar.clear()
      }
      if (e.metaKey && e.key === 'i') {
        e.preventDefault()
        this.showImportModal()
      }
      if (e.metaKey && e.key === 'n') {
        e.preventDefault()
        new CollectionForm(() => this.loadCollections()).show()
      }
    })
  }

  private setupThumbnailProgress(): void {
    api.onThumbnailProgress((progress) => {
      this.tabGrid.updateThumbnail(progress.tabId, `${progress.tabId}.jpg`)

      const progressEl = this.root.querySelector('.app-progress')
      if (progressEl) {
        const bar = progressEl.querySelector('.glass-progress__bar') as HTMLElement
        const info = progressEl.querySelector('.app-progress__completed') as HTMLElement
        const pct = Math.round((progress.completed / progress.total) * 100)
        bar.style.width = `${pct}%`
        info.textContent = `${progress.completed} / ${progress.total}`

        if (progress.completed === progress.total) {
          setTimeout(() => progressEl.remove(), 1500)
          showToast('All thumbnails captured', 'success')
        }
      }
    })
  }

  private async closeVisibleTabsInChrome(): Promise<void> {
    const tabs = await api.getTabs({
      collectionId: this.currentCollectionId ?? undefined,
      search: this.currentSearch || undefined,
    })

    if (tabs.length === 0) {
      showToast('No tabs to close', 'info')
      return
    }

    // Confirm before closing
    const count = tabs.length
    const confirmed = await new Promise<boolean>(resolve => {
      const overlay = document.createElement('div')
      overlay.className = 'glass-overlay animate-fade-in'
      overlay.innerHTML = `
        <div class="glass-modal animate-modal-in" style="max-width: 420px">
          <div class="glass-modal__header">
            <h2 class="glass-modal__title">Close Tabs in Chrome?</h2>
          </div>
          <div class="glass-modal__body" style="padding: 24px; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
            This will close <strong style="color: var(--text-primary)">${count} tab${count !== 1 ? 's' : ''}</strong> in Google Chrome.
            They are safely saved in Tab Hoarder and can be reopened anytime.
          </div>
          <div class="glass-modal__footer">
            <button class="glass-button" data-action="cancel">Cancel</button>
            <button class="glass-button glass-button--danger" data-action="confirm">Close ${count} Tabs</button>
          </div>
        </div>
      `
      overlay.querySelector('[data-action="cancel"]')!.addEventListener('click', () => {
        overlay.remove()
        resolve(false)
      })
      overlay.querySelector('[data-action="confirm"]')!.addEventListener('click', () => {
        overlay.remove()
        resolve(true)
      })
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.remove(); resolve(false) }
      })
      document.body.appendChild(overlay)
    })

    if (!confirmed) return

    showToast(`Closing ${count} tabs in Chrome...`, 'info')
    try {
      const closed = await api.closeChromeTabs(tabs.map(t => t.url))
      showToast(`Closed ${closed} tabs in Chrome`, 'success')
    } catch {
      showToast('Failed to close some tabs', 'error')
    }
  }

  private showDetailPanel(tab: Tab): void {
    if (!this.detailPanel) return

    let currentTab = { ...tab }
    const thumbnailUrl = api.getThumbnailUrl(currentTab.thumbnail_path)
    const faviconUrl = api.getFaviconUrl(currentTab.domain)
    const createdDate = new Date(currentTab.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const updatedDate = new Date(currentTab.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    this.detailPanel.innerHTML = `
      <div class="detail-panel__inner">
        <div class="detail-panel__preview">
          <button class="detail-panel__close">✕</button>
          <button class="detail-panel__refresh-thumb" title="Refresh thumbnail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6"/>
              <path d="M2.5 22v-6h6"/>
              <path d="M2.5 11.5a10 10 0 0 1 18.8-4.3"/>
              <path d="M21.5 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
          <div class="detail-panel__thumb-content">
            ${thumbnailUrl
              ? `<img src="${thumbnailUrl}" alt="" />`
              : `<div class="detail-panel__preview-placeholder">
                  <img src="${faviconUrl}" style="width:48px;height:48px;opacity:0.6" alt="" />
                </div>`
            }
          </div>
        </div>
        <div class="detail-panel__body">
          <div class="detail-panel__field">
            <label class="detail-panel__field-label">Title</label>
            <input type="text" class="glass-input detail-panel__title-input" value="${this.escapeAttr(currentTab.title)}" />
          </div>
          <div class="detail-panel__field">
            <label class="detail-panel__field-label">URL</label>
            <input type="text" class="glass-input detail-panel__url-input" value="${this.escapeAttr(currentTab.url)}" />
          </div>
          <div class="detail-panel__field">
            <label class="detail-panel__field-label">Notes</label>
            <textarea class="glass-input detail-panel__notes-input" rows="3" placeholder="Add notes...">${this.escapeHtml(currentTab.notes || '')}</textarea>
          </div>
          <div class="detail-panel__meta">
            <div class="detail-panel__meta-row">
              <span class="detail-panel__meta-label">Domain</span>
              <span class="detail-panel__meta-value">${this.escapeHtml(currentTab.domain)}</span>
            </div>
            ${currentTab.chrome_profile_name ? `
            <div class="detail-panel__meta-row">
              <span class="detail-panel__meta-label">Profile</span>
              <span class="detail-panel__meta-value detail-panel__profile-badge">${this.escapeHtml(currentTab.chrome_profile_name)}</span>
            </div>` : ''}
            <div class="detail-panel__meta-row">
              <span class="detail-panel__meta-label">Saved</span>
              <span class="detail-panel__meta-value">${createdDate}</span>
            </div>
            <div class="detail-panel__meta-row">
              <span class="detail-panel__meta-label">Updated</span>
              <span class="detail-panel__meta-value">${updatedDate}</span>
            </div>
          </div>
        </div>
        <div class="detail-panel__actions">
          <button class="glass-button glass-button--accent detail-panel__open-btn" style="flex:1">Open in Chrome</button>
          <button class="glass-button detail-panel__copy-btn">Copy URL</button>
          <button class="glass-button glass-button--danger detail-panel__delete-btn">Delete</button>
        </div>
      </div>
    `

    this.detailPanel.classList.add('detail-panel--open')

    const panel = this.detailPanel
    const titleInput = panel.querySelector('.detail-panel__title-input') as HTMLInputElement
    const urlInput = panel.querySelector('.detail-panel__url-input') as HTMLInputElement
    const notesInput = panel.querySelector('.detail-panel__notes-input') as HTMLTextAreaElement

    // Save field on blur with debounce
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    const saveField = async (field: string, value: string) => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(async () => {
        const updates: Partial<Tab> = { [field]: value }
        // Update domain when URL changes
        if (field === 'url') {
          try {
            updates.domain = new URL(value).hostname.replace(/^www\./, '')
          } catch { /* keep old domain */ }
        }
        currentTab = await api.updateTab(currentTab.id, updates)
        this.loadTabs()

        // Auto-refresh thumbnail when URL changes
        if (field === 'url') {
          this.refreshDetailThumbnail(currentTab, panel)
        }
      }, 600)
    }

    titleInput.addEventListener('input', () => saveField('title', titleInput.value))
    urlInput.addEventListener('input', () => saveField('url', urlInput.value))
    notesInput.addEventListener('input', () => saveField('notes', notesInput.value))

    // Close
    panel.querySelector('.detail-panel__close')!.addEventListener('click', () => this.closeDetailPanel())

    // Refresh thumbnail
    panel.querySelector('.detail-panel__refresh-thumb')!.addEventListener('click', () => {
      this.refreshDetailThumbnail(currentTab, panel)
    })

    // Open
    panel.querySelector('.detail-panel__open-btn')!.addEventListener('click', () => {
      api.openInChrome(currentTab.url, currentTab.chrome_profile_dir)
    })

    // Copy
    panel.querySelector('.detail-panel__copy-btn')!.addEventListener('click', async () => {
      await navigator.clipboard.writeText(currentTab.url)
      const btn = panel.querySelector('.detail-panel__copy-btn') as HTMLElement
      btn.textContent = 'Copied!'
      setTimeout(() => { btn.textContent = 'Copy URL' }, 1500)
    })

    // Delete
    panel.querySelector('.detail-panel__delete-btn')!.addEventListener('click', async () => {
      await api.deleteTab(currentTab.id)
      this.tabGrid.removeCard(currentTab.id)
      this.closeDetailPanel()
      this.loadCollections()
    })
  }

  private async refreshDetailThumbnail(tab: Tab, panel: HTMLElement): Promise<void> {
    const thumbContent = panel.querySelector('.detail-panel__thumb-content')
    if (!thumbContent) return

    thumbContent.innerHTML = `<div class="detail-panel__preview-placeholder"><div class="spinner"></div></div>`

    try {
      const result = await api.captureThumbnail(tab.id)
      tab.thumbnail_path = result.thumbnailPath
      const newUrl = api.getThumbnailUrl(result.thumbnailPath)
      thumbContent.innerHTML = `<img src="${newUrl}" alt="" />`
      this.tabGrid.updateThumbnail(tab.id, result.thumbnailPath)
    } catch {
      const faviconUrl = api.getFaviconUrl(tab.domain)
      thumbContent.innerHTML = `<div class="detail-panel__preview-placeholder"><img src="${faviconUrl}" style="width:48px;height:48px;opacity:0.6" alt="" /></div>`
      showToast('Failed to capture thumbnail', 'error')
    }
  }

  private closeDetailPanel(): void {
    if (!this.detailPanel) return
    this.detailPanel.classList.remove('detail-panel--open')
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private escapeAttr(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  private showImportModal(): void {
    new ImportModal(() => {
      this.loadData()
    }, this.currentCollectionId).show()
  }

  private async captureAllThumbnails(): Promise<void> {
    const tabs = await api.getTabs({
      collectionId: this.currentCollectionId ?? undefined,
    })

    const withoutThumbnails = tabs.filter(t => !t.thumbnail_path)
    if (withoutThumbnails.length === 0) {
      showToast('All tabs already have thumbnails', 'info')
      return
    }

    const existing = this.root.querySelector('.app-progress')
    if (existing) existing.remove()

    const progressEl = document.createElement('div')
    progressEl.className = 'app-progress'
    progressEl.innerHTML = `
      <div class="app-progress__info">
        <span>Capturing thumbnails...</span>
        <span><span class="app-progress__completed">0</span> of ${withoutThumbnails.length}</span>
      </div>
      <div class="glass-progress">
        <div class="glass-progress__bar" style="width: 0%"></div>
      </div>
    `

    const content = this.root.querySelector('.app-content')!
    content.parentElement!.insertBefore(progressEl, content)

    showToast(`Capturing ${withoutThumbnails.length} thumbnails...`, 'info')
    api.captureAllThumbnails(withoutThumbnails.map(t => t.id))
  }

  private async loadData(): Promise<void> {
    await Promise.all([this.loadTabs(), this.loadCollections()])
  }

  private async loadTabs(): Promise<void> {
    const tabs = await api.getTabs({
      collectionId: this.currentCollectionId ?? undefined,
      search: this.currentSearch || undefined,
    })
    this.tabGrid.setTabs(tabs, this.collectionNames)

    // Prefetch favicons in background
    const domains = [...new Set(tabs.map(t => t.domain).filter(Boolean))]
    api.prefetchFavicons(domains)
  }

  private async loadCollections(): Promise<void> {
    const [collections, allTabs] = await Promise.all([
      api.getCollections(),
      api.getTabs()
    ])
    this.collectionNames.clear()
    for (const c of collections) {
      this.collectionNames.set(c.id, c.name)
    }
    this.sidebar.setCollections(collections, allTabs.length)
  }
}

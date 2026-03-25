import type { Collection } from '../../shared/types'
import { updateTab, updateCollection, deleteCollection } from '../services/api'

export class Sidebar {
  private el: HTMLElement
  private collectionsContainer: HTMLElement
  private selectedCollectionId: number | null = null
  private totalCount = 0
  private onSelect: (collectionId: number | null) => void
  private onCreateCollection: () => void

  constructor(callbacks: {
    onSelect: (collectionId: number | null) => void
    onCreateCollection: () => void
  }) {
    this.onSelect = callbacks.onSelect
    this.onCreateCollection = callbacks.onCreateCollection

    this.el = document.createElement('aside')
    this.el.className = 'sidebar glass-panel-solid'
    this.el.innerHTML = `
      <div class="sidebar__header titlebar-drag">
        <div class="sidebar__logo">
          <span class="sidebar__logo-icon">🗃</span>
          <span class="sidebar__logo-text">Tab Hoarder</span>
        </div>
      </div>
      <nav class="sidebar__nav">
        <div class="sidebar__section">
          <div class="glass-sidebar-item glass-sidebar-item--active sidebar__all-tabs titlebar-no-drag" data-collection="all">
            <span>🏠</span>
            <span class="sidebar__item-label">All Tabs</span>
            <span class="glass-badge sidebar__all-count">0</span>
          </div>
        </div>
        <div class="sidebar__section">
          <div class="sidebar__section-header">
            <span>Collections</span>
            <button class="sidebar__add-btn glass-button titlebar-no-drag" title="New collection">+</button>
          </div>
          <div class="sidebar__collections"></div>
        </div>
      </nav>
      <div class="sidebar__footer">
        <div class="sidebar__sync-status"></div>
      </div>
    `

    this.collectionsContainer = this.el.querySelector('.sidebar__collections')!

    // Check iCloud status
    window.electronAPI.storage.isICloud().then(isICloud => {
      const status = this.el.querySelector('.sidebar__sync-status')!
      if (isICloud) {
        status.innerHTML = `<span class="sidebar__icloud-icon">☁</span> Synced to iCloud`
        status.classList.add('sidebar__sync-status--active')
      } else {
        status.innerHTML = `<span class="sidebar__icloud-icon">💾</span> Local storage`
      }
    })

    // Events
    this.el.querySelector('.sidebar__all-tabs')!.addEventListener('click', () => {
      this.selectCollection(null)
    })

    this.el.querySelector('.sidebar__add-btn')!.addEventListener('click', () => {
      this.onCreateCollection()
    })

    // Inject styles
    const style = document.createElement('style')
    style.textContent = `
      .sidebar {
        width: var(--sidebar-width);
        height: 100%;
        border-radius: 0;
        border-right: 1px solid var(--glass-border);
        border-left: none;
        border-top: none;
        border-bottom: none;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        overflow: hidden;
      }

      .sidebar__header {
        padding: 48px 18px 16px;
        display: flex;
        align-items: center;
      }

      .sidebar__logo {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .sidebar__logo-icon {
        font-size: 22px;
      }

      .sidebar__logo-text {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.3px;
        color: var(--text-primary);
      }

      .sidebar__nav {
        flex: 1;
        overflow-y: auto;
        padding: 0 10px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .sidebar__section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px 6px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--text-tertiary);
      }

      .sidebar__add-btn {
        padding: 2px 8px;
        font-size: 16px;
        font-weight: 400;
        min-width: auto;
        line-height: 1;
      }

      .sidebar__item-label {
        flex: 1;
      }

      .sidebar__collection-color {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .sidebar__footer {
        padding: 12px 18px;
        border-top: 1px solid var(--glass-border);
        flex-shrink: 0;
      }

      .sidebar__sync-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--text-tertiary);
        font-weight: 500;
      }

      .sidebar__sync-status--active {
        color: var(--accent);
      }

      .sidebar__icloud-icon {
        font-size: 14px;
      }
    `
    this.el.appendChild(style)
  }

  setCollections(collections: Collection[], totalTabCount: number): void {
    this.totalCount = totalTabCount
    this.el.querySelector('.sidebar__all-count')!.textContent = String(totalTabCount)

    this.collectionsContainer.innerHTML = ''
    collections.forEach(collection => {
      const item = document.createElement('div')
      item.className = `glass-sidebar-item titlebar-no-drag${this.selectedCollectionId === collection.id ? ' glass-sidebar-item--active' : ''}`
      item.dataset.collection = String(collection.id)
      item.innerHTML = `
        <span class="sidebar__collection-color" style="background: ${collection.color}"></span>
        <span class="sidebar__item-label">${this.escapeHtml(collection.name)}</span>
        <span class="glass-badge">${collection.tab_count ?? 0}</span>
      `

      item.addEventListener('click', () => this.selectCollection(collection.id))

      // Double-click to rename
      item.addEventListener('dblclick', (e) => {
        e.stopPropagation()
        this.renameCollection(item, collection)
      })

      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        document.querySelector('.context-menu')?.remove()

        const menu = document.createElement('div')
        menu.className = 'context-menu glass-panel-solid animate-fade-in'
        menu.innerHTML = `
          <div class="context-menu__item" data-action="rename">Rename</div>
          <div class="context-menu__divider"></div>
          <div class="context-menu__item context-menu__item--danger" data-action="delete">Delete Collection</div>
        `
        menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:3000;padding:6px;min-width:180px;border-radius:var(--glass-radius-sm);`

        menu.addEventListener('click', async (ev) => {
          const target = (ev.target as HTMLElement).closest('[data-action]') as HTMLElement
          if (!target) return
          if (target.dataset.action === 'rename') {
            this.renameCollection(item, collection)
          } else if (target.dataset.action === 'delete') {
            await deleteCollection(collection.id)
            this.onSelect(null)
          }
          menu.remove()
        })

        document.body.appendChild(menu)
        const close = (ev: MouseEvent) => {
          if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('click', close) }
        }
        setTimeout(() => document.addEventListener('click', close), 0)
      })

      // Drop target for drag-and-drop
      item.addEventListener('dragover', (e) => {
        e.preventDefault()
        item.classList.add('glass-sidebar-item--drop-target')
      })
      item.addEventListener('dragleave', () => {
        item.classList.remove('glass-sidebar-item--drop-target')
      })
      item.addEventListener('drop', async (e) => {
        e.preventDefault()
        item.classList.remove('glass-sidebar-item--drop-target')
        const tabId = Number(e.dataTransfer?.getData('text/plain'))
        if (tabId) {
          await updateTab(tabId, { collection_id: collection.id })
          // Trigger refresh
          this.onSelect(this.selectedCollectionId)
        }
      })

      this.collectionsContainer.appendChild(item)
    })
  }

  private selectCollection(id: number | null): void {
    this.selectedCollectionId = id

    // Update active states
    this.el.querySelectorAll('.glass-sidebar-item').forEach(item => {
      item.classList.remove('glass-sidebar-item--active')
    })

    if (id === null) {
      this.el.querySelector('.sidebar__all-tabs')!.classList.add('glass-sidebar-item--active')
    } else {
      const item = this.collectionsContainer.querySelector(`[data-collection="${id}"]`)
      item?.classList.add('glass-sidebar-item--active')
    }

    this.onSelect(id)
  }

  private renameCollection(item: HTMLElement, collection: Collection): void {
    const label = item.querySelector('.sidebar__item-label') as HTMLElement
    if (!label) return

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'glass-input'
    input.value = collection.name
    input.style.cssText = 'font-size: 13px; font-weight: 500; padding: 2px 8px; height: auto; flex: 1;'

    label.replaceWith(input)
    input.focus()
    input.select()

    let committed = false
    const commit = async () => {
      if (committed) return
      committed = true
      const newName = input.value.trim() || collection.name
      if (newName !== collection.name) {
        await updateCollection(collection.id, { name: newName })
        collection.name = newName
      }
      // Replace input back with label
      const newLabel = document.createElement('span')
      newLabel.className = 'sidebar__item-label'
      newLabel.textContent = newName
      input.replaceWith(newLabel)
    }

    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') { e.preventDefault(); input.blur() }
      if (e.key === 'Escape') { input.value = collection.name; input.blur() }
    })
    input.addEventListener('click', (e) => e.stopPropagation())
    input.addEventListener('blur', commit)
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  render(): HTMLElement {
    return this.el
  }
}

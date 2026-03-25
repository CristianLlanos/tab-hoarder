import type { ChromeTab } from '../../shared/types'
import { importChromeTabs, createManyTabs, closeChromeTabs } from '../services/api'
import { showToast } from './Toast'

export class ImportModal {
  private el: HTMLElement
  private tabs: ChromeTab[] = []
  private selectedUrls: Set<string> = new Set()
  private onImported: () => void
  private collectionId: number | null

  constructor(onImported: () => void, collectionId: number | null = null) {
    this.onImported = onImported
    this.collectionId = collectionId

    this.el = document.createElement('div')
    this.el.className = 'glass-overlay animate-fade-in'
    this.el.innerHTML = `
      <div class="glass-modal animate-modal-in">
        <div class="glass-modal__header">
          <h2 class="glass-modal__title">Import from Chrome</h2>
          <button class="glass-button import-modal__close">✕</button>
        </div>
        <div class="glass-modal__body">
          <div class="import-modal__loading">
            <div class="spinner"></div>
            <span>Reading Chrome tabs...</span>
          </div>
        </div>
        <div class="glass-modal__footer">
          <div class="import-modal__count">0 selected</div>
          <div style="flex:1"></div>
          <button class="glass-button import-modal__select-all">Select All</button>
          <button class="glass-button glass-button--accent import-modal__import" disabled>Import Selected</button>
        </div>
      </div>
    `

    // Inject styles
    const style = document.createElement('style')
    style.textContent = `
      .import-modal__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 48px 0;
        color: var(--text-secondary);
      }
      .import-modal__list {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .import-modal__tab-info {
        flex: 1;
        min-width: 0;
      }
      .import-modal__tab-title {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .import-modal__tab-url {
        font-size: 11px;
        color: var(--text-tertiary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .import-modal__count {
        font-size: 13px;
        color: var(--text-secondary);
        font-weight: 500;
      }
      .import-modal__search {
        margin-bottom: 12px;
      }
      .import-modal__tab-profile {
        display: inline-block;
        font-size: 9px;
        font-weight: 600;
        color: var(--accent);
        background: var(--accent-light);
        padding: 1px 6px;
        border-radius: 8px;
        margin-right: 6px;
        vertical-align: middle;
      }
    `
    this.el.appendChild(style)

    // Events
    this.el.querySelector('.import-modal__close')!.addEventListener('click', () => this.close())
    this.el.querySelector('.import-modal__select-all')!.addEventListener('click', () => this.toggleSelectAll())
    this.el.querySelector('.import-modal__import')!.addEventListener('click', () => this.doImport())
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close()
    })

    this.loadTabs()
  }

  private async loadTabs(): Promise<void> {
    try {
      this.tabs = await importChromeTabs()
      this.renderTabList()
    } catch (error) {
      const body = this.el.querySelector('.glass-modal__body')!
      body.innerHTML = `
        <div class="import-modal__loading" style="color: var(--red)">
          <span>Failed to read Chrome tabs. Make sure Chrome is running and permissions are granted.</span>
        </div>
      `
    }
  }

  private renderTabList(): void {
    const body = this.el.querySelector('.glass-modal__body')!
    body.innerHTML = `
      <input type="text" class="glass-input import-modal__search" placeholder="Filter tabs..." />
      <div class="import-modal__list"></div>
    `

    const searchInput = body.querySelector('.import-modal__search') as HTMLInputElement
    searchInput.addEventListener('input', () => {
      this.filterTabs(searchInput.value)
    })

    this.renderList(this.tabs)
  }

  private renderList(tabs: ChromeTab[]): void {
    const list = this.el.querySelector('.import-modal__list')!
    list.innerHTML = ''

    tabs.forEach(tab => {
      const item = document.createElement('label')
      item.className = 'glass-checkbox'
      item.innerHTML = `
        <input type="checkbox" value="${this.escapeAttr(tab.url)}" ${this.selectedUrls.has(tab.url) ? 'checked' : ''} />
        <div class="import-modal__tab-info">
          <div class="import-modal__tab-title">${this.escapeHtml(tab.title)}</div>
          <div class="import-modal__tab-url">
            ${tab.profileName ? `<span class="import-modal__tab-profile">${this.escapeHtml(tab.profileName)}</span>` : ''}
            ${this.escapeHtml(tab.url)}
          </div>
        </div>
      `

      const checkbox = item.querySelector('input')!
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedUrls.add(tab.url)
        } else {
          this.selectedUrls.delete(tab.url)
        }
        this.updateCount()
      })

      list.appendChild(item)
    })
  }

  private filterTabs(query: string): void {
    const q = query.toLowerCase()
    const filtered = q
      ? this.tabs.filter(t => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
      : this.tabs
    this.renderList(filtered)
  }

  private toggleSelectAll(): void {
    if (this.selectedUrls.size === this.tabs.length) {
      this.selectedUrls.clear()
    } else {
      this.tabs.forEach(t => this.selectedUrls.add(t.url))
    }
    this.renderList(this.tabs)
    this.updateCount()
  }

  private updateCount(): void {
    const count = this.selectedUrls.size
    this.el.querySelector('.import-modal__count')!.textContent = `${count} selected`
    const importBtn = this.el.querySelector('.import-modal__import') as HTMLButtonElement
    importBtn.disabled = count === 0

    const selectAllBtn = this.el.querySelector('.import-modal__select-all')!
    selectAllBtn.textContent = this.selectedUrls.size === this.tabs.length ? 'Deselect All' : 'Select All'
  }

  private async doImport(): Promise<void> {
    const importBtn = this.el.querySelector('.import-modal__import') as HTMLButtonElement
    importBtn.disabled = true
    importBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Importing...'

    const tabsToImport = this.tabs
      .filter(t => this.selectedUrls.has(t.url))
      .map(t => ({ url: t.url, title: t.title, chrome_profile_dir: t.profileDir ?? null, chrome_profile_name: t.profileName ?? null }))

    try {
      await createManyTabs(tabsToImport, this.collectionId)
      showToast(`Imported ${tabsToImport.length} tabs`, 'success')
      this.onImported()
      this.showCloseConfirmation(tabsToImport.map(t => t.url))
    } catch (error) {
      showToast('Failed to import tabs', 'error')
      importBtn.disabled = false
      importBtn.textContent = 'Import Selected'
    }
  }

  private showCloseConfirmation(urls: string[]): void {
    const modal = this.el.querySelector('.glass-modal')!
    modal.innerHTML = `
      <div class="glass-modal__header">
        <h2 class="glass-modal__title">Tabs Imported</h2>
      </div>
      <div class="glass-modal__body" style="text-align: center; padding: 32px 24px;">
        <div style="font-size: 40px; margin-bottom: 16px;">✓</div>
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">${urls.length} tabs saved to Tab Hoarder</div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
          Would you like to close these tabs in Chrome to free up memory?
        </div>
      </div>
      <div class="glass-modal__footer" style="justify-content: center;">
        <button class="glass-button import-modal__keep">Keep Open</button>
        <button class="glass-button glass-button--accent import-modal__close-tabs">Close ${urls.length} Tabs in Chrome</button>
      </div>
    `

    modal.querySelector('.import-modal__keep')!.addEventListener('click', () => {
      this.close()
    })

    modal.querySelector('.import-modal__close-tabs')!.addEventListener('click', async () => {
      const btn = modal.querySelector('.import-modal__close-tabs') as HTMLButtonElement
      btn.disabled = true
      btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Closing...'

      try {
        const closed = await closeChromeTabs(urls)
        showToast(`Closed ${closed} tabs in Chrome`, 'success')
      } catch {
        showToast('Failed to close some tabs', 'error')
      }
      this.close()
    })
  }

  private close(): void {
    this.el.style.opacity = '0'
    this.el.style.transition = 'opacity 0.2s ease'
    setTimeout(() => this.el.remove(), 200)
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private escapeAttr(text: string): string {
    return text.replace(/"/g, '&quot;')
  }

  show(): void {
    document.body.appendChild(this.el)
  }
}

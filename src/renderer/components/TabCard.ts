import type { Tab } from '../../shared/types'
import { getThumbnailUrl, openInChrome, deleteTab, captureThumbnail, closeChromeTabs, updateTab, getFaviconUrl } from '../services/api'

export class TabCard {
  private el: HTMLElement
  private tab: Tab
  private onDelete: (id: number) => void
  private onMove: (id: number) => void
  private onUpdate: (tab: Tab) => void
  private onDetail: (tab: Tab) => void

  constructor(
    tab: Tab,
    index: number,
    callbacks: {
      onDelete: (id: number) => void
      onMove: (id: number) => void
      onUpdate: (tab: Tab) => void
      onDetail: (tab: Tab) => void
    }
  ) {
    this.tab = tab
    this.onDelete = callbacks.onDelete
    this.onMove = callbacks.onMove
    this.onUpdate = callbacks.onUpdate
    this.onDetail = callbacks.onDetail

    this.el = document.createElement('div')
    this.el.className = 'glass-card tab-card tab-card-enter'
    this.el.style.animationDelay = `${Math.min(index * 30, 600)}ms`
    this.el.draggable = true

    this.el.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', String(tab.id))
      this.el.style.opacity = '0.5'
    })
    this.el.addEventListener('dragend', () => {
      this.el.style.opacity = '1'
    })

    this.el.addEventListener('contextmenu', (e) => this.showContextMenu(e))

    this.buildContent()
  }

  private buildContent(): void {
    const thumbnailUrl = getThumbnailUrl(this.tab.thumbnail_path)
    const faviconUrl = getFaviconUrl(this.tab.domain)

    this.el.innerHTML = `
      <div class="tab-card__thumbnail tab-card__open-zone">
        ${thumbnailUrl
          ? `<img src="${thumbnailUrl}" alt="" loading="lazy" />`
          : `<div class="tab-card__placeholder">
              <img src="${faviconUrl}" class="tab-card__favicon-large" alt="" />
            </div>`
        }
        ${this.tab.pinned ? '<div class="tab-card__pin">📌</div>' : ''}
        <div class="tab-card__open-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open
        </div>
      </div>
      <div class="tab-card__info tab-card__detail-zone">
        <div class="tab-card__title" title="${this.escapeHtml(this.tab.title)}">${this.escapeHtml(this.tab.title)}</div>
        <div class="tab-card__domain">
          <img src="${faviconUrl}" class="tab-card__favicon" alt="" width="14" height="14" />
          <span>${this.escapeHtml(this.tab.domain)}</span>
        </div>
        ${this.tab.chrome_profile_name
          ? `<div class="tab-card__profile">${this.escapeHtml(this.tab.chrome_profile_name)}</div>`
          : ''
        }
      </div>
    `

    // Thumbnail click → open in Chrome
    this.el.querySelector('.tab-card__open-zone')!.addEventListener('click', (e) => {
      e.stopPropagation()
      openInChrome(this.tab.url, this.tab.chrome_profile_dir)
    })

    // Info click → show detail
    this.el.querySelector('.tab-card__detail-zone')!.addEventListener('click', (e) => {
      e.stopPropagation()
      this.onDetail(this.tab)
    })
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private showContextMenu(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()

    // Remove existing context menu
    document.querySelector('.context-menu')?.remove()

    const menu = document.createElement('div')
    menu.className = 'context-menu glass-panel-solid animate-fade-in'
    menu.innerHTML = `
      <div class="context-menu__item" data-action="open">Open in Browser</div>
      <div class="context-menu__item" data-action="close-chrome">Close in Chrome</div>
      <div class="context-menu__item" data-action="copy">Copy URL</div>
      <div class="context-menu__item" data-action="rename">Rename</div>
      <div class="context-menu__item" data-action="thumbnail">Recapture Thumbnail</div>
      <div class="context-menu__item" data-action="move">Move to Collection...</div>
      <div class="context-menu__divider"></div>
      <div class="context-menu__item context-menu__item--danger" data-action="delete">Delete</div>
    `

    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      z-index: 3000;
      padding: 6px;
      min-width: 200px;
      border-radius: var(--glass-radius-sm);
    `

    menu.addEventListener('click', async (ev) => {
      const target = (ev.target as HTMLElement).closest('[data-action]') as HTMLElement
      if (!target) return
      const action = target.dataset.action

      switch (action) {
        case 'open':
          openInChrome(this.tab.url, this.tab.chrome_profile_dir)
          break
        case 'close-chrome':
          await closeChromeTabs([this.tab.url])
          break
        case 'rename':
          this.showRenameInput()
          break
        case 'copy':
          await navigator.clipboard.writeText(this.tab.url)
          break
        case 'thumbnail':
          const result = await captureThumbnail(this.tab.id)
          this.tab.thumbnail_path = result.thumbnailPath
          this.buildContent()
          break
        case 'move':
          this.onMove(this.tab.id)
          break
        case 'delete':
          await deleteTab(this.tab.id)
          this.onDelete(this.tab.id)
          break
      }
      menu.remove()
    })

    document.body.appendChild(menu)

    const closeMenu = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove()
        document.removeEventListener('click', closeMenu)
      }
    }
    setTimeout(() => document.addEventListener('click', closeMenu), 0)
  }

  private showRenameInput(): void {
    const titleEl = this.el.querySelector('.tab-card__title') as HTMLElement
    if (!titleEl) return

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'glass-input tab-card__rename-input'
    input.value = this.tab.title
    input.style.cssText = 'font-size: 13px; font-weight: 600; padding: 4px 8px; height: auto;'

    titleEl.replaceWith(input)
    input.focus()
    input.select()

    // Prevent card click from opening URL
    const stopProp = (e: Event) => { e.stopPropagation() }
    input.addEventListener('click', stopProp)

    const commit = async () => {
      const newTitle = input.value.trim()
      if (newTitle && newTitle !== this.tab.title) {
        this.tab = await updateTab(this.tab.id, { title: newTitle })
      }
      this.buildContent()
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit() }
      if (e.key === 'Escape') { this.buildContent() }
    })
    input.addEventListener('blur', commit)
  }

  updateThumbnail(thumbnailPath: string): void {
    this.tab.thumbnail_path = thumbnailPath
    this.buildContent()
  }

  render(): HTMLElement {
    return this.el
  }
}

// Inject TabCard styles
const tabCardStyles = document.createElement('style')
tabCardStyles.textContent = `
  .tab-card {
    cursor: pointer;
    display: flex;
    flex-direction: column;
  }

  .tab-card__thumbnail {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
  }

  .tab-card__thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .tab-card__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 100%);
  }

  .tab-card__favicon-large {
    width: 48px;
    height: 48px;
    opacity: 0.7;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
  }

  .tab-card__pin {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 14px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
    z-index: 1;
  }

  .tab-card__open-hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    color: white;
    font-size: 13px;
    font-weight: 600;
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-smooth);
    cursor: pointer;
  }

  .tab-card__open-zone {
    position: relative;
    cursor: pointer;
  }

  .tab-card__open-zone:hover .tab-card__open-hint {
    opacity: 1;
  }

  .tab-card__detail-zone {
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-smooth);
    border-radius: 0 0 var(--glass-radius-md) var(--glass-radius-md);
  }

  .tab-card__detail-zone:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .tab-card__info {
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tab-card__title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.1px;
  }

  .tab-card__domain {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .tab-card__favicon {
    border-radius: 3px;
    flex-shrink: 0;
  }

  .tab-card__profile {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-light);
    padding: 2px 8px;
    border-radius: 10px;
    width: fit-content;
    letter-spacing: 0.2px;
  }

  /* Context Menu */
  .context-menu__item {
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-smooth);
  }

  .context-menu__item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .context-menu__item--danger {
    color: var(--red);
  }

  .context-menu__item--danger:hover {
    background: rgba(255, 69, 58, 0.15);
  }

  .context-menu__divider {
    height: 1px;
    background: var(--glass-border);
    margin: 4px 0;
  }

  /* Detail Panel */
  .tab-detail {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tab-detail__preview {
    width: 100%;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
    flex-shrink: 0;
  }

  .tab-detail__thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .tab-detail__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 100%);
  }

  .tab-detail__body {
    padding: 20px 24px;
    user-select: text;
    -webkit-user-select: text;
  }

  .tab-detail__title {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.3px;
    line-height: 1.3;
    margin-bottom: 10px;
    color: var(--text-primary);
  }

  .tab-detail__url {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }

  .tab-detail__link {
    font-size: 12px;
    color: var(--accent);
    word-break: break-all;
    line-height: 1.4;
    cursor: default;
  }

  .tab-detail__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tab-detail__meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .tab-detail__meta-row:last-child {
    border-bottom: none;
  }

  .tab-detail__meta-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tab-detail__meta-value {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .tab-detail__profile-badge {
    color: var(--accent);
    background: var(--accent-light);
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
  }
`
document.head.appendChild(tabCardStyles)

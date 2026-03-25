import type { Tab } from '../../shared/types'
import { TabCard } from './TabCard'

export type GroupBy = 'none' | 'profile' | 'collection' | 'domain' | 'category' | 'related' | 'time-period'
export type SortBy = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc' | 'domain-asc'

export class TabGrid {
  private el: HTMLElement
  private cards: Map<number, TabCard> = new Map()
  private onDelete: (id: number) => void
  private onMove: (id: number) => void
  private onUpdate: (tab: Tab) => void
  private onDetail: (tab: Tab) => void
  private groupBy: GroupBy = 'none'
  private sortBy: SortBy = 'date-desc'

  constructor(callbacks: {
    onDelete: (id: number) => void
    onMove: (id: number) => void
    onUpdate: (tab: Tab) => void
    onDetail: (tab: Tab) => void
  }) {
    this.onDelete = callbacks.onDelete
    this.onMove = callbacks.onMove
    this.onUpdate = callbacks.onUpdate
    this.onDetail = callbacks.onDetail

    this.el = document.createElement('div')
    this.el.className = 'tab-grid-container'

    // Inject styles
    const style = document.createElement('style')
    style.textContent = `
      .tab-grid-container {
        padding: 0 0 24px;
      }

      .tab-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 20px;
      }

      .tab-grid--empty {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 300px;
      }

      .tab-grid__empty {
        text-align: center;
        color: var(--text-secondary);
      }

      .tab-grid__empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .tab-grid__empty-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--text-primary);
      }

      .tab-grid__empty-text {
        font-size: 13px;
        max-width: 260px;
        line-height: 1.5;
      }

      .tab-grid__group {
        margin-bottom: 28px;
      }

      .tab-grid__group:last-child {
        margin-bottom: 0;
      }

      .tab-grid__group-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--glass-border);
      }

      .tab-grid__group-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.2px;
      }

      .tab-grid__group-count {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-tertiary);
        background: rgba(255, 255, 255, 0.06);
        padding: 2px 8px;
        border-radius: 10px;
      }

      .tab-grid__controls {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .tab-grid__control-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .tab-grid__control-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-tertiary);
      }

      .tab-grid__control-select {
        appearance: none;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--glass-border);
        border-radius: var(--glass-radius-xs);
        color: var(--text-primary);
        font-size: 12px;
        font-weight: 500;
        padding: 5px 28px 5px 10px;
        cursor: pointer;
        font-family: inherit;
        transition: all var(--duration-fast) var(--ease-smooth);
        background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
      }

      .tab-grid__control-select:hover {
        background-color: rgba(255, 255, 255, 0.1);
        border-color: var(--glass-border-hover);
      }

      .tab-grid__control-select:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px var(--accent-light);
      }

      .tab-grid__control-select option {
        background: #1a1a2e;
        color: var(--text-primary);
      }
    `
    this.el.appendChild(style)
  }

  setGroupBy(groupBy: GroupBy): void {
    this.groupBy = groupBy
  }

  setSortBy(sortBy: SortBy): void {
    this.sortBy = sortBy
  }

  private sortTabs(tabs: Tab[]): Tab[] {
    const sorted = [...tabs]
    switch (this.sortBy) {
      case 'date-desc':
        return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
      case 'date-asc':
        return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at))
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }))
      case 'domain-asc':
        return sorted.sort((a, b) => a.domain.localeCompare(b.domain, undefined, { sensitivity: 'base' }))
      default:
        return sorted
    }
  }

  private categorizeByDomain(domain: string): string {
    const categories: Record<string, string[]> = {
      'Development': ['github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'docs.rs', 'crates.io', 'pypi.org', 'dev.to', 'medium.com', 'hashnode.dev', 'vercel.com', 'netlify.com', 'heroku.com', 'codepen.io', 'codesandbox.io', 'replit.com', 'bitbucket.org', 'developer.mozilla.org', 'w3schools.com', 'localhost'],
      'Cloud & DevOps': ['aws.amazon.com', 'console.aws.amazon.com', 'cloud.google.com', 'portal.azure.com', 'docker.com', 'kubernetes.io', 'terraform.io', 'cloudflare.com', 'digitalocean.com'],
      'Social Media': ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'reddit.com', 'threads.net', 'mastodon.social', 'tiktok.com', 'snapchat.com'],
      'Entertainment': ['youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv', 'disneyplus.com', 'hulu.com', 'primevideo.com', 'music.apple.com', 'soundcloud.com', 'vimeo.com'],
      'Shopping': ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 'bestbuy.com', 'aliexpress.com', 'shopify.com', 'mercadolibre.com'],
      'News & Media': ['news.ycombinator.com', 'bbc.com', 'cnn.com', 'nytimes.com', 'theguardian.com', 'reuters.com', 'bloomberg.com', 'techcrunch.com', 'arstechnica.com', 'theverge.com', 'wired.com'],
      'Finance': ['bank', 'chase.com', 'paypal.com', 'venmo.com', 'coinbase.com', 'binance.com', 'robinhood.com', 'mint.com', 'plaid.com', 'stripe.com', 'wise.com'],
      'Productivity': ['notion.so', 'trello.com', 'asana.com', 'monday.com', 'clickup.com', 'linear.app', 'figma.com', 'miro.com', 'slack.com', 'discord.com', 'zoom.us', 'meet.google.com', 'teams.microsoft.com', 'calendar.google.com'],
      'Email': ['mail.google.com', 'outlook.com', 'outlook.live.com', 'protonmail.com', 'mail.yahoo.com'],
      'Google': ['google.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com', 'drive.google.com', 'photos.google.com', 'maps.google.com'],
      'AI & ML': ['chat.openai.com', 'claude.ai', 'anthropic.com', 'openai.com', 'huggingface.co', 'kaggle.com', 'colab.research.google.com', 'perplexity.ai', 'midjourney.com'],
      'Education': ['coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'udacity.com', 'pluralsight.com', 'skillshare.com', 'duolingo.com', 'chinesefor.us'],
      'Reference': ['wikipedia.org', 'wikimedia.org', 'archive.org', 'britannica.com'],
    }

    const domainLower = domain.toLowerCase()
    for (const [category, domains] of Object.entries(categories)) {
      for (const d of domains) {
        if (domainLower === d || domainLower.endsWith('.' + d) || domainLower.includes(d)) {
          return category
        }
      }
    }
    return 'Other'
  }

  private getTimePeriod(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays <= 7) return 'This Week'
    if (diffDays <= 30) return 'This Month'
    if (diffDays <= 90) return 'Last 3 Months'
    return 'Older'
  }

  private groupTabs(tabs: Tab[]): Map<string, Tab[]> {
    const groups = new Map<string, Tab[]>()

    if (this.groupBy === 'none') {
      groups.set('', tabs)
      return groups
    }

    for (const tab of tabs) {
      let key: string
      switch (this.groupBy) {
        case 'profile':
          key = tab.chrome_profile_name || 'Unknown Profile'
          break
        case 'collection':
          key = tab.collection_id ? `Collection ${tab.collection_id}` : 'Uncategorized'
          break
        case 'domain':
          key = tab.domain || 'Unknown'
          break
        case 'category':
          key = this.categorizeByDomain(tab.domain)
          break
        case 'related': {
          // Group by base domain (e.g., all github.com/* together, all aws.amazon.com/* together)
          const parts = tab.domain.split('.')
          // Use the last two parts for most domains, but keep subdomains for large platforms
          if (parts.length >= 3 && ['com', 'org', 'net', 'io', 'co'].includes(parts[parts.length - 1])) {
            const base = parts.slice(-2).join('.')
            // Keep meaningful subdomains for large platforms
            if (['amazon.com', 'google.com', 'microsoft.com', 'apple.com'].includes(base) && parts.length >= 3) {
              key = parts.slice(-3).join('.')
            } else {
              key = base
            }
          } else {
            key = parts.slice(-2).join('.')
          }
          break
        }
        case 'time-period':
          key = this.getTimePeriod(tab.created_at)
          break
        default:
          key = ''
      }

      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(tab)
    }

    // Sort groups
    if (this.groupBy === 'time-period') {
      // Keep chronological order
      const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last 3 Months', 'Older']
      return new Map([...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])))
    }

    if (this.groupBy === 'related') {
      // Sort by group size (largest first)
      return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length))
    }

    // Default: alphabetical, with unknowns at end
    return new Map([...groups.entries()].sort((a, b) => {
      if (a[0] === 'Other' || a[0].startsWith('Unknown') || a[0] === 'Uncategorized') return 1
      if (b[0] === 'Other' || b[0].startsWith('Unknown') || b[0] === 'Uncategorized') return -1
      return a[0].localeCompare(b[0])
    }))
  }

  setTabs(tabs: Tab[], collectionNames?: Map<number, string>): void {
    this.cards.clear()
    const style = this.el.querySelector('style')
    this.el.innerHTML = ''
    if (style) this.el.appendChild(style)

    if (tabs.length === 0) {
      const emptyGrid = document.createElement('div')
      emptyGrid.className = 'tab-grid tab-grid--empty'
      const empty = document.createElement('div')
      empty.className = 'tab-grid__empty animate-fade-in'
      empty.innerHTML = `
        <div class="tab-grid__empty-icon">🗂</div>
        <div class="tab-grid__empty-title">No tabs yet</div>
        <div class="tab-grid__empty-text">Import your Chrome tabs to get started, or they'll appear here as you add them.</div>
      `
      emptyGrid.appendChild(empty)
      this.el.appendChild(emptyGrid)
      return
    }

    const sorted = this.sortTabs(tabs)
    const groups = this.groupTabs(sorted)

    // Resolve collection names if grouping by collection
    if (this.groupBy === 'collection' && collectionNames) {
      const resolved = new Map<string, Tab[]>()
      for (const [key, groupTabs] of groups) {
        if (key.startsWith('Collection ')) {
          const id = parseInt(key.replace('Collection ', ''), 10)
          const name = collectionNames.get(id) || key
          resolved.set(name, groupTabs)
        } else {
          resolved.set(key, groupTabs)
        }
      }
      groups.clear()
      for (const [k, v] of resolved) groups.set(k, v)
    }

    let cardIndex = 0

    for (const [groupName, groupTabs] of groups) {
      const groupEl = document.createElement('div')
      groupEl.className = 'tab-grid__group'

      if (groupName && this.groupBy !== 'none') {
        const header = document.createElement('div')
        header.className = 'tab-grid__group-header'
        header.innerHTML = `
          <span class="tab-grid__group-name">${this.escapeHtml(groupName)}</span>
          <span class="tab-grid__group-count">${groupTabs.length}</span>
        `
        groupEl.appendChild(header)
      }

      const grid = document.createElement('div')
      grid.className = 'tab-grid'

      for (const tab of groupTabs) {
        const card = new TabCard(tab, cardIndex++, {
          onDelete: this.onDelete,
          onMove: this.onMove,
          onUpdate: this.onUpdate,
          onDetail: this.onDetail,
        })
        this.cards.set(tab.id, card)
        grid.appendChild(card.render())
      }

      groupEl.appendChild(grid)
      this.el.appendChild(groupEl)
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  updateThumbnail(tabId: number, thumbnailPath: string): void {
    this.cards.get(tabId)?.updateThumbnail(thumbnailPath)
  }

  removeCard(tabId: number): void {
    const card = this.cards.get(tabId)
    if (card) {
      card.render().remove()
      this.cards.delete(tabId)
    }
  }

  render(): HTMLElement {
    return this.el
  }
}

export interface Tab {
  id: number
  collection_id: number | null
  url: string
  title: string
  domain: string
  thumbnail_path: string | null
  favicon_url: string | null
  pinned: number
  sort_order: number
  chrome_profile_dir: string | null
  chrome_profile_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Collection {
  id: number
  name: string
  color: string
  icon: string
  sort_order: number
  created_at: string
  updated_at: string
  tab_count?: number
}

export interface CreateTabInput {
  url: string
  title: string
  collection_id?: number | null
  chrome_profile_dir?: string | null
  chrome_profile_name?: string | null
}

export interface CreateCollectionInput {
  name: string
  color?: string
  icon?: string
}

export interface ChromeTab {
  url: string
  title: string
  profileDir?: string
  profileName?: string
}

export interface ChromeProfile {
  dir: string
  name: string
  email: string | null
}

export interface ThumbnailProgress {
  tabId: number
  completed: number
  total: number
}

export interface ElectronAPI {
  tabs: {
    getAll(filter?: { collectionId?: number; search?: string }): Promise<Tab[]>
    create(tab: CreateTabInput): Promise<Tab>
    createMany(tabs: CreateTabInput[], collectionId?: number | null): Promise<Tab[]>
    update(id: number, fields: Partial<Tab>): Promise<Tab>
    delete(id: number): Promise<void>
    search(query: string): Promise<Tab[]>
    openInChrome(url: string, profileDir?: string | null): Promise<void>
    captureThumbnail(tabId: number): Promise<{ thumbnailPath: string }>
    captureAllThumbnails(tabIds: number[]): Promise<void>
  }
  collections: {
    getAll(): Promise<Collection[]>
    create(input: CreateCollectionInput): Promise<Collection>
    update(id: number, fields: Partial<Collection>): Promise<Collection>
    delete(id: number): Promise<void>
  }
  chrome: {
    importTabs(): Promise<ChromeTab[]>
    getProfiles(): Promise<ChromeProfile[]>
    closeTabs(urls: string[]): Promise<number>
  }
  favicon: {
    getCached(domain: string): Promise<string | null>
    isFailed(domain: string): Promise<boolean>
    download(domain: string): Promise<string | null>
    downloadBatch(domains: string[]): Promise<Record<string, string | null>>
  }
  storage: {
    isICloud(): Promise<boolean>
  }
  on(channel: string, callback: (...args: unknown[]) => void): () => void
  getThumbnailPath(relativePath: string): string
  getFaviconPath(relativePath: string): string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

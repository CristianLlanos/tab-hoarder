import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ChromeTab, ChromeProfile } from '../shared/types'

const exec = promisify(execFile)

const CHROME_DATA_DIR = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome')

export function getChromeProfiles(): ChromeProfile[] {
  try {
    const localState = JSON.parse(readFileSync(join(CHROME_DATA_DIR, 'Local State'), 'utf-8'))
    const infoCache = localState?.profile?.info_cache ?? {}

    return Object.entries(infoCache).map(([dir, info]: [string, any]) => ({
      dir,
      name: info.name || info.user_name || dir,
      email: info.user_name || info.email || null,
    }))
  } catch (error) {
    console.error('Failed to read Chrome profiles:', error)
    return []
  }
}

function getProfileTabUrls(profileDir: string): Set<string> {
  const urls = new Set<string>()
  const sessionsDir = join(CHROME_DATA_DIR, profileDir, 'Sessions')

  try {
    const files = readdirSync(sessionsDir)
      .filter(f => f.startsWith('Session_'))
      .map(f => ({
        name: f,
        mtime: statSync(join(sessionsDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime)

    // Read the 2 most recent session files for better coverage
    const filesToRead = files.slice(0, 2)

    for (const file of filesToRead) {
      try {
        const buffer = readFileSync(join(sessionsDir, file.name))
        // Extract URLs from binary SNSS data — URLs are stored as readable strings
        const content = buffer.toString('latin1')
        const urlRegex = /https?:\/\/[^\s\x00-\x1f"<>\\^`{|}]+/g
        let match
        while ((match = urlRegex.exec(content)) !== null) {
          try {
            // Normalize URL to improve matching
            const url = new URL(match[0]).href
            urls.add(url)
          } catch {
            urls.add(match[0])
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Sessions dir may not exist for some profiles
  }

  return urls
}

function buildProfileUrlMap(profiles: ChromeProfile[]): Map<string, { dir: string; name: string }> {
  const urlMap = new Map<string, { dir: string; name: string }>()

  for (const profile of profiles) {
    const urls = getProfileTabUrls(profile.dir)
    for (const url of urls) {
      // First profile to claim a URL wins (most recent session files read first)
      if (!urlMap.has(url)) {
        urlMap.set(url, { dir: profile.dir, name: profile.name })
      }
    }
  }

  return urlMap
}

export async function getChromeTabs(): Promise<ChromeTab[]> {
  const script = `
    set output to ""
    tell application "Google Chrome"
      repeat with w in windows
        repeat with t in tabs of w
          set output to output & URL of t & "\\t" & title of t & "\\n"
        end repeat
      end repeat
    end tell
    return output
  `

  try {
    // Get profiles and build URL→profile map
    const profiles = getChromeProfiles()
    const profileUrlMap = buildProfileUrlMap(profiles)

    const { stdout } = await exec('osascript', ['-e', script], { timeout: 15000 })
    return stdout
      .trim()
      .split('\n')
      .filter(line => line.includes('\t'))
      .map(line => {
        const tabIndex = line.indexOf('\t')
        const url = line.substring(0, tabIndex)
        const title = line.substring(tabIndex + 1)

        // Match tab URL to a profile
        let profileMatch: { dir: string; name: string } | undefined

        // Try exact match first
        try {
          const normalizedUrl = new URL(url).href
          profileMatch = profileUrlMap.get(normalizedUrl)
        } catch {
          profileMatch = profileUrlMap.get(url)
        }

        // If no exact match, try origin-based matching (fallback)
        if (!profileMatch) {
          try {
            const origin = new URL(url).origin
            for (const [sessionUrl, profile] of profileUrlMap) {
              if (sessionUrl.startsWith(origin)) {
                profileMatch = profile
                break
              }
            }
          } catch {
            // skip
          }
        }

        return {
          url,
          title,
          profileDir: profileMatch?.dir,
          profileName: profileMatch?.name,
        }
      })
      .filter(tab => !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'))
  } catch (error) {
    console.error('Failed to read Chrome tabs:', error)
    throw new Error('Could not read Chrome tabs. Make sure Chrome is running and Tab Hoarder has Automation permission in System Settings > Privacy & Security > Automation.')
  }
}

export async function openInChromeProfile(url: string, profileDir?: string | null): Promise<void> {
  if (profileDir) {
    await exec('open', ['-na', 'Google Chrome', '--args', `--profile-directory=${profileDir}`, url])
  } else {
    // Fallback: open in default browser
    const { shell } = await import('electron')
    shell.openExternal(url)
  }
}

export async function closeChromeTabs(urls: string[]): Promise<number> {
  // Build an AppleScript list of URLs for exact matching
  const escapedUrls = urls.map(u => `"${u.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
  const urlListLiteral = `{${escapedUrls.join(', ')}}`

  const script = `
    set urlsToClose to ${urlListLiteral}
    set closedCount to 0

    tell application "Google Chrome"
      repeat with w in windows
        set tabCount to count of tabs of w
        repeat with i from tabCount to 1 by -1
          set tabURL to URL of tab i of w
          if urlsToClose contains tabURL then
            delete tab i of w
            set closedCount to closedCount + 1
          end if
        end repeat
      end repeat
    end tell

    return closedCount as text
  `

  try {
    const { stdout } = await exec('osascript', ['-e', script], { timeout: 60000 })
    return parseInt(stdout.trim(), 10) || 0
  } catch (error) {
    console.error('Failed to close Chrome tabs:', error)
    throw new Error('Could not close Chrome tabs. Make sure Chrome is running and permissions are granted.')
  }
}

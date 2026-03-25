type ToastType = 'success' | 'error' | 'info'

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

let container: HTMLElement | null = null

function getContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  return container
}

export function showToast(message: string, type: ToastType = 'info', duration = 3000): void {
  const toast = document.createElement('div')
  toast.className = `glass-toast glass-toast--${type}`
  toast.innerHTML = `<span>${ICONS[type]}</span><span>${message}</span>`

  getContainer().appendChild(toast)

  setTimeout(() => {
    toast.style.animation = `toast-out var(--duration-normal) var(--ease-smooth) forwards`
    toast.addEventListener('animationend', () => toast.remove())
  }, duration)
}

import { createCollection } from '../services/api'
import { showToast } from './Toast'

const COLORS = ['#007AFF', '#30D158', '#FF453A', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A']

export class CollectionForm {
  private el: HTMLElement
  private onCreated: () => void

  constructor(onCreated: () => void) {
    this.onCreated = onCreated

    this.el = document.createElement('div')
    this.el.className = 'glass-overlay animate-fade-in'
    this.el.innerHTML = `
      <div class="glass-modal animate-modal-in" style="max-width: 420px">
        <div class="glass-modal__header">
          <h2 class="glass-modal__title">New Collection</h2>
          <button class="glass-button collection-form__close">✕</button>
        </div>
        <div class="glass-modal__body">
          <div class="collection-form__field">
            <label class="collection-form__label">Name</label>
            <input type="text" class="glass-input collection-form__name" placeholder="e.g. Work, Learning, Shopping..." />
          </div>
          <div class="collection-form__field">
            <label class="collection-form__label">Color</label>
            <div class="collection-form__colors">
              ${COLORS.map((c, i) => `
                <button class="collection-form__color ${i === 0 ? 'collection-form__color--selected' : ''}"
                        style="background: ${c}" data-color="${c}"></button>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="glass-modal__footer">
          <button class="glass-button collection-form__cancel">Cancel</button>
          <button class="glass-button glass-button--accent collection-form__create">Create</button>
        </div>
      </div>
    `

    const style = document.createElement('style')
    style.textContent = `
      .collection-form__field {
        margin-bottom: 20px;
      }
      .collection-form__label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .collection-form__colors {
        display: flex;
        gap: 10px;
      }
      .collection-form__color {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid transparent;
        cursor: pointer;
        transition: all var(--duration-fast) var(--ease-smooth);
      }
      .collection-form__color:hover {
        transform: scale(1.15);
      }
      .collection-form__color--selected {
        border-color: white;
        box-shadow: 0 0 12px rgba(255,255,255,0.3);
      }
    `
    this.el.appendChild(style)

    // Events
    let selectedColor = COLORS[0]

    this.el.querySelectorAll('.collection-form__color').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('.collection-form__color').forEach(b => b.classList.remove('collection-form__color--selected'))
        btn.classList.add('collection-form__color--selected')
        selectedColor = (btn as HTMLElement).dataset.color!
      })
    })

    this.el.querySelector('.collection-form__close')!.addEventListener('click', () => this.close())
    this.el.querySelector('.collection-form__cancel')!.addEventListener('click', () => this.close())
    this.el.querySelector('.collection-form__create')!.addEventListener('click', async () => {
      const name = (this.el.querySelector('.collection-form__name') as HTMLInputElement).value.trim()
      if (!name) return showToast('Name is required', 'error')

      await createCollection({ name, color: selectedColor })
      showToast(`Created "${name}"`, 'success')
      this.onCreated()
      this.close()
    })

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close()
    })

    // Enter key
    this.el.querySelector('.collection-form__name')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        (this.el.querySelector('.collection-form__create') as HTMLElement).click()
      }
    })
  }

  private close(): void {
    this.el.style.opacity = '0'
    this.el.style.transition = 'opacity 0.2s ease'
    setTimeout(() => this.el.remove(), 200)
  }

  show(): void {
    document.body.appendChild(this.el)
    setTimeout(() => {
      (this.el.querySelector('.collection-form__name') as HTMLInputElement).focus()
    }, 100)
  }
}

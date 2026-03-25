import './styles/global.css'
import './styles/glass.css'
import './styles/animations.css'
import { App } from './components/App'

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app')
  if (root) {
    new App(root)
  }
})

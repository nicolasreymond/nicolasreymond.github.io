import './style.css'

import { bootstrapApp } from './app'

const app = document.querySelector<HTMLDivElement>('#app')

if (app === null) {
  throw new Error('Application root not found')
}

(async () => {
  await bootstrapApp(app)

  const themeToggle = document.createElement('button')
  themeToggle.classList.add('theme-toggle')
  themeToggle.setAttribute('aria-label', 'Toggle theme')
  themeToggle.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  `
  document.body.appendChild(themeToggle)

  const savedTheme = localStorage.getItem('theme') ?? 'light'
  document.documentElement.setAttribute('data-theme', savedTheme)

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme')
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  })
})()

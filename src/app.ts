import type { CalculatorState, Module, OrientationId, SemesterId, Unit } from './types'
import {
  ORIENTATIONS,
  SEMESTER_LABELS,
  getModulesBySemester,
  getSemestersForOrientation,
} from './curriculum'
import {
  formatGrade,
  moduleGrade,
  moduleStatus,
  requiredExamGrade,
  semesterAverage,
  unitGrade,
  unitGradeRange,
} from './calculator'
import { renderCourseGraph } from './graph'
import { loadState, resetState, sanitizeState, saveState } from './storage'

const COMPONENT_ORDER: Array<Unit['components'][number]['key']> = ['cours', 'labo', 'examen', 'projet']

/** Recalcule les nœuds d'affichage d'une vue sans reconstruire les champs de saisie. */
type Updater = () => void

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function bootstrapApp(root: HTMLElement): void {
  let state = loadState()

  root.innerHTML = `
    <div class="app-shell">
      <header class="hero">
        <p class="eyebrow">HEIG-VD</p>
        <h1>Calculateur de notes</h1>
        <p class="hero-text">Saisis tes notes par semestre et vois la note d'examen à viser.</p>
        <label class="field orientation-field">
          <span>Orientation</span>
          <select id="orientationSelect" class="input"></select>
        </label>
        <div class="action-row">
          <button id="exportButton" class="btn-secondary" type="button">Exporter JSON</button>
          <label class="btn-secondary import-label">
            Importer JSON
            <input id="importInput" type="file" accept="application/json" hidden>
          </label>
          <button id="resetButton" class="btn-secondary" type="button">Réinitialiser</button>
        </div>
      </header>
      <section class="panel graph-panel">
        <div class="panel-header"><h2>Plan d'études</h2></div>
        <div id="courseGraph" class="course-graph"></div>
      </section>
      <main id="semesterView" class="semester-view"></main>
    </div>
  `

  const orientationSelect = root.querySelector<HTMLSelectElement>('#orientationSelect')!
  const graphMount = root.querySelector<HTMLDivElement>('#courseGraph')!
  const semesterView = root.querySelector<HTMLElement>('#semesterView')!
  const exportButton = root.querySelector<HTMLButtonElement>('#exportButton')!
  const importInput = root.querySelector<HTMLInputElement>('#importInput')!
  const resetButton = root.querySelector<HTMLButtonElement>('#resetButton')!

  orientationSelect.innerHTML = ORIENTATIONS.map(
    (o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`,
  ).join('')
  orientationSelect.value = state.selectedOrientation

  // Updaters recompute display-only nodes after a grade/target edit, leaving the
  // focused <input> untouched (so focus and partially-typed decimals survive).
  let updaters: Updater[] = []

  function refreshComputed(): void {
    saveState(state)
    for (const update of updaters) update()
    graphMount.replaceChildren(renderCourseGraph({ state, onSelectSemester: selectSemester }))
  }

  function renderAll(): void {
    saveState(state)
    updaters = []
    graphMount.replaceChildren(renderCourseGraph({ state, onSelectSemester: selectSemester }))
    renderSemester(semesterView, state, updaters, refreshComputed)
  }

  function selectSemester(semester: SemesterId): void {
    state.selectedSemester = semester
    renderAll()
  }

  orientationSelect.addEventListener('change', () => {
    state.selectedOrientation = orientationSelect.value as OrientationId
    const semesters = getSemestersForOrientation(state.selectedOrientation)
    if (!semesters.includes(state.selectedSemester)) {
      state.selectedSemester = semesters[0]
    }
    renderAll()
  })

  exportButton.addEventListener('click', () => exportJson(state))

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0]
    if (!file) return
    try {
      state = await readStateFromFile(file)
      orientationSelect.value = state.selectedOrientation
      renderAll()
    } catch {
      window.alert('Fichier JSON invalide.')
    } finally {
      importInput.value = ''
    }
  })

  resetButton.addEventListener('click', () => {
    if (!window.confirm('Effacer toutes les notes enregistrées ?')) return
    state = resetState()
    orientationSelect.value = state.selectedOrientation
    renderAll()
  })

  renderAll()
}

function renderSemester(mount: HTMLElement, state: CalculatorState, updaters: Updater[], refresh: Updater): void {
  const modules = getModulesBySemester(state.selectedOrientation, state.selectedSemester)

  const container = document.createElement('div')
  container.className = 'semester-panel'
  container.innerHTML = `
    <div class="panel-header">
      <h2>${escapeHtml(SEMESTER_LABELS[state.selectedSemester])}</h2>
      <span class="scale">Moyenne semestre : <strong class="semester-average">--</strong></span>
    </div>
  `

  const averageEl = container.querySelector<HTMLElement>('.semester-average')!
  updaters.push(() => {
    averageEl.textContent = formatGrade(semesterAverage(modules, state.gradesByUnit))
  })

  for (const module of modules) {
    container.append(renderModule(module, state, updaters, refresh))
  }

  mount.replaceChildren(container)
}

function renderModule(module: Module, state: CalculatorState, updaters: Updater[], refresh: Updater): HTMLElement {
  const section = document.createElement('section')
  section.className = 'panel module-panel'
  section.innerHTML = `
    <div class="panel-header">
      <h3>${escapeHtml(module.id)} — ${escapeHtml(module.name)}</h3>
      <span class="module-meta">
        <span class="badge">--</span>
        <span class="ects">${module.ects} ECTS</span>
        <strong class="module-grade">--</strong>
      </span>
    </div>
  `

  const badgeEl = section.querySelector<HTMLElement>('.badge')!
  const gradeEl = section.querySelector<HTMLElement>('.module-grade')!
  updaters.push(() => {
    const status = moduleStatus(module, state.gradesByUnit)
    badgeEl.className = `badge badge-${status}`
    badgeEl.textContent = statusLabel(status)
    gradeEl.textContent = formatGrade(moduleGrade(module, state.gradesByUnit))
    section.classList.toggle('module-reussi', status === 'reussi')
    section.classList.toggle('module-echec', status === 'echec')
  })

  if (module.units.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'Module à choix : aucune unité prédéfinie.'
    section.append(empty)
    return section
  }

  for (const unit of module.units) {
    section.append(renderUnit(unit, state, updaters, refresh))
  }
  return section
}

function statusLabel(status: ReturnType<typeof moduleStatus>): string {
  if (status === 'reussi') return 'Réussi'
  if (status === 'echec') return 'Échec'
  return 'Incomplet'
}

function renderUnit(unit: Unit, state: CalculatorState, updaters: Updater[], refresh: Updater): HTMLElement {
  const article = document.createElement('article')
  article.className = 'unit-card'

  const title = document.createElement('div')
  title.className = 'unit-title'
  title.innerHTML = `<span>${escapeHtml(unit.id)} — ${escapeHtml(unit.name)}</span>
    <strong class="unit-grade">--</strong>`
  article.append(title)

  const gradeEl = title.querySelector<HTMLElement>('.unit-grade')!
  updaters.push(() => {
    gradeEl.textContent = formatGrade(unitGrade(unit, state.gradesByUnit[unit.id] ?? {}))
  })

  const fields = document.createElement('div')
  fields.className = 'unit-fields'
  for (const key of COMPONENT_ORDER) {
    const component = unit.components.find((c) => c.key === key)
    if (!component) continue
    const value = (state.gradesByUnit[unit.id] ?? {})[key]
    const label = document.createElement('label')
    label.className = 'field'
    label.innerHTML = `<span>${escapeHtml(component.label)} (${Math.round(component.weight * 100)}%)</span>`
    const input = document.createElement('input')
    input.className = 'input note-input'
    input.type = 'number'
    input.min = '0'
    input.max = '6'
    input.step = '0.1'
    input.value = value === null || value === undefined ? '' : String(value)
    input.addEventListener('input', () => {
      const next = state.gradesByUnit[unit.id] ?? {}
      next[key] = input.value === '' ? null : Number.parseFloat(input.value)
      state.gradesByUnit[unit.id] = next
      refresh()
    })
    label.append(input)
    fields.append(label)
  }
  article.append(fields)

  if (unit.hasExam) {
    article.append(renderExamHint(unit, state, updaters, refresh))
  }
  return article
}

function renderExamHint(unit: Unit, state: CalculatorState, updaters: Updater[], refresh: Updater): HTMLElement {
  const box = document.createElement('div')
  box.className = 'exam-hint'

  const targetLabel = document.createElement('label')
  targetLabel.className = 'field target-field'
  targetLabel.innerHTML = '<span>Objectif unité</span>'
  const targetInput = document.createElement('input')
  targetInput.className = 'input'
  targetInput.type = 'number'
  targetInput.min = '0'
  targetInput.max = '6'
  targetInput.step = '0.1'
  targetInput.value = String(state.targetByUnit[unit.id] ?? 4)
  targetInput.addEventListener('input', () => {
    const parsed = Number.parseFloat(targetInput.value)
    state.targetByUnit[unit.id] = Number.isFinite(parsed) ? parsed : 4
    refresh()
  })
  targetLabel.append(targetInput)
  box.append(targetLabel)

  const result = document.createElement('div')
  result.className = 'exam-result'
  box.append(result)

  const rangeEl = document.createElement('p')
  rangeEl.className = 'unit-range'
  box.append(rangeEl)

  updaters.push(() => {
    const grades = state.gradesByUnit[unit.id] ?? {}
    const target = state.targetByUnit[unit.id] ?? 4
    result.innerHTML = examMessage(requiredExamGrade(unit, grades, target), target)
    const range = unitGradeRange(unit, grades)
    rangeEl.textContent = `Fourchette possible : ${formatGrade(range.min)} – ${formatGrade(range.max)}`
  })

  return box
}

function examMessage(required: number | null, target: number): string {
  if (required === null) {
    return '<span class="result-help">Saisis les notes de contrôle continu pour calculer l\'examen à viser.</span>'
  }
  if (required <= 0) {
    return `<strong>Déjà atteint</strong><span class="result-help">Objectif ${target.toFixed(2)} atteint même sans l'examen.</span>`
  }
  if (required > 6) {
    return `<strong>Impossible</strong><span class="result-help">Même avec 6,00 à l'examen, l'objectif ${target.toFixed(2)} n'est pas atteignable.</span>`
  }
  return `<strong>${required.toFixed(2)}/6 à l'examen</strong><span class="result-help">pour atteindre ${target.toFixed(2)} dans l'unité.</span>`
}

function exportJson(state: CalculatorState): void {
  const payload: import('./types').ExportPayload = {
    exportedAt: new Date().toISOString(),
    scale: 6,
    state,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `notes_heigvd_${state.selectedOrientation.toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function readStateFromFile(file: File): Promise<CalculatorState> {
  const text = await file.text()
  const parsed = JSON.parse(text) as { state?: unknown }
  if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) {
    throw new Error('Payload invalide')
  }
  return sanitizeState(parsed.state)
}

import { getModulesBySemester, getSemestersForOrientation, SEMESTER_LABELS } from './curriculum'
import { moduleStatus } from './calculator'
import type { CalculatorState, SemesterId } from './types'

export interface GraphRenderOptions {
  state: CalculatorState
  onSelectSemester: (semester: SemesterId) => void
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  return element
}

export function renderCourseGraph(options: GraphRenderOptions): HTMLElement {
  const { state, onSelectSemester } = options
  const container = createElement('div', 'graph-canvas')
  const grid = createElement('div', 'semester-grid')

  for (const semester of getSemestersForOrientation(state.selectedOrientation)) {
    const column = createElement('div', 'semester-column')
    if (semester === state.selectedSemester) column.classList.add('active')

    const header = createElement('button', 'semester-header')
    header.type = 'button'
    header.textContent = SEMESTER_LABELS[semester]
    header.addEventListener('click', () => onSelectSemester(semester))
    column.append(header)

    const list = createElement('div', 'course-list')
    for (const module of getModulesBySemester(state.selectedOrientation, semester)) {
      const status = moduleStatus(module, state.gradesByUnit)
      const chip = createElement('button', 'course-item')
      chip.type = 'button'
      chip.textContent = module.id
      chip.title = module.name
      if (status === 'reussi') chip.classList.add('validated')
      else if (status === 'echec') chip.classList.add('failed')
      chip.addEventListener('click', () => onSelectSemester(semester))
      list.append(chip)
    }
    column.append(list)
    grid.append(column)
  }

  container.append(grid)
  return container
}

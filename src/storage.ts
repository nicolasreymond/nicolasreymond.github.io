import type { CalculatorState, OrientationId, SemesterId } from './types'

const STORAGE_KEY = 'heigvdGradeCalculatorState_v2'

function defaultState(): CalculatorState {
  return {
    selectedOrientation: 'ISCS',
    selectedSemester: 'S1',
    gradesByUnit: {},
    targetByUnit: {},
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function loadState(): CalculatorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed)) return defaultState()
    return {
      selectedOrientation: (parsed.selectedOrientation as OrientationId) ?? 'ISCS',
      selectedSemester: (parsed.selectedSemester as SemesterId) ?? 'S1',
      gradesByUnit: isObject(parsed.gradesByUnit) ? (parsed.gradesByUnit as CalculatorState['gradesByUnit']) : {},
      targetByUnit: isObject(parsed.targetByUnit) ? (parsed.targetByUnit as Record<string, number>) : {},
    }
  } catch {
    return defaultState()
  }
}

export function saveState(state: CalculatorState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetState(): CalculatorState {
  localStorage.removeItem(STORAGE_KEY)
  return defaultState()
}

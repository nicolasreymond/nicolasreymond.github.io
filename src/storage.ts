import type { CalculatorState, ComponentKey, OrientationId, SemesterId, UnitGrades } from './types'

const STORAGE_KEY = 'heigvdGradeCalculatorState_v2'

const ORIENTATIONS: OrientationId[] = ['ISCS', 'ISCL']
const SEMESTERS: SemesterId[] = ['S1', 'S2', 'E2', 'S3', 'S4', 'E3', 'S5', 'S6', 'S7', 'S8']
const COMPONENT_KEYS: ComponentKey[] = ['cours', 'labo', 'examen', 'projet']

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

/**
 * Construit un CalculatorState valide à partir d'une valeur inconnue (localStorage
 * ou fichier importé). Toute valeur invalide est ignorée ou remplacée par un
 * défaut, de sorte que le reste de l'app ne reçoit jamais de note non numérique.
 */
export function sanitizeState(raw: unknown): CalculatorState {
  const state = defaultState()
  if (!isObject(raw)) return state

  if (typeof raw.selectedOrientation === 'string' && ORIENTATIONS.includes(raw.selectedOrientation as OrientationId)) {
    state.selectedOrientation = raw.selectedOrientation as OrientationId
  }
  if (typeof raw.selectedSemester === 'string' && SEMESTERS.includes(raw.selectedSemester as SemesterId)) {
    state.selectedSemester = raw.selectedSemester as SemesterId
  }

  if (isObject(raw.gradesByUnit)) {
    for (const [unitId, components] of Object.entries(raw.gradesByUnit)) {
      if (!isObject(components)) continue
      const clean: UnitGrades = {}
      for (const key of COMPONENT_KEYS) {
        const value = components[key]
        if (value === null) {
          clean[key] = null
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          clean[key] = value
        }
      }
      state.gradesByUnit[unitId] = clean
    }
  }

  if (isObject(raw.targetByUnit)) {
    for (const [unitId, value] of Object.entries(raw.targetByUnit)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        state.targetByUnit[unitId] = value
      }
    }
  }

  return state
}

export function loadState(): CalculatorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return sanitizeState(JSON.parse(raw))
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

export type ComponentKey = 'cours' | 'labo' | 'examen' | 'projet'

export type SemesterId = 'S1' | 'S2' | 'E2' | 'S3' | 'S4' | 'E3' | 'S5' | 'S6'

export type OrientationId = 'ISCS'

export type ModuleStatus = 'reussi' | 'echec' | 'incomplet'

export interface UnitComponent {
  key: ComponentKey
  label: string
  weight: number
}

export interface Unit {
  id: string
  name: string
  coef: number
  components: UnitComponent[]
  hasExam: boolean
}

export interface Module {
  id: string
  name: string
  ects: number
  semester: SemesterId
  orientation: 'common' | OrientationId
  compensationThreshold: number
  repetitionThreshold: number | null
  units: Unit[]
  isElective?: boolean
}

export interface Orientation {
  id: OrientationId
  name: string
}

export type UnitGrades = Partial<Record<ComponentKey, number | null>>

export interface CalculatorState {
  selectedOrientation: OrientationId
  selectedSemester: SemesterId
  gradesByUnit: Record<string, UnitGrades>
  targetByUnit: Record<string, number>
}

export interface ExportPayload {
  exportedAt: string
  scale: number
  state: CalculatorState
}

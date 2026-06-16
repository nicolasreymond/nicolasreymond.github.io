import type { Module, ModuleStatus, Unit, UnitGrades } from './types'

export function clampGrade(value: number): number {
  return Math.min(6, Math.max(0, value))
}

export function formatGrade(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '--'
  }
  return value.toFixed(2).replace('.', ',')
}

function examWeight(unit: Unit): number {
  return unit.components.find((c) => c.key === 'examen')?.weight ?? 0
}

/** Somme des composantes non-examen pondérées. null si une est manquante. */
export function continuousContribution(unit: Unit, grades: UnitGrades): number | null {
  let sum = 0
  for (const component of unit.components) {
    if (component.key === 'examen') continue
    const value = grades[component.key]
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null
    }
    sum += value * component.weight
  }
  return sum
}

/** Note d'unité complète. null si une composante (poids > 0) est manquante. */
export function unitGrade(unit: Unit, grades: UnitGrades): number | null {
  let sum = 0
  for (const component of unit.components) {
    const value = grades[component.key]
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null
    }
    sum += value * component.weight
  }
  return clampGrade(sum)
}

/** Note d'examen à viser pour atteindre `target`. null si pas d'examen ou continu incomplet. */
export function requiredExamGrade(unit: Unit, grades: UnitGrades, target: number): number | null {
  const weight = examWeight(unit)
  if (weight <= 0) return null
  const continuous = continuousContribution(unit, grades)
  if (continuous === null) return null
  return clampGrade((target - continuous) / weight)
}

/** Note finale prévue avec une hypothèse d'examen. null si continu incomplet. */
export function projectedUnitGrade(unit: Unit, grades: UnitGrades, examHypothesis: number): number | null {
  const continuous = continuousContribution(unit, grades)
  if (continuous === null) return null
  return clampGrade(continuous + examWeight(unit) * examHypothesis)
}

/** Fourchette de note d'unité possible : composantes vides variant de 0 à 6. */
export function unitGradeRange(unit: Unit, grades: UnitGrades): { min: number; max: number } {
  let base = 0
  let missingWeight = 0
  for (const component of unit.components) {
    const value = grades[component.key]
    if (value === null || value === undefined || !Number.isFinite(value)) {
      missingWeight += component.weight
    } else {
      base += value * component.weight
    }
  }
  return { min: clampGrade(base), max: clampGrade(base + 6 * missingWeight) }
}

/** Note de module = moyenne des notes d'unités pondérée par coef. null si incomplet. */
export function moduleGrade(module: Module, gradesByUnit: Record<string, UnitGrades>): number | null {
  if (module.units.length === 0) return null
  let weighted = 0
  let totalCoef = 0
  for (const unit of module.units) {
    const grade = unitGrade(unit, gradesByUnit[unit.id] ?? {})
    if (grade === null) return null
    weighted += grade * unit.coef
    totalCoef += unit.coef
  }
  if (totalCoef === 0) return null
  return weighted / totalCoef
}

export function moduleStatus(module: Module, gradesByUnit: Record<string, UnitGrades>): ModuleStatus {
  if (module.units.length === 0) return 'incomplet'
  const unitValues: number[] = []
  for (const unit of module.units) {
    const grade = unitGrade(unit, gradesByUnit[unit.id] ?? {})
    if (grade === null) return 'incomplet'
    unitValues.push(grade)
  }
  if (unitValues.some((g) => g < module.compensationThreshold)) return 'echec'
  const average = moduleGrade(module, gradesByUnit)
  if (average === null) return 'incomplet'
  if (module.repetitionThreshold !== null && average < module.repetitionThreshold) return 'echec'
  return 'reussi'
}

/** Moyenne pondérée ECTS des modules complets. null si aucun. */
export function semesterAverage(modules: Module[], gradesByUnit: Record<string, UnitGrades>): number | null {
  let weighted = 0
  let totalEcts = 0
  for (const module of modules) {
    const grade = moduleGrade(module, gradesByUnit)
    if (grade === null) continue
    weighted += grade * module.ects
    totalEcts += module.ects
  }
  if (totalEcts === 0) return null
  return weighted / totalEcts
}

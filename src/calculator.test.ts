import { describe, expect, it } from 'vitest'
import {
  clampGrade,
  formatGrade,
  unitGrade,
  continuousContribution,
  requiredExamGrade,
  projectedUnitGrade,
  unitGradeRange,
  moduleGrade,
  moduleStatus,
  semesterAverage,
} from './calculator'
import { getModuleById } from './curriculum'
import type { Module } from './types'

const CAS = getModuleById('ISCS', 'CAS') as Module
const DML = getModuleById('ISCS', 'DML') as Module
const SLH = DML.units.find((u) => u.id === 'SLH')!
const CRY = CAS.units.find((u) => u.id === 'CRY')!
const ASM = CAS.units.find((u) => u.id === 'ASM')!

describe('clampGrade', () => {
  it('borne entre 0 et 6', () => {
    expect(clampGrade(-1)).toBe(0)
    expect(clampGrade(7)).toBe(6)
    expect(clampGrade(4.2)).toBe(4.2)
  })
})

describe('formatGrade', () => {
  it('formate avec virgule et 2 décimales', () => {
    expect(formatGrade(4.5)).toBe('4,50')
    expect(formatGrade(null)).toBe('--')
  })
})

describe('unitGrade', () => {
  it('combine les composantes par poids (SLH 0.25/0.25/0.5)', () => {
    expect(unitGrade(SLH, { cours: 4, labo: 4, examen: 6 })).toBeCloseTo(5, 5)
  })
  it('retourne null si une composante manque', () => {
    expect(unitGrade(SLH, { cours: 4, labo: 4 })).toBeNull()
  })
})

describe('continuousContribution', () => {
  it('somme les composantes non-examen saisies', () => {
    expect(continuousContribution(SLH, { cours: 4, labo: 4 })).toBeCloseTo(2, 5)
  })
  it('retourne null si une composante non-examen manque', () => {
    expect(continuousContribution(SLH, { cours: 4 })).toBeNull()
  })
})

describe('requiredExamGrade', () => {
  it('calcule la note d examen à viser', () => {
    expect(requiredExamGrade(SLH, { cours: 4, labo: 4 }, 4)).toBeCloseTo(4, 5)
  })
  it('retourne null pour une unité sans examen', () => {
    expect(requiredExamGrade(ASM, { cours: 4, labo: 4 }, 4)).toBeNull()
  })
})

describe('projectedUnitGrade', () => {
  it('prédit la note finale avec une hypothèse d examen', () => {
    expect(projectedUnitGrade(SLH, { cours: 4, labo: 4 }, 6)).toBeCloseTo(5, 5)
  })
})

describe('unitGradeRange', () => {
  it('borne min/max avec l examen manquant (0..6)', () => {
    const range = unitGradeRange(SLH, { cours: 4, labo: 4 })
    expect(range.min).toBeCloseTo(2, 5)
    expect(range.max).toBeCloseTo(5, 5)
  })
})

describe('moduleGrade', () => {
  it('pondère les unités par coef (CAS = (150·CRY+90·ASM)/240)', () => {
    const grades = {
      CRY: { cours: 5, labo: 5, examen: 5 },
      ASM: { cours: 4, labo: 4 },
    }
    expect(moduleGrade(CAS, grades)).toBeCloseTo((150 * 5 + 90 * 4) / 240, 5)
  })
  it('retourne null si une unité est incomplète', () => {
    expect(moduleGrade(CAS, { CRY: { cours: 5, labo: 5, examen: 5 }, ASM: { cours: 4 } })).toBeNull()
  })
})

describe('moduleStatus', () => {
  it('réussi si moyenne >= 4 et toutes unités >= 3', () => {
    const grades = { CRY: { cours: 5, labo: 5, examen: 5 }, ASM: { cours: 4, labo: 4 } }
    expect(moduleStatus(CAS, grades)).toBe('reussi')
  })
  it('échec par compensation si une unité < 3', () => {
    const grades = { CRY: { cours: 6, labo: 6, examen: 6 }, ASM: { cours: 2, labo: 2 } }
    expect(moduleStatus(CAS, grades)).toBe('echec')
  })
  it('échec par répétition si moyenne < 4', () => {
    const grades = { CRY: { cours: 3, labo: 3, examen: 3 }, ASM: { cours: 3.5, labo: 3.5 } }
    expect(moduleStatus(CAS, grades)).toBe('echec')
  })
  it('incomplet si données manquantes', () => {
    expect(moduleStatus(CAS, { CRY: { cours: 5 } })).toBe('incomplet')
  })
})

describe('semesterAverage', () => {
  it('moyenne pondérée ECTS des modules complets', () => {
    const modules = [CAS, DML]
    const grades = {
      CRY: { cours: 4, labo: 4, examen: 4 }, ASM: { cours: 4, labo: 4 }, // CAS = 4
      DAA: { cours: 5, labo: 5 }, SLH: { cours: 5, labo: 5, examen: 5 }, // DML = 5
    }
    // (8*4 + 8*5)/16 = 4.5
    expect(semesterAverage(modules, grades)).toBeCloseTo(4.5, 5)
  })
  it('retourne null si aucun module complet', () => {
    expect(semesterAverage([CAS], { CRY: { cours: 5 } })).toBeNull()
  })
})

# Calculateur de notes HEIG-VD (ISCS, multi-orientation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruire l'app de calcul de notes HEIG-VD autour du vrai plan d'études (modèle Orientation → Semestre → Module → Unité), avec saisie par semestre, calcul de la note d'examen à viser, note de module, statut de promotion et moyenne de semestre.

**Architecture:** Données pures dans `curriculum.ts` (source de vérité, multi-orientation, tronc commun + ISCS). Fonctions de calcul pures et testées dans `calculator.ts`. État persisté (localStorage + JSON) dans `storage.ts`. Rendu DOM impératif dans `app.ts` (vue par semestre) et `graph.ts` (carte de navigation). Pas de framework.

**Tech Stack:** TypeScript, Vite, Vitest (tests unitaires), DOM API natif.

Spec de référence : `docs/superpowers/specs/2026-06-16-calculateur-notes-iscs-design.md`.

---

## File Structure

- `src/types.ts` — modifié : types `Orientation`, `Module`, `Unit`, `UnitComponent`, `CalculatorState`, `ExportPayload`.
- `src/curriculum.ts` — **créé** (remplace `courseData.ts`) : données modules/unités/semestres + accesseurs.
- `src/calculator.ts` — réécrit : fonctions de calcul pures sur unités/modules/semestres.
- `src/calculator.test.ts` — **créé** : tests unitaires.
- `src/storage.ts` — réécrit : load/save `CalculatorState`, reset.
- `src/app.ts` — réécrit : vue par semestre, sélecteur d'orientation, saisie, résultats.
- `src/graph.ts` — modifié : carte des modules par semestre (navigation), statut coloré.
- `src/style.css` — modifié : styles vue semestre / module / unité / badges.
- `src/courseData.ts` — **supprimé**.
- `src/counter.ts` — **supprimé** (template Vite inutilisé).
- `package.json`, `tsconfig.json`, `vitest.config.ts` — modifiés/créés : outillage de test.

---

## Task 1: Outillage de test (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Installer Vitest**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` ajouté dans `devDependencies`, pas d'erreur.

- [ ] **Step 2: Ajouter le script de test**

Dans `package.json`, remplacer le bloc `scripts` par :
```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Créer la config Vitest**

Create `vitest.config.ts` :
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Exclure les tests du build tsc**

Dans `tsconfig.json`, ajouter une clé `exclude` à la racine de l'objet (après `include`) :
```json
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
```
(Garder le reste du fichier inchangé. Le `include` existe déjà — ajouter seulement la ligne `exclude`.)

- [ ] **Step 5: Vérifier que Vitest tourne (aucun test encore)**

Run: `npm test`
Expected: Vitest démarre et affiche « No test files found » (exit 0 ou message ; pas de crash de config).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json
git commit -m "chore: ajoute Vitest pour les tests unitaires"
```

---

## Task 2: Types du domaine

**Files:**
- Modify: `src/types.ts` (remplacer tout le contenu)

- [ ] **Step 1: Réécrire `src/types.ts`**

Remplacer **tout** le contenu de `src/types.ts` par :
```ts
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
```

- [ ] **Step 2: Vérifier la compilation des types**

Run: `npx tsc --noEmit`
Expected: erreurs uniquement dans les fichiers qui importent l'ancien modèle (`courseData.ts`, `calculator.ts`, `app.ts`, `graph.ts`, `storage.ts`) — elles seront résolues dans les tâches suivantes. Aucune erreur **dans** `types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: nouveaux types domaine (Module/Unit/Orientation)"
```

---

## Task 3: Données du curriculum

**Files:**
- Create: `src/curriculum.ts`

- [ ] **Step 1: Créer `src/curriculum.ts` avec les helpers de construction**

Create `src/curriculum.ts` :
```ts
import type {
  Module,
  Orientation,
  OrientationId,
  SemesterId,
  Unit,
  UnitComponent,
} from './types'

const COMPONENT_LABELS: Record<UnitComponent['key'], string> = {
  cours: 'Note cours',
  labo: 'Note laboratoire',
  examen: 'Note examen',
  projet: 'Note projet',
}

type ComponentSpec = Partial<Record<UnitComponent['key'], number>>

function makeUnit(id: string, name: string, coef: number, spec: ComponentSpec): Unit {
  const components: UnitComponent[] = (Object.keys(spec) as UnitComponent['key'][]).map((key) => ({
    key,
    label: COMPONENT_LABELS[key],
    weight: spec[key] as number,
  }))
  return {
    id,
    name,
    coef,
    components,
    hasExam: components.some((c) => c.key === 'examen'),
  }
}

interface ModuleSpec {
  id: string
  name: string
  ects: number
  semester: SemesterId
  orientation: 'common' | OrientationId
  units: Unit[]
  repetitionThreshold?: number | null
  isElective?: boolean
}

function makeModule(spec: ModuleSpec): Module {
  return {
    id: spec.id,
    name: spec.name,
    ects: spec.ects,
    semester: spec.semester,
    orientation: spec.orientation,
    compensationThreshold: 3.0,
    repetitionThreshold: spec.repetitionThreshold === undefined ? 4.0 : spec.repetitionThreshold,
    units: spec.units,
    isElective: spec.isElective,
  }
}

export const ORIENTATIONS: Orientation[] = [
  { id: 'ISCS', name: 'Sécurité informatique (ISCS)' },
]

export const SEMESTER_ORDER: SemesterId[] = ['S1', 'S2', 'E2', 'S3', 'S4', 'E3', 'S5', 'S6']

export const SEMESTER_LABELS: Record<SemesterId, string> = {
  S1: 'Semestre 1',
  S2: 'Semestre 2',
  E2: 'HES été 2',
  S3: 'Semestre 3',
  S4: 'Semestre 4',
  E3: 'HES été 3',
  S5: 'Semestre 5',
  S6: 'Semestre 6',
}
```

- [ ] **Step 2: Ajouter les modules du tronc commun (S1–S4, E2, E3, S6 commun)**

Ajouter à la fin de `src/curriculum.ts` :
```ts
const COMMON_MODULES: Module[] = [
  // S1
  makeModule({ id: 'MAT1', name: 'Mathématiques 1', ects: 8, semester: 'S1', orientation: 'common', units: [
    makeUnit('MAT1', 'Mathématiques 1', 150, { cours: 0.5, examen: 0.5 }),
    makeUnit('MAD', 'Mathématiques discrètes', 90, { cours: 0.5, examen: 0.5 }),
  ] }),
  makeModule({ id: 'PRG', name: 'Programmation', ects: 9, semester: 'S1', orientation: 'common', units: [
    makeUnit('PRG1', 'Programmation 1', 270, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  makeModule({ id: 'SLD', name: 'Systèmes logiques et science des données', ects: 8, semester: 'S1', orientation: 'common', units: [
    makeUnit('ISD', 'Introduction à la science des données', 120, { cours: 0.3, labo: 0.2, examen: 0.5 }),
    makeUnit('SYL', 'Systèmes logiques', 120, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  makeModule({ id: 'COM1', name: 'Communication 1', ects: 4, semester: 'S1', orientation: 'common', units: [
    makeUnit('ENG1', 'Anglais 1', 60, { cours: 1 }),
    makeUnit('EXP', 'Expression et communication', 60, { cours: 1 }),
  ] }),
  // S2
  makeModule({ id: 'ASD', name: 'Algorithmes et structures de données', ects: 6, semester: 'S2', orientation: 'common', units: [
    makeUnit('ASD', 'Algorithmes et structures de données', 180, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  makeModule({ id: 'ASI', name: 'Architecture et sécurité informatique', ects: 7, semester: 'S2', orientation: 'common', units: [
    makeUnit('ARO', 'Architectures des ordinateurs', 105, { cours: 0.3, labo: 0.2, examen: 0.5 }),
    makeUnit('ISI', "Introduction à la sécurité de l'information", 105, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  makeModule({ id: 'MAT2', name: 'Mathématiques 2', ects: 5, semester: 'S2', orientation: 'common', units: [
    makeUnit('MAT2', 'Mathématiques 2', 150, { cours: 0.5, examen: 0.5 }),
  ] }),
  makeModule({ id: 'PRI', name: 'Programmation et réseaux informatiques', ects: 7, semester: 'S2', orientation: 'common', units: [
    makeUnit('PRG2', 'Programmation 2', 105, { cours: 0.3, labo: 0.2, examen: 0.5 }),
    makeUnit('RXI', 'Réseaux informatiques', 105, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  // E2
  makeModule({ id: 'COM2', name: 'Communication 2', ects: 3, semester: 'E2', orientation: 'common', units: [
    makeUnit('ENG2', 'Anglais 2', 60, { cours: 1 }),
    makeUnit('DTS', 'Design thinking and sprint', 30, { projet: 1 }),
  ] }),
  makeModule({ id: 'PIN', name: "Projet d'informatique", ects: 3, semester: 'E2', orientation: 'common', units: [
    makeUnit('PIN', "Projet d'informatique", 90, { projet: 1 }),
  ] }),
  // S3
  makeModule({ id: 'BDA', name: 'Bases de données et applications internet', ects: 8, semester: 'S3', orientation: 'common', units: [
    makeUnit('BDR', 'Bases de données relationnelles', 150, { cours: 0.3, labo: 0.2, examen: 0.5 }),
    makeUnit('DAI', "Développement d'applications internet", 90, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  makeModule({ id: 'MAT3', name: 'Mathématiques 3', ects: 8, semester: 'S3', orientation: 'common', units: [
    makeUnit('MAT3', 'Mathématiques 3', 120, { cours: 1 }),
    makeUnit('PST', 'Probabilités et statistiques', 120, { cours: 1 }),
  ] }),
  makeModule({ id: 'POO', name: 'Programmation orientée objet', ects: 5, semester: 'S3', orientation: 'common', units: [
    makeUnit('POO', 'Programmation orientée objet', 150, { cours: 0.8, labo: 0.2 }),
  ] }),
  makeModule({ id: 'SEC', name: "Systèmes d'exploitation et concurrence", ects: 7, semester: 'S3', orientation: 'common', units: [
    makeUnit('PCO', 'Programmation concurrente', 105, { cours: 0.3, labo: 0.2, examen: 0.5 }),
    makeUnit('SYE', "Systèmes d'exploitation", 105, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  // S4
  makeModule({ id: 'CAS', name: 'Cryptographie et assembleur', ects: 8, semester: 'S4', orientation: 'common', units: [
    makeUnit('CRY', 'Cryptographie', 150, { cours: 0.3, labo: 0.2, examen: 0.5 }),
    makeUnit('ASM', 'Programmation assembleur', 90, { cours: 0.67, labo: 0.33 }),
  ] }),
  makeModule({ id: 'DLR', name: 'Développement logiciel et responsabilités', ects: 5, semester: 'S4', orientation: 'common', units: [
    makeUnit('EAL', 'Ethique et aspects légaux', 45, { cours: 1 }),
    makeUnit('PDL', 'Processus de développement en ingénierie logicielle', 105, { cours: 0.67, labo: 0.33 }),
  ] }),
  makeModule({ id: 'SRN', name: 'Sécurité des réseaux et réseaux des neurones', ects: 6, semester: 'S4', orientation: 'common', units: [
    makeUnit('ARN', 'Apprentissage par réseaux de neurones artificiels', 90, { cours: 0.3, labo: 0.2, examen: 0.5 }),
    makeUnit('SRX', 'Sécurité des réseaux', 90, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  makeModule({ id: 'TCW', name: 'Technologies Cloud et Web', ects: 8, semester: 'S4', orientation: 'common', units: [
    makeUnit('CLD', 'Cloud Computing', 90, { cours: 0.67, labo: 0.33 }),
    makeUnit('WEB', 'Technologies web', 150, { cours: 0.3, labo: 0.2, examen: 0.5 }),
  ] }),
  // E3
  makeModule({ id: 'PDG', name: 'Projet de groupe', ects: 6, semester: 'E3', orientation: 'common', units: [
    makeUnit('PDG', 'Projet de groupe', 180, { projet: 1 }),
  ] }),
  // S6 commun
  makeModule({ id: 'CRUNCH', name: 'Innovation Crunch Time', ects: 2, semester: 'S6', orientation: 'common', units: [
    makeUnit('CRH', 'Innovation Crunch Time', 60, { projet: 1 }),
  ] }),
  makeModule({ id: 'TB', name: 'Travail de Bachelor', ects: 15, semester: 'S6', orientation: 'common', units: [
    makeUnit('TB-TIC', 'Travail de Bachelor pour TIC', 450, { projet: 1 }),
  ] }),
]
```

- [ ] **Step 3: Ajouter les modules de l'orientation ISCS (S5, S6 électif)**

Ajouter à la fin de `src/curriculum.ts` :
```ts
const ISCS_MODULES: Module[] = [
  // S5
  makeModule({ id: 'DML', name: 'Développement mobile et sécurité logicielle', ects: 8, semester: 'S5', orientation: 'ISCS', units: [
    makeUnit('DAA', "Développement d'applications Android", 120, { cours: 0.67, labo: 0.33 }),
    makeUnit('SLH', 'Sécurité logicielle haut niveau', 120, { cours: 0.25, labo: 0.25, examen: 0.5 }),
  ] }),
  makeModule({ id: 'GCA', name: 'Gouvernance et cryptographie appliquée', ects: 6, semester: 'S5', orientation: 'ISCS', units: [
    makeUnit('CAA', 'Cryptographie avancée appliquée', 120, { cours: 0.25, labo: 0.25, examen: 0.5 }),
    makeUnit('GOD', 'Gouvernance des données', 60, { cours: 1 }),
  ] }),
  makeModule({ id: 'SDS', name: 'Sécurité des systèmes', ects: 6, semester: 'S5', orientation: 'ISCS', units: [
    makeUnit('SOS', "Sécurité des systèmes d'exploitation", 90, { cours: 0.3, labo: 0.2, examen: 0.5 }),
    makeUnit('SLB', 'Sécurité logicielle bas niveau', 90, { cours: 0.67, labo: 0.33 }),
  ] }),
  makeModule({ id: 'SEO', name: 'Sécurité opérationnelle', ects: 7, semester: 'S5', orientation: 'ISCS', units: [
    makeUnit('AST', "Audit de sécurité et test d'intrusion", 120, { projet: 1 }),
    makeUnit('GRS', 'Gestion des réseaux et sécurité opérationnelle', 90, { cours: 0.67, labo: 0.33 }),
  ] }),
  // S6 électif
  makeModule({ id: 'XISCS', name: 'Enseignements à choix ISCS', ects: 15, semester: 'S6', orientation: 'ISCS', repetitionThreshold: null, isElective: true, units: [] }),
]

const ALL_MODULES: Module[] = [...COMMON_MODULES, ...ISCS_MODULES]
```

- [ ] **Step 4: Ajouter les accesseurs**

Ajouter à la fin de `src/curriculum.ts` :
```ts
export function getModulesForOrientation(orientation: OrientationId): Module[] {
  return ALL_MODULES.filter((m) => m.orientation === 'common' || m.orientation === orientation)
}

export function getModulesBySemester(orientation: OrientationId, semester: SemesterId): Module[] {
  return getModulesForOrientation(orientation).filter((m) => m.semester === semester)
}

export function getSemestersForOrientation(orientation: OrientationId): SemesterId[] {
  const present = new Set(getModulesForOrientation(orientation).map((m) => m.semester))
  return SEMESTER_ORDER.filter((s) => present.has(s))
}

export function getModuleById(orientation: OrientationId, moduleId: string): Module | undefined {
  return getModulesForOrientation(orientation).find((m) => m.id === moduleId)
}

export function getAllUnits(orientation: OrientationId): Unit[] {
  return getModulesForOrientation(orientation).flatMap((m) => m.units)
}
```

- [ ] **Step 5: Vérifier la compilation du fichier de données**

Run: `npx tsc --noEmit src/curriculum.ts --moduleResolution bundler --module esnext --target es2023 --lib es2023,dom --noEmit --skipLibCheck`
Expected: aucune erreur de type dans `curriculum.ts`. (Si la commande isolée échoue à cause de la config, utiliser plutôt `npx tsc --noEmit` et ignorer les erreurs des autres fichiers non encore migrés.)

- [ ] **Step 6: Commit**

```bash
git add src/curriculum.ts
git commit -m "feat: données curriculum HEIG-VD tronc commun + ISCS"
```

---

## Task 4: Moteur de calcul (TDD)

**Files:**
- Create: `src/calculator.test.ts`
- Modify: `src/calculator.ts` (remplacer tout le contenu)

- [ ] **Step 1: Écrire les tests (qui échouent)**

Create `src/calculator.test.ts` :
```ts
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
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — `calculator.ts` n'exporte pas encore ces fonctions (erreurs d'import / fonctions non définies).

- [ ] **Step 3: Réécrire `src/calculator.ts`**

Remplacer **tout** le contenu de `src/calculator.ts` par :
```ts
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
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test`
Expected: PASS — tous les tests de `calculator.test.ts` passent.

- [ ] **Step 5: Commit**

```bash
git add src/calculator.ts src/calculator.test.ts
git commit -m "feat: moteur de calcul notes/modules/semestre (TDD)"
```

---

## Task 5: Persistance

**Files:**
- Modify: `src/storage.ts` (remplacer tout le contenu)

- [ ] **Step 1: Réécrire `src/storage.ts`**

Remplacer **tout** le contenu de `src/storage.ts` par :
```ts
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
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur dans `storage.ts`, `types.ts`, `calculator.ts`, `curriculum.ts`. Erreurs restantes uniquement dans `app.ts` et `graph.ts` (migrés ensuite) et `courseData.ts` (supprimé ensuite).

- [ ] **Step 3: Commit**

```bash
git add src/storage.ts
git commit -m "feat: persistance localStorage du nouvel état"
```

---

## Task 6: Carte de navigation (graph.ts)

**Files:**
- Modify: `src/graph.ts` (remplacer tout le contenu)

- [ ] **Step 1: Réécrire `src/graph.ts`**

Remplacer **tout** le contenu de `src/graph.ts` par :
```ts
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
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur dans `graph.ts`. Erreurs restantes uniquement dans `app.ts` et `courseData.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/graph.ts
git commit -m "feat: carte de navigation par semestre (statut modules)"
```

---

## Task 7: Vue par semestre (app.ts)

**Files:**
- Modify: `src/app.ts` (remplacer tout le contenu)

- [ ] **Step 1: Réécrire `src/app.ts` — squelette, état, en-tête**

Remplacer **tout** le contenu de `src/app.ts` par :
```ts
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
import { loadState, saveState } from './storage'

const COMPONENT_ORDER: Array<Unit['components'][number]['key']> = ['cours', 'labo', 'examen', 'projet']

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function bootstrapApp(root: HTMLElement): Promise<void> {
  const state = loadState()

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

  orientationSelect.innerHTML = ORIENTATIONS.map(
    (o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`,
  ).join('')
  orientationSelect.value = state.selectedOrientation

  function persistAndRender(): void {
    saveState(state)
    renderAll()
  }

  function selectSemester(semester: SemesterId): void {
    state.selectedSemester = semester
    persistAndRender()
  }

  function renderAll(): void {
    graphMount.replaceChildren(renderCourseGraph({ state, onSelectSemester: selectSemester }))
    renderSemester(semesterView, state, persistAndRender)
  }

  orientationSelect.addEventListener('change', () => {
    state.selectedOrientation = orientationSelect.value as OrientationId
    const semesters = getSemestersForOrientation(state.selectedOrientation)
    if (!semesters.includes(state.selectedSemester)) {
      state.selectedSemester = semesters[0]
    }
    persistAndRender()
  })

  renderAll()
}
```

- [ ] **Step 2: Ajouter le rendu d'un semestre et de ses modules**

Ajouter à la fin de `src/app.ts` :
```ts
function renderSemester(mount: HTMLElement, state: CalculatorState, onChange: () => void): void {
  const modules = getModulesBySemester(state.selectedOrientation, state.selectedSemester)
  const average = semesterAverage(modules, state.gradesByUnit)

  const container = document.createElement('div')
  container.className = 'semester-panel'
  container.innerHTML = `
    <div class="panel-header">
      <h2>${escapeHtml(SEMESTER_LABELS[state.selectedSemester])}</h2>
      <span class="scale">Moyenne semestre : <strong>${formatGrade(average)}</strong></span>
    </div>
  `

  for (const module of modules) {
    container.append(renderModule(module, state, onChange))
  }

  mount.replaceChildren(container)
}

function renderModule(module: Module, state: CalculatorState, onChange: () => void): HTMLElement {
  const status = moduleStatus(module, state.gradesByUnit)
  const grade = moduleGrade(module, state.gradesByUnit)

  const section = document.createElement('section')
  section.className = 'panel module-panel'
  section.innerHTML = `
    <div class="panel-header">
      <h3>${escapeHtml(module.id)} — ${escapeHtml(module.name)}</h3>
      <span class="module-meta">
        <span class="badge badge-${status}">${statusLabel(status)}</span>
        <span class="ects">${module.ects} ECTS</span>
        <strong class="module-grade">${formatGrade(grade)}</strong>
      </span>
    </div>
  `

  if (module.units.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'Module à choix : aucune unité prédéfinie.'
    section.append(empty)
    return section
  }

  for (const unit of module.units) {
    section.append(renderUnit(unit, state, onChange))
  }
  return section
}

function statusLabel(status: ReturnType<typeof moduleStatus>): string {
  if (status === 'reussi') return 'Réussi'
  if (status === 'echec') return 'Échec'
  return 'Incomplet'
}
```

- [ ] **Step 3: Ajouter le rendu d'une unité (saisie + résultats examen)**

Ajouter à la fin de `src/app.ts` :
```ts
function renderUnit(unit: Unit, state: CalculatorState, onChange: () => void): HTMLElement {
  const grades = state.gradesByUnit[unit.id] ?? {}
  const article = document.createElement('article')
  article.className = 'unit-card'

  const title = document.createElement('div')
  title.className = 'unit-title'
  title.innerHTML = `<span>${escapeHtml(unit.id)} — ${escapeHtml(unit.name)}</span>
    <strong class="unit-grade">${formatGrade(unitGrade(unit, grades))}</strong>`
  article.append(title)

  const fields = document.createElement('div')
  fields.className = 'unit-fields'
  for (const key of COMPONENT_ORDER) {
    const component = unit.components.find((c) => c.key === key)
    if (!component) continue
    const value = grades[key]
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
      onChange()
    })
    label.append(input)
    fields.append(label)
  }
  article.append(fields)

  if (unit.hasExam) {
    article.append(renderExamHint(unit, state, onChange))
  }
  return article
}

function renderExamHint(unit: Unit, state: CalculatorState, onChange: () => void): HTMLElement {
  const grades = state.gradesByUnit[unit.id] ?? {}
  const target = state.targetByUnit[unit.id] ?? 4
  const required = requiredExamGrade(unit, grades, target)
  const range = unitGradeRange(unit, grades)

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
  targetInput.value = String(target)
  targetInput.addEventListener('input', () => {
    state.targetByUnit[unit.id] = Number.parseFloat(targetInput.value) || 4
    onChange()
  })
  targetLabel.append(targetInput)
  box.append(targetLabel)

  const result = document.createElement('div')
  result.className = 'exam-result'
  result.innerHTML = examMessage(required, target)
  box.append(result)

  const rangeEl = document.createElement('p')
  rangeEl.className = 'unit-range'
  rangeEl.textContent = `Fourchette possible : ${formatGrade(range.min)} – ${formatGrade(range.max)}`
  box.append(rangeEl)

  return box
}

function examMessage(required: number | null, target: number): string {
  if (required === null) {
    return '<span class="result-help">Saisis les notes de contrôle continu pour calculer l\'examen à viser.</span>'
  }
  if (required <= 0) {
    return `<strong>Déjà atteint</strong><span class="result-help">Objectif ${target.toFixed(2)} atteint sans l'examen.</span>`
  }
  if (required >= 6) {
    return `<strong>≥ 6,00</strong><span class="result-help">Objectif ${target.toFixed(2)} difficile : examen proche du maximum.</span>`
  }
  return `<strong>${required.toFixed(2)}/6 à l'examen</strong><span class="result-help">pour atteindre ${target.toFixed(2)} dans l'unité.</span>`
}
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur dans `app.ts`. Reste éventuellement l'erreur d'import de `courseData.ts` ailleurs — vérifier qu'aucun fichier vivant ne l'importe (sinon corrigé en Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/app.ts
git commit -m "feat: vue par semestre avec saisie et examen à viser"
```

---

## Task 8: Export / Import JSON

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Ajouter les boutons export/import dans l'en-tête**

Dans `src/app.ts`, dans le template `root.innerHTML`, remplacer la ligne du `</header>` (la balise fermante du `<header class="hero">`) en insérant juste avant :
```html
        <div class="action-row">
          <button id="exportButton" class="btn-secondary" type="button">Exporter JSON</button>
          <label class="btn-secondary import-label">
            Importer JSON
            <input id="importInput" type="file" accept="application/json" hidden>
          </label>
        </div>
```
Le bloc doit se trouver à l'intérieur du `<header class="hero">`, après le `<label class="field orientation-field">…</label>`.

- [ ] **Step 2: Ajouter les références et le câblage**

Dans `bootstrapApp`, après la ligne `const semesterView = root.querySelector<HTMLElement>('#semesterView')!`, ajouter :
```ts
  const exportButton = root.querySelector<HTMLButtonElement>('#exportButton')!
  const importInput = root.querySelector<HTMLInputElement>('#importInput')!

  exportButton.addEventListener('click', () => exportJson(state))
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0]
    if (!file) return
    try {
      const imported = await readStateFromFile(file)
      Object.assign(state, imported)
      orientationSelect.value = state.selectedOrientation
      persistAndRender()
    } catch {
      window.alert('Fichier JSON invalide.')
    } finally {
      importInput.value = ''
    }
  })
```

- [ ] **Step 3: Ajouter les fonctions export/import**

Ajouter à la fin de `src/app.ts` :
```ts
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
  const parsed = JSON.parse(text) as { state?: CalculatorState }
  if (!parsed || typeof parsed !== 'object' || !parsed.state) {
    throw new Error('Payload invalide')
  }
  return parsed.state
}
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur dans `app.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts
git commit -m "feat: export/import JSON de l'état"
```

---

## Task 9: Styles + nettoyage

**Files:**
- Modify: `src/style.css`
- Delete: `src/courseData.ts`, `src/counter.ts`

- [ ] **Step 1: Supprimer les fichiers obsolètes**

Run:
```bash
rm src/courseData.ts src/counter.ts
```

- [ ] **Step 2: Vérifier qu'aucun import ne casse**

Run: `npx tsc --noEmit`
Expected: PASS, **zéro erreur**. (Si une erreur mentionne `courseData` ou `counter`, corriger l'import fautif puis relancer.)

- [ ] **Step 3: Ajouter les styles de la vue semestre**

Ajouter à la fin de `src/style.css` :
```css
.semester-view { display: flex; flex-direction: column; gap: 1rem; }
.semester-grid { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.semester-column { border: 1px solid #2a2a3a; border-radius: 8px; padding: 0.5rem; min-width: 7rem; }
.semester-column.active { border-color: #6366f1; box-shadow: 0 0 0 1px #6366f1; }
.semester-header { width: 100%; background: transparent; color: inherit; border: 0; font-weight: 600; cursor: pointer; padding: 0.25rem; }
.course-list { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.5rem; }
.course-item { background: #1f1f2e; color: inherit; border: 1px solid #2a2a3a; border-radius: 6px; padding: 0.25rem 0.5rem; cursor: pointer; text-align: left; }
.course-item.validated { border-color: #16a34a; }
.course-item.failed { border-color: #dc2626; }
.module-panel { margin-bottom: 0.75rem; }
.module-meta { display: inline-flex; align-items: center; gap: 0.5rem; }
.badge { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px; }
.badge-reussi { background: #14532d; color: #bbf7d0; }
.badge-echec { background: #7f1d1d; color: #fecaca; }
.badge-incomplet { background: #334155; color: #cbd5e1; }
.unit-card { border-top: 1px solid #2a2a3a; padding: 0.75rem 0; }
.unit-title { display: flex; justify-content: space-between; font-weight: 600; }
.unit-fields { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.5rem; }
.unit-fields .field { min-width: 8rem; }
.exam-hint { margin-top: 0.5rem; padding: 0.5rem; background: #1a1a28; border-radius: 8px; display: flex; flex-direction: column; gap: 0.25rem; }
.exam-result strong { color: #a5b4fc; }
.unit-range { color: #94a3b8; font-size: 0.85rem; margin: 0; }
.result-help { color: #94a3b8; font-size: 0.85rem; display: block; }
.orientation-field { max-width: 22rem; }
```

- [ ] **Step 4: Build complet**

Run: `npm run build`
Expected: `tsc` PASS puis `vite build` produit `dist/` sans erreur.

- [ ] **Step 5: Lancer les tests une dernière fois**

Run: `npm test`
Expected: tous les tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/style.css
git commit -m "style: vue semestre/modules + suppression code mort"
```

---

## Task 10: Vérification manuelle

**Files:** aucun (vérification)

- [ ] **Step 1: Lancer le serveur de dev**

Run: `npm run dev`
Expected: Vite démarre, URL locale affichée.

- [ ] **Step 2: Vérifier dans le navigateur**

Ouvrir l'URL et vérifier :
- L'orientation ISCS est sélectionnée ; la carte montre S1→S6.
- Cliquer un semestre affiche ses modules et unités.
- Saisir cours+labo d'une unité à examen (ex `SLH`) affiche la note d'examen à viser et la fourchette.
- Compléter toutes les unités d'un module affiche sa note et le badge réussi/échec.
- Recharger la page conserve les notes (localStorage).

- [ ] **Step 3: Commit éventuel des ajustements**

Si des correctifs visuels sont nécessaires, les appliquer puis :
```bash
git add -A
git commit -m "fix: ajustements vue semestre après vérification"
```

---

## Self-Review

- **Couverture spec** : modèle de données (T2/T3), calculs examen/module/semestre (T4), persistance localStorage (T5), carte navigation (T6), vue semestre (T7), export/import JSON (T8), styles+nettoyage (T9), vérif manuelle (T10), multi-orientation (T3 accesseurs + T7 sélecteur). XISCS électif géré comme module à unités vides (T3/T7).
- **Cohérence des types** : signatures de `calculator.ts` utilisées de façon identique dans tests, `app.ts`, `graph.ts`. `UnitGrades`, `Module`, `Unit`, `SemesterId`, `OrientationId` cohérents.
- **Pas de placeholder** : chaque étape contient le code complet.

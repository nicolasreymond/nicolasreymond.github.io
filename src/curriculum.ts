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

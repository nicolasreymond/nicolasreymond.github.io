# Calculateur de notes HEIG-VD — multi-orientation (ISCS) — Design

Date : 2026-06-16
Statut : approuvé (design), en attente plan d'implémentation

## 1. Objectif

Application web statique (Vite + TypeScript, sans backend) permettant à un·e
étudiant·e HEIG-VD filière Informatique et systèmes de communication de :

1. Saisir ses notes **par semestre**, au niveau des composantes de chaque unité
   (cours / labo / examen / projet).
2. Calculer, pour chaque unité à examen, **la note d'examen à viser** pour
   atteindre un objectif, la **note finale prévue** et la **fourchette min/max**.
3. Voir la **note de module**, le **statut de réussite** (promotion) de chaque
   module, et une **moyenne de semestre** indicative.
4. Choisir une **orientation** ; seule **ISCS (Sécurité informatique)** est
   fournie au départ, l'architecture supporte l'ajout d'autres orientations
   par simple ajout de données.

Persistance locale (localStorage) + export/import JSON. Aucune donnée envoyée
à un serveur.

## 2. Modèle de données

Hiérarchie : **Orientation → Semestre → Module → Unité → Composantes**.

```ts
type ComponentKey = 'cours' | 'labo' | 'examen' | 'projet'

interface UnitComponent {
  key: ComponentKey
  label: string
  weight: number      // poids dans la note d'unité (somme attendue = 1.0)
}

interface Unit {
  id: string          // ex: 'MAT1', 'ISD', 'SLH'
  name: string
  coef: number        // coefficient (poids) de l'unité dans le module
  components: UnitComponent[]
  hasExam: boolean    // true si une composante 'examen' existe
}

interface Module {
  id: string          // ex: 'MAT1', 'SLD', 'CAS'
  name: string
  ects: number
  semester: SemesterId        // 'S1'..'S6' | 'E2' | 'E3'
  orientation: 'common' | OrientationId   // 'common' | 'ISCS' | ...
  compensationThreshold: number   // 3.0
  repetitionThreshold: number     // 4.0 (absent pour XISCS)
  units: Unit[]
  isElective?: boolean            // XISCS : unités définies par l'utilisateur
}

type SemesterId = 'S1' | 'S2' | 'E2' | 'S3' | 'S4' | 'E3' | 'S5' | 'S6'
type OrientationId = 'ISCS'   // extensible
```

- **Note d'unité** = Σ (note_composante × weight). Une composante non saisie est
  exclue du calcul « actuel » mais prise en compte pour la fourchette min/max.
- **Note de module** = Σ (note_unité × coef) / Σ (coef).
- Les poids de composantes et coefficients sont **éditables** dans l'UI
  (overrides mémorisés), valeurs par défaut = celles du plan d'études.

### État utilisateur

```ts
interface CalculatorState {
  selectedOrientation: OrientationId
  selectedSemester: SemesterId
  gradesByUnit: Record<string, Partial<Record<ComponentKey, number | null>>>
  targetByUnit: Record<string, number>          // objectif de note d'unité
  weightOverrides?: Record<string, Partial<Record<ComponentKey, number>>>
  electiveUnits?: Record<string, Unit[]>        // unités XISCS ajoutées
}
```

## 3. Calculs (module `calculator.ts`)

Fonctions pures, testables indépendamment :

- `unitContinuousContribution(unit, grades)` : Σ composantes non-examen saisies × poids.
- `unitGrade(unit, grades)` : note d'unité si toutes composantes nécessaires saisies, sinon `null`.
- `requiredExamGrade(unit, grades, target)` :
  `(target − contribution_continue) / poids_examen`, borné [0,6].
  Cas : « déjà atteint » (≤0), « impossible » (>6).
- `projectedUnitGrade(unit, grades, examHypo)` : note d'unité avec hypothèse d'examen.
- `unitGradeRange(unit, grades)` : { min, max } en faisant varier les composantes
  vides de 0 à 6.
- `moduleGrade(module, gradesByUnit)` : moyenne pondérée par coef ; `null` si une
  unité manque.
- `moduleStatus(module, gradesByUnit)` : `'reussi' | 'echec' | 'incomplet'`.
  Échec si une unité < seuil de compensation (3.0) OU moyenne < seuil de
  répétition (4.0). `incomplet` si données manquantes.
- `semesterAverage(modules, gradesByUnit)` : moyenne des notes de module pondérée
  par ECTS (indicative).

Échelle 0–6, arrondi d'affichage 2 décimales (virgule). Le clamp et le format
existants (`clampGrade`, `formatGrade`) sont réutilisés.

## 4. Interface

- **Sélecteur d'orientation** (en-tête). Filtre les modules S5/S6.
- **Vue par semestre** : navigation S1 → S6 (+ E2/E3). Pour le semestre courant :
  - liste des **modules** ; chaque module : note de module + badge statut
    (réussi / échec / incomplet) + ECTS.
  - chaque **unité** : champs par composante (cours / labo / examen / projet),
    note d'unité calculée, et pour les unités à examen : objectif → **examen à
    viser**, **note finale prévue**, **fourchette min/max**.
  - bouton « ajuster les poids » par unité (édition des overrides).
- **Récap semestre** : moyenne ECTS-pondérée + nb modules réussis/échoués.
- **Carte des modules** (`graph.ts`) : conservée comme navigation par semestre,
  ids de modules mis à jour, statut coloré (réussi/échec/notes saisies).
- **Export / Import JSON** : sauvegarde complète de l'état.

## 5. Architecture fichiers

- `src/curriculum.ts` (remplace `courseData.ts`) : données complètes
  orientations / semestres / modules / unités (source de vérité, section 7).
- `src/types.ts` : types ci-dessus.
- `src/calculator.ts` : fonctions de calcul (section 3).
- `src/storage.ts` : load/save state + migration de l'ancien format.
- `src/app.ts` : rendu vue par semestre + saisie + sélecteur orientation.
- `src/graph.ts` : carte des modules (navigation).
- `src/style.css` : styles vue semestre / modules / badges.

Suppression propre de l'ancien catalogue incohérent. `counter.ts` (template Vite
inutilisé) supprimé.

## 6. Règles de promotion (rappel plan)

- Seuil de compensation entre unités d'un module : **3.0** → toute note d'unité
  inférieure entraîne l'échec du module.
- Seuil de répétition du module : **4.0** → note de module < 4.0 = échec.
- `XISCS` (15 ECTS) : module à choix, min **9 crédits fondamentaux**, pas de seuil
  de répétition ; traité comme module spécial à unités définies par l'utilisateur.

## 7. Données ISCS (source de vérité)

Format : `MODULE (ECTS, semestre, orientation) = unité[coef]{composante:poids,...}` ;
`*` = unité avec examen.

### Tronc commun

S1
- `MAT1` (8, S1, common) = `MAT1`[150]{cours:.5,examen:.5}* · `MAD`[90]{cours:.5,examen:.5}*
- `PRG` (9, S1, common) = `PRG1`[270]{cours:.3,labo:.2,examen:.5}*
- `SLD` (8, S1, common) = `ISD`[120]{cours:.3,labo:.2,examen:.5}* · `SYL`[120]{cours:.3,labo:.2,examen:.5}*
- `COM1` (4, S1, common) = `ENG1`[60]{cours:1} · `EXP`[60]{cours:1}

S2
- `ASD` (6, S2, common) = `ASD`[180]{cours:.3,labo:.2,examen:.5}*
- `ASI` (7, S2, common) = `ARO`[105]{cours:.3,labo:.2,examen:.5}* · `ISI`[105]{cours:.3,labo:.2,examen:.5}*
- `MAT2` (5, S2, common) = `MAT2`[150]{cours:.5,examen:.5}*
- `PRI` (7, S2, common) = `PRG2`[105]{cours:.3,labo:.2,examen:.5}* · `RXI`[105]{cours:.3,labo:.2,examen:.5}*

E2
- `COM2` (3, E2, common) = `ENG2`[60]{cours:1} · `DTS`[30]{projet:1}
- `PIN` (3, E2, common) = `PIN`[90]{projet:1}

S3
- `BDA` (8, S3, common) = `BDR`[150]{cours:.3,labo:.2,examen:.5}* · `DAI`[90]{cours:.3,labo:.2,examen:.5}*
- `MAT3` (8, S3, common) = `MAT3`[120]{cours:1} · `PST`[120]{cours:1}
- `POO` (5, S3, common) = `POO`[150]{cours:.8,labo:.2}
- `SEC` (7, S3, common) = `PCO`[105]{cours:.3,labo:.2,examen:.5}* · `SYE`[105]{cours:.3,labo:.2,examen:.5}*

S4
- `CAS` (8, S4, common) = `CRY`[150]{cours:.3,labo:.2,examen:.5}* · `ASM`[90]{cours:.67,labo:.33}
- `DLR` (5, S4, common) = `EAL`[45]{cours:1} · `PDL`[105]{cours:.67,labo:.33}
- `SRN` (6, S4, common) = `ARN`[90]{cours:.3,labo:.2,examen:.5}* · `SRX`[90]{cours:.3,labo:.2,examen:.5}*
- `TCW` (8, S4, common) = `CLD`[90]{cours:.67,labo:.33} · `WEB`[150]{cours:.3,labo:.2,examen:.5}*

E3
- `PDG` (6, E3, common) = `PDG`[180]{projet:1}

S6 (commun)
- `CRUNCH` (2, S6, common) = `CRH`[60]{projet:1}
- `TB` (15, S6, common) = `TB-TIC`[450]{projet:1}

### Orientation ISCS

S5
- `DML` (8, S5, ISCS) = `DAA`[120]{cours:.67,labo:.33} · `SLH`[120]{cours:.25,labo:.25,examen:.5}*
- `GCA` (6, S5, ISCS) = `CAA`[120]{cours:.25,labo:.25,examen:.5}* · `GOD`[60]{cours:1}
- `SDS` (6, S5, ISCS) = `SOS`[90]{cours:.3,labo:.2,examen:.5}* · `SLB`[90]{cours:.67,labo:.33}
- `SEO` (7, S5, ISCS) = `AST`[120]{projet:1} · `GRS`[90]{cours:.67,labo:.33}

S6
- `XISCS` (15, S6, ISCS, électif) = unités à choix définies par l'utilisateur (min 9 crédits fondamentaux)

Noms complets des unités : voir le plan d'études HEIG-VD ISCS 2025-2028 (intégrés
dans `curriculum.ts`).

## 8. Tests

Tests unitaires sur `calculator.ts` (cas réels du plan) :
- note d'unité multi-composantes (ex SLH 0.25/0.25/0.5).
- note de module pondérée coef (ex CAS = (150·CRY+90·ASM)/240).
- examen à viser : nominal, « déjà atteint », « impossible ».
- statut module : échec par compensation (unité < 3.0) vs par répétition (<4.0).
- moyenne semestre ECTS-pondérée.

## 9. Hors périmètre (YAGNI)

- Pas de comptes utilisateurs ni de synchronisation cloud.
- Pas de gestion fine des crédits fondamentaux/diversifiés de XISCS (juste somme ECTS).
- Pas de calcul de moyenne générale du Bachelor (focal : semestre / module).

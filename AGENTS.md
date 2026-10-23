# AGENTS.md

## 1. Mission

Tu es un agent de développement logiciel travaillant sur ce dépôt.

Ton objectif est de produire des modifications :
- conformes aux spécifications ;
- simples et maintenables ;
- correctement testées ;
- reproductibles ;
- sécurisées ;
- compatibles avec l'architecture existante.

Tu dois privilégier la correction et la maintenabilité plutôt que la quantité de code produite.

Tous les documents de ce projet sont en anglais (codebase, README, specs, design)

---

## 2. Sources de vérité

Avant toute modification significative, consulte dans cet ordre :

1. `AGENTS.md`
2. les spécifications fonctionnelles du projet ;
3. les ADR (`docs/adr/` ou équivalent) ;
4. le `README.md` ;
5. la documentation technique ;
6. le code existant ;
7. les tests existants.

Ne suppose pas qu'une fonctionnalité est souhaitée simplement parce qu'elle semble utile.

En cas d'ambiguïté importante dans les exigences, signale-la avant de prendre une décision difficilement réversible.

---

## 3. Méthode de travail

Pour toute modification non triviale :

1. comprendre la demande ;
2. identifier les composants concernés ;
3. lire le code et les tests existants ;
4. identifier les contraintes architecturales ;
5. établir un plan court ;
6. implémenter la modification minimale nécessaire ;
7. ajouter ou modifier les tests ;
8. exécuter les contrôles de qualité ;
9. exécuter les tests unitaires ;
10. exécuter les tests d'intégration pertinents ;
11. analyser les erreurs éventuelles ;
12. corriger les problèmes ;
13. répéter les contrôles jusqu'à obtenir un résultat satisfaisant.

Ne considère pas une modification comme terminée simplement parce que le code compile.

---

## 4. Planification

Pour une tâche simple, un plan mental ou court est suffisant.

Pour une tâche complexe :
- décompose le travail en étapes ;
- identifie les fichiers et composants concernés ;
- identifie les risques ;
- identifie les tests nécessaires ;
- évite les modifications sans rapport avec la demande.

Si le dépôt utilise un fichier `PLAN.md`, maintiens-le à jour pendant les travaux importants.

---

## 5. Architecture

Respecte l'architecture existante du projet.

Avant d'introduire :
- une nouvelle dépendance ;
- un nouveau framework ;
- un nouveau service ;
- un nouveau pattern architectural ;
- une nouvelle infrastructure ;

vérifie d'abord qu'une solution équivalente n'existe pas déjà dans le dépôt.

Privilégie :
- les composants faiblement couplés ;
- les responsabilités clairement séparées ;
- les interfaces explicites ;
- les dépendances maîtrisées ;
- les solutions simples.

Évite la sur-ingénierie.

---

## 6. Qualité du code

Le code produit doit être :
- lisible ;
- explicite ;
- testable ;
- maintenable ;
- cohérent avec le code existant.

Respecte les conventions du projet :
- les classes et méthodes doivent être documentées ;
- toutes les erreurs doivent être tracées dans la console.

Évite :
- la duplication inutile ;
- les abstractions prématurées ;
- les fonctions excessivement longues ;
- les effets de bord non maîtrisés ;
- les valeurs magiques ;
- le code mort.

Ne refactorise pas du code sans rapport avec la tâche sauf si cela est nécessaire à sa réalisation.


---

## 7. Dépendances

N'ajoute pas de dépendance externe sans justification.

Avant d'ajouter une dépendance :
1. vérifier si le besoin peut être satisfait avec les dépendances existantes ;
2. vérifier si les fonctionnalités standard du langage suffisent ;
3. évaluer l'impact sur le build, la sécurité et la maintenance.

Toute nouvelle dépendance doit être explicitement identifiable dans le résultat de la tâche.

---

## 8. Tests

Toute modification fonctionnelle doit être accompagnée des tests appropriés.

Utilise en priorité :

### Tests unitaires

Ils doivent :
- être rapides ;
- être déterministes ;
- tester les comportements importants ;
- couvrir les cas nominaux ;
- couvrir les cas limites pertinents ;
- couvrir les erreurs significatives.

### Tests d'intégration

Utilise-les pour vérifier les interactions avec :
- bases de données ;
- files de messages ;
- systèmes de fichiers ;
- APIs ;
- services externes ;
- composants distribués.

Lorsque cela est possible, privilégie des composants réels isolés via Docker/Testcontainers plutôt que des mocks excessifs.

### Tests end-to-end

Réserve les tests E2E aux parcours fonctionnels importants.

Ils doivent vérifier le comportement observable du système et non les détails internes d'implémentation.

---

## 9. Règle de non-régression

Lorsqu'un bug est corrigé :

1. reproduire le bug lorsque cela est raisonnablement possible ;
2. ajouter un test démontrant le problème ;
3. appliquer la correction ;
4. vérifier que le nouveau test passe ;
5. vérifier que les tests existants passent toujours.

Une correction de bug sans test de non-régression doit rester exceptionnelle et être justifiée.

---

## 10. Build et validation

Avant de considérer une tâche terminée, exécute les contrôles disponibles dans le projet.

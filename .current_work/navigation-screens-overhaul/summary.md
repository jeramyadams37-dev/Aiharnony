# Navigation & Screens Overhaul — Summary

## Plan Overview

This plan introduces a **hub-and-spoke navigation architecture** for the Harmony AI App, replacing the current `BottomNavigator` with a `LandingScreen` as the app root. It fully implements the **Characters Screen** (character profile management), introduces a new **Settings Screen**, a **Create AI wizard screen** for guided entity creation, and a full **Entity Config Screen** for power users. The hamburger menu (`SettingsMenu`) is upgraded to provide cross-section quick navigation.

### Architecture Decision: Hub-and-Spoke

The current `BottomNavigator` (3 tabs: Chat / Characters / AI Config) is removed. A `LandingScreen` serves as the root hub with 3 entry points:
- **AI Chat** → `ChatListScreen` (high-frequency daily use)
- **Characters** → `CharactersScreen` (profile management, medium-frequency)
- **Settings** → `SettingsScreen` (low-frequency configuration)

The **Entity Config** screen is NOT on the Landing page — it's a power-user detail accessible contextually (from ChatList ⋮ menu, ChatDetailScreen ⚙ icon, or Characters → "Linked Entities"). Cross-section quick-navigation is provided via the existing hamburger menu (`SettingsMenu`) which gains "AI Chat" and "Characters" shortcuts.

### Key Decisions Made
- Entity alias field added via DB migration (unique, defaults to character profile name)
- `CreateAIScreen` is a full push screen (not a bottom sheet)
- `CharacterProfileEditScreen` uses a single scrollable form with section headers (no tabs)
- Module config creation is out of scope — entity config only links existing configs
- If no module configs exist → user is prompted to connect to cloud or Harmony Link
- `CharactersScreen` shows character profiles only (not entities)

---

## Implementation Status

Track the completion of each phase as implementation progresses:

- [ ] **Phase 1: DB Migration — Entity Alias Field** ([1-DBMigration-EntityAlias.md](1-DBMigration-EntityAlias.md))
- [ ] **Phase 2: Navigation Restructure** ([2-NavigationRestructure.md](2-NavigationRestructure.md))
- [ ] **Phase 3: Landing Screen** ([3-LandingScreen.md](3-LandingScreen.md))
- [ ] **Phase 4: Settings Menu Update** ([4-SettingsMenuUpdate.md](4-SettingsMenuUpdate.md))
- [ ] **Phase 5: Settings Screen** ([5-SettingsScreen.md](5-SettingsScreen.md))
- [ ] **Phase 6: Characters Screen + Profile Editor**
  - [ ] CharactersScreen full implementation ([6-1-CharactersScreen.md](6-1-CharactersScreen.md))
  - [ ] CharacterProfileCard component ([6-2-CharacterProfileCard.md](6-2-CharacterProfileCard.md))
  - [ ] CharacterProfileEditScreen ([6-3-CharacterProfileEditScreen.md](6-3-CharacterProfileEditScreen.md))
- [ ] **Phase 7: Create AI Screen** ([7-CreateAIScreen.md](7-CreateAIScreen.md))
- [ ] **Phase 8: Entity Config Screens**
  - [ ] EntityConfigScreen (list) ([8-1-EntityConfigScreen.md](8-1-EntityConfigScreen.md))
  - [ ] EntityConfigEditScreen (detail) ([8-2-EntityConfigEditScreen.md](8-2-EntityConfigEditScreen.md))
  - [ ] EntityCard component ([8-3-EntityCard.md](8-3-EntityCard.md))
- [ ] **Phase 9: ChatListScreen Updates** ([9-ChatListScreenUpdates.md](9-ChatListScreenUpdates.md))

---

## File Change Overview

### New Files
| File | Description |
|------|-------------|
| `src/database/migrations/000018_add_entity_alias.ts` | Migration: adds `alias` column to `entities` table |
| `src/screens/LandingScreen.tsx` | New hub/root screen |
| `src/screens/SettingsScreen.tsx` | New dedicated settings screen |
| `src/screens/CreateAIScreen.tsx` | Entity creation wizard (full push screen) |
| `src/screens/EntityConfigScreen.tsx` | Entity list + management |
| `src/screens/EntityConfigEditScreen.tsx` | Entity create/edit detail screen |
| `src/screens/CharacterProfileEditScreen.tsx` | Character profile create/edit |
| `src/components/landing/LandingCard.tsx` | Large action card for LandingScreen |
| `src/components/characters/CharacterProfileCard.tsx` | Profile card for grid display |
| `src/components/characters/CharacterProfileForm.tsx` | Reusable scrollable form sections |
| `src/components/characters/ProfileImagePicker.tsx` | Image gallery with add/remove/primary |
| `src/components/entities/EntityCard.tsx` | Entity list item card |
| `src/components/entities/EntityModuleSelector.tsx` | Per-module config picker |
| `src/components/settings/ConnectionStatusBadge.tsx` | Dot-style connection indicator |

### Modified Files
| File | Change |
|------|--------|
| `src/database/models.ts` | Add `alias` field to `Entity` interface |
| `src/database/repositories/entities.ts` | Add alias CRUD + unique validation |
| `src/navigation/AppNavigator.tsx` | Remove BottomNavigator, add all new routes, set LandingScreen as initial route |
| `src/screens/CharactersScreen.tsx` | Full implementation (replaces stub) |
| `src/screens/AIConfigScreen.tsx` | Replace stub → redirect to EntityConfigScreen (or rename) |
| `src/components/navigation/SettingsMenu.tsx` | Add "Navigate" section with AI Chat + Characters shortcuts |

### Deleted Files
| File | Reason |
|------|--------|
| `src/navigation/BottomNavigator.tsx` | Replaced by hub-and-spoke stack navigation |

---

## Dependency Order

```
Phase 1 (DB) → Phase 2 (Navigation) → Phase 3 (Landing) → Phase 4 (SettingsMenu)
                                     → Phase 5 (Settings)
                                     → Phase 6 (Characters)
                                     → Phase 7 (CreateAI)
                                     → Phase 8 (EntityConfig)
                                     → Phase 9 (ChatList updates)
```

Phases 3–9 can be worked in parallel after Phase 2 is complete (they're independent screens/components once routes are registered).

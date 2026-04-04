# Phase 1: Service + Modal

## Objective

1. Add a **global** impersonated entity preference to `ChatPreferencesService` (a single AsyncStorage key shared across all chats).
2. Refactor `EntitySelectionModal` into `ImpersonationSelectorModal` — remove partner-entity filtering, simplify props, update copy.

## Codebase References
- [`src/services/ChatPreferencesService.ts`](../../src/services/ChatPreferencesService.ts)
- [`src/components/modals/EntitySelectionModal.tsx`](../../src/components/modals/EntitySelectionModal.tsx)
- [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md)

---

## Task 1 — Extend `ChatPreferencesService`

**File:** `src/services/ChatPreferencesService.ts`

Add a new constant and two new exported async functions after the existing constants:

```typescript
const GLOBAL_ENTITY_KEY = 'chat_global_impersonated_entity';
```

```typescript
/**
 * Get the globally selected impersonated entity (used across all chats).
 * Falls back to null if no preference is set.
 */
async function getGlobalImpersonatedEntity(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(GLOBAL_ENTITY_KEY);
    log.debug(`Retrieved global impersonated entity: ${value}`);
    return value;
  } catch (error) {
    log.error('Failed to get global impersonated entity:', error);
    return null;
  }
}

/**
 * Set the globally selected impersonated entity.
 * @param entityId The entity ID to use as the global persona
 */
async function setGlobalImpersonatedEntity(entityId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(GLOBAL_ENTITY_KEY, entityId);
    log.info(`Set global impersonated entity: ${entityId}`);
  } catch (error) {
    log.error('Failed to set global impersonated entity:', error);
    throw error;
  }
}
```

Export both new functions in the default export object at the bottom of the file alongside the existing exports.

---

## Task 2 — Refactor `EntitySelectionModal` → `ImpersonationSelectorModal`

**File:** `src/components/modals/EntitySelectionModal.tsx`

Rename the file to `ImpersonationSelectorModal.tsx` (update it in place — the old filename can be kept if renaming causes import churn, but rename is preferred).

### Props interface changes

**Remove** `partnerEntityId` from the props interface. The new interface:

```typescript
interface ImpersonationSelectorModalProps {
  visible: boolean;
  onSelect: (entityId: string) => void;
  onCancel: () => void;
  preSelectedEntityId?: string;
}
```

### Logic changes

- Remove the `partnerEntityId` parameter from `determineDefaultEntity` — it no longer needs to filter out a partner:

```typescript
const determineDefaultEntity = (
  entities: Entity[],
  preSelectedEntityId?: string
): string | null => {
  if (entities.length === 0) return null;

  if (preSelectedEntityId) {
    const isValid = entities.some(e => e.id === preSelectedEntityId);
    if (isValid) return preSelectedEntityId;
  }

  const userEntity = entities.find(e => e.id === 'user');
  if (userEntity) return userEntity.id;

  return entities[0].id;
};
```

- In `loadEntities`, remove the `validEntities` filter that excluded `partnerEntityId`. Load **all** entities:

```typescript
const allEntities = await getAllEntities();
// No filter — show all entities
```

- Update the call to `determineDefaultEntity`:

```typescript
const defaultId = determineDefaultEntity(allEntities, preSelectedEntityId);
```

### Copy changes

- Modal header title: **"Chatting As"**
- Modal header subtitle: **"Select the persona you want to use across all chats"**
- Confirm button label: **"Confirm"** (unchanged)

### Component rename

Rename the exported component:

```typescript
export const ImpersonationSelectorModal: React.FC<ImpersonationSelectorModalProps> = ({
  visible,
  onSelect,
  onCancel,
  preSelectedEntityId,
}) => { ... }
```

---

## Progress Checklist

- [ ] Add `GLOBAL_ENTITY_KEY` constant to `ChatPreferencesService`
- [ ] Add `getGlobalImpersonatedEntity` function
- [ ] Add `setGlobalImpersonatedEntity` function
- [ ] Export both new functions in the default export object
- [ ] Rename `EntitySelectionModal.tsx` → `ImpersonationSelectorModal.tsx`
- [ ] Remove `partnerEntityId` from props interface
- [ ] Update `determineDefaultEntity` to remove partner filter
- [ ] Update `loadEntities` to remove partner filter
- [ ] Update modal header copy
- [ ] Rename exported component to `ImpersonationSelectorModal`

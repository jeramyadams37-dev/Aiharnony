# Phase 9: ChatListScreen Updates

## Objective
Update `ChatListScreen` to work within the new hub-and-spoke navigation (no more BottomNavigator), add a (+) FAB that navigates to `CreateAIScreen`, add entity ⋮ context menu items for "Entity Settings" navigation, and update the display name to use the new `alias` field.

## Files to Modify
- `src/screens/ChatListScreen.tsx`

---

## Changes Required

### 9.1 — Remove BottomNavigator navigation dependencies

`ChatListScreen` currently receives navigation from the BottomNavigator stack. After Phase 2, it exists directly in the `AppNavigator` stack. Check for and remove any patterns like:
- `navigation.navigate('Main')` → remove (no longer valid)
- Tab-switching calls via `useNavigation` to sibling tabs → remove

### 9.2 — Update entity display name to use `alias`

Currently `ChatListScreen` loads entities via `getAllEntities()` and displays... what? Check the current render. With the new `alias` field (from Phase 1 migration), update the display name logic:

```typescript
// Current entity display (likely uses character profile name or UUID)
// Update to:
const getEntityDisplayName = (entity: Entity, characterProfile: CharacterProfile | null): string => {
  if (entity.alias) return entity.alias;
  if (characterProfile?.name) return characterProfile.name;
  return `Entity ${entity.id.substring(0, 8)}…`;
};
```

### 9.3 — Add (+) FAB for creating new AI

Add a `FAB` button in the bottom-right corner that navigates to `CreateAIScreen`:

```typescript
import { FAB } from 'react-native-paper';

// In the JSX (after FlatList, before SettingsMenu):
<FAB
  icon="plus"
  style={[styles.fab, { backgroundColor: theme?.colors.accent.primary }]}
  onPress={() => navigation.navigate('CreateAI', {})}
  color="#fff"
  label="New AI"
  visible={isPaired}  // only show when connected/paired (entities come from Harmony Link sync)
/>
```

> **Note:** `FAB` should probably be visible even when not paired, since locally-created entities (via `CreateAIScreen`) don't require Harmony Link. Reconsider: show FAB always, but `CreateAIScreen` handles the case where no module configs are available (prompts user to connect).

**Revised:** Show FAB always.

### 9.4 — Add entity ⋮ context menu in chat list rows

Each chat list item (entity row) should surface a context menu via a ⋮ button. The current `ChatListScreen` uses a `FlatList` with `renderItem`. Add a ⋮ button to each row.

**Context menu options:**
- `Chat` → navigate to `ChatDetail` (same as tap)
- `Entity Settings` → navigate to `EntityConfigEdit` with `{ entityId }`
- `Delete Entity` → confirm + delete + remove from list

**Implementation approach:** Use the same inline modal pattern as `EntityCard` (Phase 8-3), or alternatively use `Alert.alert` with action buttons for simplicity. Recommend inline modal for better UX, but the pattern from `EntityCard` can be extracted into a reusable `ContextMenu` component if desired.

For Phase 9, keep it simple: a ⋮ `TouchableOpacity` on each row item that opens an `Alert` with action buttons:

```typescript
const handleEntityContextMenu = (entityId: string, entityName: string) => {
  Alert.alert(
    entityName,
    undefined,
    [
      {
        text: 'Entity Settings',
        onPress: () => navigation.navigate('EntityConfigEdit', { entityId }),
      },
      {
        text: 'Delete Entity',
        style: 'destructive',
        onPress: () => confirmDeleteEntity(entityId, entityName),
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
};
```

Add a ⋮ `TouchableOpacity` icon button to the right side of each list row.

### 9.5 — Update header back button behavior

`ChatListScreen` now has a back button (since it's no longer a tab — it's a stack screen pushed from `LandingScreen`). Add `Appbar.BackAction` to navigate back to `Landing`:

```typescript
<Appbar.BackAction
  color={theme?.colors.text.primary}
  onPress={() => navigation.navigate('Landing')}
/>
```

> **Design note:** Using `navigation.navigate('Landing')` instead of `navigation.goBack()` ensures users always return to the hub, even if they navigated to `ChatList` from the hamburger menu while in another section.

### 9.6 — Update `not paired` state CTA

Currently when not paired, `ChatListScreen` shows:
```
Not connected to Harmony Link
[Connect Now]
```

This should remain, but update the "Connect Now" button to navigate to `ConnectionSetup` (verify the route name is consistent with Phase 2):

```typescript
onPress={() => navigation.navigate('ConnectionSetup')}
```

Also update the message to be more inclusive (not just Harmony Link):
```
Not connected
Connect to Harmony Link or cloud to load your entities.
```

### 9.7 — Maintain `useFocusEffect` for list refresh

Ensure `ChatListScreen` uses `useFocusEffect` or similar to refresh the entity list when returning from `EntityConfigEdit` or after `CreateAIScreen` creates a new entity.

The current `ChatListScreen` uses `useFocusEffect` for this — verify it still works after navigation restructure. If it uses tab focus events, update to `useFocusEffect` from `@react-navigation/native`:

```typescript
import { useFocusEffect } from '@react-navigation/native';

useFocusEffect(
  useCallback(() => {
    loadChatList();
  }, [])
);
```

---

## Updated `ChatListScreen` Structure (diff overview)

| Area | Change |
|------|--------|
| Header | Add `Appbar.BackAction` → `Landing` |
| Entity display name | Use `entity.alias ?? profile.name ?? UUID` |
| Row item | Add ⋮ context menu button |
| FAB | Add `+` FAB → `CreateAIScreen` |
| Not-paired message | Update text to be connection-agnostic |
| `useFocusEffect` | Verify and keep for list refresh |
| Navigation calls | Remove any BottomNavigator-specific calls |
| `ConnectionSetup` route | Verify uses `'ConnectionSetup'` (not `'Main'`) |

---

## Styles additions

```typescript
fab: {
  position: 'absolute',
  bottom: 24,
  right: 24,
},
rowMenuButton: {
  padding: 8,
  marginLeft: 4,
},
```

---

## Progress Checklist

- [ ] Add `Appbar.BackAction` to `ChatListScreen` header → navigates to `Landing`
- [ ] Update entity display name logic to use `alias` field from Phase 1
- [ ] Add ⋮ context menu button to each entity row
- [ ] Implement `handleEntityContextMenu` with "Entity Settings" and "Delete Entity" actions
- [ ] Add `navigation.navigate('EntityConfigEdit', { entityId })` in context menu
- [ ] Add FAB → `navigation.navigate('CreateAI', {})`
- [ ] Update not-paired message to be connection-agnostic
- [ ] Verify `ConnectionSetup` route name matches Phase 2 `RootStackParamList`
- [ ] Verify `useFocusEffect` refreshes list on screen focus
- [ ] Remove any BottomNavigator-specific navigation calls
- [ ] Test: back button in ChatList returns to LandingScreen
- [ ] Test: entity display name shows alias when set
- [ ] Test: entity display name falls back to character profile name when no alias
- [ ] Test: ⋮ button opens action sheet
- [ ] Test: "Entity Settings" navigates to `EntityConfigEdit`
- [ ] Test: "Delete Entity" confirms and removes from list
- [ ] Test: FAB navigates to `CreateAIScreen`
- [ ] Test: list refreshes when returning from `EntityConfigEdit` or `CreateAIScreen`
- [ ] Test: not-paired state shows correctly

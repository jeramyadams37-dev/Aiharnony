# Phase 2: ChatListScreen Refactor

## Objective

Overhaul `ChatListScreen` to:
1. Load and store a **global impersonated entity** at screen level
2. Render an **`ImpersonationSelectorBanner`** between the Appbar and the chat list
3. Use the global entity for all last-message previews and chat navigation
4. Remove the old per-partner `EntitySelectionModal` flow entirely
5. Update the `InfoModal` text to describe the new persona-first flow

## Codebase References
- [`src/screens/ChatListScreen.tsx`](../../src/screens/ChatListScreen.tsx)
- [`src/services/ChatPreferencesService.ts`](../../src/services/ChatPreferencesService.ts)
- [`src/components/modals/ImpersonationSelectorModal.tsx`](../../src/components/modals/ImpersonationSelectorModal.tsx) (renamed in Phase 1)
- [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md)

---

## Task 1 — State cleanup and new state

**Remove** these state variables and associated constants:
```typescript
// REMOVE:
const [entityModalVisible, setEntityModalVisible] = useState(false);
const [selectedPartner, setSelectedPartner] = useState<ChatListItem | null>(null);
const defaultImpersonatedEntityId = 'user'; // FIXME constant
```

**Add** these new state variables:
```typescript
const [impersonatedEntityId, setImpersonatedEntityId] = useState<string>('user');
const [impersonatedEntityDisplay, setImpersonatedEntityDisplay] = useState<{
  name: string;
  avatarUri: string | null;
}>({ name: 'User', avatarUri: null });
const [selectorModalVisible, setSelectorModalVisible] = useState(false);
```

---

## Task 2 — Load global entity on mount and focus

Add a `loadImpersonatedEntity` function and call it on `useFocusEffect`:

```typescript
const loadImpersonatedEntity = useCallback(async () => {
  try {
    const allEntities = await getAllEntities();
    const storedId = await ChatPreferencesService.getGlobalImpersonatedEntity();

    // Pick best default: stored > 'user' entity > first entity
    let resolvedId = storedId;
    if (!resolvedId || !allEntities.some(e => e.id === resolvedId)) {
      const userEntity = allEntities.find(e => e.id === 'user');
      resolvedId = userEntity ? userEntity.id : allEntities[0]?.id ?? 'user';
    }

    setImpersonatedEntityId(resolvedId);

    // Load display info for banner
    const entity = allEntities.find(e => e.id === resolvedId);
    if (entity?.character_profile_id) {
      const profile = await getCharacterProfile(entity.character_profile_id);
      const image = await getPrimaryImage(entity.character_profile_id);
      setImpersonatedEntityDisplay({
        name: profile?.name ?? resolvedId,
        avatarUri: image ? imageToDataURL(image) : null,
      });
    } else {
      setImpersonatedEntityDisplay({ name: resolvedId, avatarUri: null });
    }
  } catch (error) {
    log.error('Failed to load impersonated entity:', error);
  }
}, []);
```

Update `useFocusEffect` to call both loaders:

```typescript
useFocusEffect(
  useCallback(() => {
    loadImpersonatedEntity();
    loadChatList();
  }, [loadImpersonatedEntity, loadChatList])
);
```

---

## Task 3 — Update `loadChatList` to use global entity

In `loadChatList`, replace the per-partner preference lookup:

**Remove:**
```typescript
const preferredEntityId = await ChatPreferencesService.getPreferredEntity(entity.id) || defaultImpersonatedEntityId;
const lastMsg = await getLastConversationMessage(preferredEntityId, entity.id);
```

**Replace with** (use `impersonatedEntityId` from state — pass it as a parameter or close over it):

```typescript
// loadChatList now accepts the current impersonated entity as a parameter
const loadChatList = useCallback(async (activeEntityId: string) => {
  try {
    const entities = await getAllEntities();
    const listItems: ChatListItem[] = [];

    for (const entity of entities) {
      if (!entity.character_profile_id) continue;

      const lastMsg = await getLastConversationMessage(activeEntityId, entity.id);
      // ... rest of avatar / name loading unchanged ...
    }
    // ... sort and setChatList unchanged ...
  }
}, []);
```

Call it from `useFocusEffect` after `impersonatedEntityId` is resolved, or make `loadChatList` depend on `impersonatedEntityId` via a `useEffect`:

```typescript
useEffect(() => {
  if (impersonatedEntityId) {
    loadChatList(impersonatedEntityId);
  }
}, [impersonatedEntityId, loadChatList]);
```

---

## Task 4 — Replace `handleChatPress`

**Remove** the old handler entirely:
```typescript
// REMOVE: handleChatPress, handleEntitySelected, handleEntitySelectionCancel
```

**Add** two new handlers:

```typescript
const handleChatPress = (item: ChatListItem) => {
  navigation.navigate('ChatDetail', {
    partnerEntityId: item.entityId,
    partnerCharacterId: item.characterId || undefined,
    impersonatedEntityId,
  });
};

const handleImpersonationSelect = async (entityId: string) => {
  try {
    await ChatPreferencesService.setGlobalImpersonatedEntity(entityId);
    setImpersonatedEntityId(entityId);
    setSelectorModalVisible(false);
    // loadChatList will re-run via the useEffect that watches impersonatedEntityId
  } catch (error) {
    log.error('Failed to save global entity preference:', error);
    setSelectorModalVisible(false);
  }
};
```

---

## Task 5 — Add `ImpersonationSelectorBanner` inline component

Define this as a local component inside the file (or an inline JSX block in the render). Place it **between** `Appbar.Header` and the `FlatList` / not-paired view:

```tsx
{/* Impersonation Banner */}
<TouchableOpacity
  style={[styles.impersonationBanner, { backgroundColor: theme?.colors.background.elevated }]}
  onPress={() => setSelectorModalVisible(true)}
>
  {impersonatedEntityDisplay.avatarUri ? (
    <Avatar.Image size={32} source={{ uri: impersonatedEntityDisplay.avatarUri }} />
  ) : (
    <Avatar.Text
      size={32}
      label={impersonatedEntityDisplay.name.substring(0, 2).toUpperCase()}
    />
  )}
  <View style={styles.impersonationBannerText}>
    <ThemedText variant="muted" size={11}>Chatting as</ThemedText>
    <ThemedText variant="primary" size={14} style={{ fontWeight: '600' }}>
      {impersonatedEntityDisplay.name}
    </ThemedText>
  </View>
  <Icon name="chevron-down" size={20} color={theme?.colors.text.muted} />
</TouchableOpacity>
```

Add to `StyleSheet.create`:
```typescript
impersonationBanner: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 10,
  gap: 12,
},
impersonationBannerText: {
  flex: 1,
},
```

---

## Task 6 — Swap modal in JSX

**Remove:**
```tsx
<EntitySelectionModal
  visible={entityModalVisible}
  partnerEntityId={selectedPartner?.entityId || ''}
  onSelect={handleEntitySelected}
  onCancel={handleEntitySelectionCancel}
/>
```

**Add:**
```tsx
<ImpersonationSelectorModal
  visible={selectorModalVisible}
  onSelect={handleImpersonationSelect}
  onCancel={() => setSelectorModalVisible(false)}
  preSelectedEntityId={impersonatedEntityId}
/>
```

Update the import at the top:
```typescript
// Remove:
import { EntitySelectionModal } from '../components/modals/EntitySelectionModal';
// Add:
import { ImpersonationSelectorModal } from '../components/modals/ImpersonationSelectorModal';
```

---

## Task 7 — Update `InfoModal` text

Replace the `message` prop of the `InfoModal` with text describing the new flow:

```
Select an AI Entity from the list below to start chatting with. Each entity represents a unique AI personality you can interact with.

Use the "Chatting as" banner at the top to choose which persona you want to use. This determines how each AI entity relates to you — for example, you could chat as yourself, or adopt a fictional character.

AI Entities learn individual relationships during interaction and may behave very differently depending on the Persona you are using.
```

---

## Progress Checklist

- [ ] Remove `entityModalVisible`, `selectedPartner`, `defaultImpersonatedEntityId` state/constants
- [ ] Add `impersonatedEntityId`, `impersonatedEntityDisplay`, `selectorModalVisible` state
- [ ] Add `loadImpersonatedEntity` function
- [ ] Update `useFocusEffect` to also call `loadImpersonatedEntity`
- [ ] Update `loadChatList` to accept `activeEntityId` parameter instead of per-partner lookup
- [ ] Add `useEffect` to re-run `loadChatList` when `impersonatedEntityId` changes
- [ ] Replace `handleChatPress` with direct navigation version
- [ ] Remove `handleEntitySelected` and `handleEntitySelectionCancel`
- [ ] Add `handleImpersonationSelect` handler
- [ ] Add `ImpersonationSelectorBanner` JSX between Appbar and FlatList
- [ ] Add banner styles to `StyleSheet.create`
- [ ] Swap `EntitySelectionModal` → `ImpersonationSelectorModal` in JSX
- [ ] Update import statement for the modal
- [ ] Update `InfoModal` message text

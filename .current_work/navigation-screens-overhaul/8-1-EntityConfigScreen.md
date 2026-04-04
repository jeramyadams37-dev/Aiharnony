# Phase 8-1: EntityConfigScreen (Entity List)

## Objective
Implement the entity list/management screen — a power-user screen accessible from the chat list context menu, the character profile editor, and the hamburger nav menu. Displays all configured entities with their alias, linked character profile name, and module status chips. Allows creating new entities (→ `CreateAIScreen`), editing (→ `EntityConfigEditScreen`), and deleting.

## Files to Modify
- `src/screens/AIConfigScreen.tsx` → **rename to** `src/screens/EntityConfigScreen.tsx`

## Files to Create
- `src/components/entities/EntityCard.tsx` (Phase 8-3)

## Files to Reference
- `src/database/repositories/entities.ts` — `getAllEntities()`, `deleteEntity()`
- `src/database/repositories/characters.ts` — `getCharacterProfile()`
- `src/database/models.ts` — `Entity`, `EntityModuleMapping`

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│  ←  Entity Config                             [≡]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │  [👤 avatar]  Aria                          │   │
│  │               Character: Aria (profile)     │   │
│  │               [Cognition] [TTS]             │   │  ← module chips
│  │                                        [⋮]  │   │  ← context menu
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │  [👤 avatar]  e3f1...  (no alias)           │   │
│  │               No character profile          │   │
│  │               (no modules configured)       │   │
│  │                                        [⋮]  │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│                                         [+ FAB]     │
└─────────────────────────────────────────────────────┘
```

**Empty state:**
```
│            [🤖 icon large]                         │
│         No AI entities configured                  │
│   Tap + to create your first AI chat partner.      │
│                                                    │
│         [  + Create First AI  ]                    │
```

---

## Implementation

### Data model for list item

```typescript
interface EntityListItem {
  entity: Entity;
  characterProfileName: string | null;
  characterProfileImageUri: string | null;
  moduleMapping: EntityModuleMapping | null;
  activeModuleNames: string[]; // e.g. ['Cognition', 'TTS']
}
```

### Data loading

```typescript
const loadEntities = async () => {
  setIsLoading(true);
  try {
    const entities = await getAllEntities();
    const items: EntityListItem[] = await Promise.all(
      entities.map(async (entity) => {
        // Load character profile name + image
        let profileName: string | null = null;
        let profileImageUri: string | null = null;
        if (entity.character_profile_id) {
          const profile = await getCharacterProfile(entity.character_profile_id);
          profileName = profile?.name ?? null;
          if (profile) {
            const images = await getCharacterImages(profile.id);
            const primary = images.find(img => (img as any).is_primary === 1);
            profileImageUri = primary
              ? createDataURL((primary as any).format, (primary as any).data)
              : null;
          }
        }

        // Load module mapping
        const mapping = await getEntityModuleMapping(entity.id);

        // Determine active module names
        const activeModules: string[] = [];
        if (mapping) {
          if (mapping.cognition_config_id) activeModules.push('Cognition');
          if (mapping.tts_config_id) activeModules.push('TTS');
          if (mapping.stt_config_id) activeModules.push('STT');
          if (mapping.vision_config_id) activeModules.push('Vision');
          if (mapping.rag_config_id) activeModules.push('Memory');
          if (mapping.imagination_config_id) activeModules.push('Imagination');
        }

        return {
          entity,
          characterProfileName: profileName,
          characterProfileImageUri: profileImageUri,
          moduleMapping: mapping,
          activeModuleNames: activeModules,
        };
      })
    );
    setEntityItems(items);
  } catch (err) {
    console.error('Failed to load entities:', err);
  } finally {
    setIsLoading(false);
  }
};
```

> **Note:** `getEntityModuleMapping(entityId)` may need to be added to the entities repository. Check `src/database/repositories/entities.ts` for existing function. If missing, add:
> ```typescript
> export async function getEntityModuleMapping(entityId: string): Promise<EntityModuleMapping | null> {
>   const db = getDatabase();
>   const [results] = await db.executeSql(
>     'SELECT * FROM entity_module_mappings WHERE entity_id = ? AND deleted_at IS NULL',
>     [entityId]
>   );
>   if (results.rows.length === 0) return null;
>   const row = results.rows.item(0);
>   return {
>     entity_id: row.entity_id,
>     backend_config_id: row.backend_config_id,
>     cognition_config_id: row.cognition_config_id,
>     imagination_config_id: row.imagination_config_id,
>     movement_config_id: row.movement_config_id,
>     rag_config_id: row.rag_config_id,
>     stt_config_id: row.stt_config_id,
>     tts_config_id: row.tts_config_id,
>     vision_config_id: row.vision_config_id,
>     deleted_at: null,
>   };
> }
> ```

### Delete entity

```typescript
const handleDelete = (item: EntityListItem) => {
  Alert.alert(
    'Delete Entity',
    `Delete "${item.entity.alias ?? item.entity.id.substring(0, 8)}"? ` +
    'Chat history will be preserved but the entity will no longer be accessible.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntity(item.entity.id);
            setEntityItems(prev => prev.filter(e => e.entity.id !== item.entity.id));
          } catch {
            Alert.alert('Error', 'Failed to delete entity.');
          }
        },
      },
    ]
  );
};
```

### Full screen component

**File:** `src/screens/EntityConfigScreen.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import { StyleSheet, View, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Appbar, FAB } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAppTheme } from '../contexts/ThemeContext';
import { ThemedView } from '../components/themed/ThemedView';
import { ThemedText } from '../components/themed/ThemedText';
import { ThemedButton } from '../components/themed/ThemedButton';
import { SettingsMenu } from '../components/navigation/SettingsMenu';
import { EntityCard } from '../components/entities/EntityCard';
import { getAllEntities, getEntityModuleMapping, deleteEntity } from '../database/repositories/entities';
import { getCharacterProfile, getCharacterImages } from '../database/repositories/characters';
import { createDataURL } from '../database/base64';
import { Entity, EntityModuleMapping } from '../database/models';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ... (EntityListItem interface and loadEntities as above)

export const EntityConfigScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [entityItems, setEntityItems] = useState<EntityListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(useCallback(() => { loadEntities(); }, []));

  if (!theme) return null;

  return (
    <ThemedView style={styles.container}>
      <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.background.surface }]}>
        <Appbar.BackAction color={theme.colors.text.primary} onPress={() => navigation.goBack()} />
        <Appbar.Content
          title="Entity Config"
          titleStyle={{ color: theme.colors.text.primary, fontWeight: 'bold' }}
        />
        <Appbar.Action
          icon="menu"
          color={theme.colors.text.primary}
          onPress={() => setMenuVisible(true)}
        />
      </Appbar.Header>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      ) : entityItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="robot-outline" size={72} color={theme.colors.text.muted} />
          <ThemedText weight="bold" size={18} style={styles.emptyTitle}>
            No entities configured
          </ThemedText>
          <ThemedText variant="muted" size={14} style={styles.emptySubtext}>
            Create an AI entity to start chatting.
          </ThemedText>
          <ThemedButton
            mode="contained"
            icon="plus"
            onPress={() => navigation.navigate('CreateAI', {})}
            style={styles.emptyButton}
          >
            Create First AI
          </ThemedButton>
        </View>
      ) : (
        <FlatList
          data={entityItems}
          keyExtractor={(item) => item.entity.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <EntityCard
              item={item}
              onPress={() => navigation.navigate('EntityConfigEdit', { entityId: item.entity.id })}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.accent.primary }]}
        onPress={() => navigation.navigate('CreateAI', {})}
        color="#fff"
      />

      <SettingsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onNavigate={(screen) => navigation.navigate(screen as any)}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { elevation: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12, paddingBottom: 80 },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 32, gap: 12,
  },
  emptyTitle: { textAlign: 'center', marginTop: 12 },
  emptySubtext: { textAlign: 'center' },
  emptyButton: { marginTop: 8 },
  fab: { position: 'absolute', bottom: 24, right: 24 },
});
```

---

## Progress Checklist

- [ ] Rename `src/screens/AIConfigScreen.tsx` → `src/screens/EntityConfigScreen.tsx`
- [ ] Update import in `AppNavigator.tsx` to reference `EntityConfigScreen`
- [ ] Add `getEntityModuleMapping()` to entities repository if missing
- [ ] Add `deleteEntity()` to entities repository if missing (soft delete pattern)
- [ ] Test: entity list renders with alias display
- [ ] Test: character profile name shown under entity alias
- [ ] Test: module chips render correctly
- [ ] Test: FAB navigates to `CreateAI`
- [ ] Test: tap entity card navigates to `EntityConfigEdit`
- [ ] Test: delete entity removes it from list
- [ ] Test: empty state renders with "Create First AI" button
- [ ] Test: list refreshes on `useFocusEffect` after returning from `EntityConfigEdit`

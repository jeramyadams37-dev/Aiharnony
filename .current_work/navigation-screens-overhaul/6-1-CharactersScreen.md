# Phase 6-1: Characters Screen (Full Implementation)

## Objective
Replace the current `CharactersScreen` stub with a fully functional character profile management screen. Displays a searchable, 2-column grid of character profile cards. Users can create new profiles (FAB → `CharacterProfileEditScreen`), edit existing ones (tap card), or delete (long-press).

## Files to Modify
- `src/screens/CharactersScreen.tsx` — full rewrite of stub

## Files Referenced
- `src/database/repositories/characters.ts` — `getAllCharacterProfiles()`, `deleteCharacterProfile()`
- `src/database/models.ts` — `CharacterProfile`, `CharacterImage`
- `src/components/characters/CharacterProfileCard.tsx` — (from Phase 6-2)
- Harmony Link reference: `CharacterProfilesView.jsx`

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│  ←  AI Characters                             [≡]   │  ← appbar with back + hamburger
├─────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐   │
│  │  🔍  Search characters...                   │   │  ← search bar
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────┐  ┌─────────────┐                  │
│  │  [Avatar]   │  │  [Avatar]   │                  │
│  │             │  │             │                  │  ← 3:4 aspect ratio image
│  │  Aria       │  │  Luna       │                  │
│  │  Playful... │  │  Calm...    │                  │
│  └─────────────┘  └─────────────┘                  │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐                  │
│  │  [Avatar]   │  │  [+ New]    │                  │
│  │             │  │             │                  │
│  │  Max        │  │  Create     │                  │
│  │  Adventur.. │  │  Profile    │                  │
│  └─────────────┘  └─────────────┘                  │
│                                                      │
│                                          [+  FAB]   │  ← floating action button
└─────────────────────────────────────────────────────┘
```

**Empty state (no profiles yet):**
```
│                                                      │
│            [👤 icon large]                          │
│         No character profiles yet                   │
│    Create a profile to start chatting with          │
│              an AI character.                       │
│                                                     │
│         [  + Create First Profile  ]                │
│                                                     │
```

---

## Implementation

### Data Loading Strategy

Load profiles from the local SQLite DB (`getAllCharacterProfiles()`). For each profile, load its primary image (`getCharacterImages(id)`) and find the one with `is_primary = 1`. Store images in a map keyed by profile ID to avoid redundant loads.

```typescript
// Load all profiles + their primary images
const loadProfiles = async () => {
  setIsLoading(true);
  try {
    const data = await getAllCharacterProfiles();
    setProfiles(data);

    // Load primary images for all profiles in parallel
    const imageMap: Record<string, string | null> = {};
    await Promise.all(
      data.map(async (profile) => {
        const images = await getCharacterImages(profile.id);
        const primary = images.find(img => img.is_primary === 1);
        imageMap[profile.id] = primary ? createDataURL(primary.format, primary.data) : null;
      })
    );
    setPrimaryImages(imageMap);
  } catch (err) {
    console.error('Failed to load profiles:', err);
  } finally {
    setIsLoading(false);
  }
};
```

> **Note:** `getCharacterImages()` and `createDataURL()` are from `src/database/repositories/characters.ts` and `src/database/base64.ts`.

### Long-press Delete Flow

```typescript
const handleLongPress = (profile: CharacterProfile) => {
  Alert.alert(
    'Delete Profile',
    `Are you sure you want to delete "${profile.name}"? This cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCharacterProfile(profile.id);
            setProfiles(prev => prev.filter(p => p.id !== profile.id));
            setPrimaryImages(prev => {
              const next = { ...prev };
              delete next[profile.id];
              return next;
            });
          } catch (err) {
            Alert.alert('Error', 'Failed to delete profile.');
          }
        },
      },
    ]
  );
};
```

### Full Screen Component

**File:** `src/screens/CharactersScreen.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Appbar, FAB } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAppTheme } from '../contexts/ThemeContext';
import { ThemedView } from '../components/themed/ThemedView';
import { ThemedText } from '../components/themed/ThemedText';
import { ThemedButton } from '../components/themed/ThemedButton';
import { SettingsMenu } from '../components/navigation/SettingsMenu';
import { CharacterProfileCard } from '../components/characters/CharacterProfileCard';
import { getAllCharacterProfiles, getCharacterImages, deleteCharacterProfile } from '../database/repositories/characters';
import { createDataURL } from '../database/base64';
import { CharacterProfile } from '../database/models';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const CharactersScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();

  const [menuVisible, setMenuVisible] = useState(false);
  const [profiles, setProfiles] = useState<CharacterProfile[]>([]);
  const [primaryImages, setPrimaryImages] = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Reload on focus (handles return from edit screen)
  useFocusEffect(
    useCallback(() => {
      loadProfiles();
    }, [])
  );

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const data = await getAllCharacterProfiles();
      setProfiles(data);

      const imageMap: Record<string, string | null> = {};
      await Promise.all(
        data.map(async (profile) => {
          try {
            const images = await getCharacterImages(profile.id);
            const primary = images.find(img => (img as any).is_primary === 1);
            imageMap[profile.id] = primary
              ? createDataURL((primary as any).format, (primary as any).data)
              : null;
          } catch {
            imageMap[profile.id] = null;
          }
        })
      );
      setPrimaryImages(imageMap);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleEdit = (profile: CharacterProfile) => {
    navigation.navigate('CharacterProfileEdit', { profileId: profile.id });
  };

  const handleLongPress = (profile: CharacterProfile) => {
    Alert.alert(
      'Delete Profile',
      `Delete "${profile.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCharacterProfile(profile.id);
              setProfiles(prev => prev.filter(p => p.id !== profile.id));
            } catch {
              Alert.alert('Error', 'Failed to delete profile.');
            }
          },
        },
      ]
    );
  };

  const handleCreateNew = () => {
    navigation.navigate('CharacterProfileEdit', {}); // no profileId = create mode
  };

  if (!theme) return null;

  return (
    <ThemedView style={styles.container}>
      {/* Appbar */}
      <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.background.surface }]}>
        <Appbar.BackAction color={theme.colors.text.primary} onPress={() => navigation.goBack()} />
        <Appbar.Content
          title="AI Characters"
          titleStyle={{ color: theme.colors.text.primary, fontWeight: 'bold' }}
        />
        <Appbar.Action
          icon="menu"
          color={theme.colors.text.primary}
          onPress={() => setMenuVisible(true)}
        />
      </Appbar.Header>

      {/* Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.background.surface }]}>
        <Icon name="magnify" size={20} color={theme.colors.text.muted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text.primary }]}
          placeholder="Search characters..."
          placeholderTextColor={theme.colors.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      ) : filteredProfiles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="account-outline" size={72} color={theme.colors.text.muted} />
          <ThemedText weight="bold" size={18} style={styles.emptyTitle}>
            {searchQuery ? 'No results found' : 'No character profiles yet'}
          </ThemedText>
          <ThemedText variant="muted" size={14} style={styles.emptySubtext}>
            {searchQuery
              ? 'Try a different search term.'
              : 'Create a character profile to start chatting.'}
          </ThemedText>
          {!searchQuery && (
            <ThemedButton
              mode="contained"
              onPress={handleCreateNew}
              icon="plus"
              style={styles.emptyButton}
            >
              Create First Profile
            </ThemedButton>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredProfiles}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <CharacterProfileCard
              profile={item}
              imageUri={primaryImages[item.id] ?? null}
              onPress={() => handleEdit(item)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
        />
      )}

      {/* FAB */}
      {!isLoading && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.accent.primary }]}
          onPress={handleCreateNew}
          color="#fff"
        />
      )}

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, fontSize: 15 },
  listContent: { padding: 12, paddingBottom: 80 },
  columnWrapper: { gap: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: { textAlign: 'center', marginTop: 12 },
  emptySubtext: { textAlign: 'center' },
  emptyButton: { marginTop: 8 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
});
```

---

## Key Checks

- `getAllCharacterProfiles()` must exist in `src/database/repositories/characters.ts`. Verify its signature matches `CharacterProfile[]` return type.
- `getCharacterImages(profileId)` — check if this function exists or if it's called `getCharacterImagesByProfile()`. Adjust accordingly.
- `deleteCharacterProfile(id)` — verify the function is a soft delete (sets `deleted_at`) consistent with other repository patterns.
- `useFocusEffect` ensures the list refreshes when returning from `CharacterProfileEditScreen`.

---

## Progress Checklist

- [ ] Rewrite `src/screens/CharactersScreen.tsx` (remove stub)
- [ ] Verify `getAllCharacterProfiles()` exists in characters repository
- [ ] Verify `getCharacterImages()` function name and signature
- [ ] Verify `deleteCharacterProfile()` is implemented (soft delete)
- [ ] Verify `createDataURL()` from `src/database/base64.ts` accepts format + data
- [ ] Test: profile grid renders with 2 columns
- [ ] Test: search filters profiles correctly
- [ ] Test: long-press shows delete confirmation
- [ ] Test: delete removes card from grid
- [ ] Test: FAB navigates to `CharacterProfileEdit` (create mode)
- [ ] Test: tap card navigates to `CharacterProfileEdit` (edit mode with profileId)
- [ ] Test: screen reloads when returning from edit screen (useFocusEffect)
- [ ] Test: empty state renders correctly with "Create First Profile" button

# Phase 8-2: EntityConfigEditScreen

## Objective
Implement the entity detail edit screen — a power-user screen for viewing and editing a fully configured entity. Allows changing the alias, linking/changing a character profile, and configuring module bindings for each module type. Includes a "Danger Zone" delete section.

## Files to Create
- `src/screens/EntityConfigEditScreen.tsx`
- `src/components/entities/EntityModuleSelector.tsx`

## Files to Reference
- `src/database/repositories/entities.ts` — `getEntity()`, `updateEntity()`, `updateEntityAlias()`, `getEntityModuleMapping()`, `createOrUpdateEntityModuleMapping()`, `deleteEntity()`
- `src/database/repositories/characters.ts` — `getAllCharacterProfiles()`, `getCharacterProfile()`, `getCharacterImages()`
- `src/database/repositories/modules.ts` — `getAllModuleConfigs(type)`
- `src/database/models.ts` — `Entity`, `EntityModuleMapping`, `CharacterProfile`
- Harmony Link reference: `EntitySettingsView.jsx`

---

## Route Parameters

```typescript
// From RootStackParamList:
EntityConfigEdit: { entityId?: string }

// entityId === undefined → this screen is not used for create (CreateAIScreen handles that)
// entityId is always set when navigating here from EntityConfigScreen
```

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│  ←  Entity Settings                            [✓]  │  ← Save in header
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ Identity ────────────────────────────────────┐  │
│  │  Name / Alias                                 │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Aria                                   │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │  (Must be unique. Defaults to profile name.)  │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Character Profile ───────────────────────────┐  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Aria (character profile name)      ▾  │  │  │  ← picker/selector
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  ┌────────────────────────────────────────┐  │  │
│  │  │  [Avatar] Aria                         │  │  │  ← profile preview card
│  │  │  Playful AI companion...               │  │  │
│  │  │            [✏ Edit Profile]            │  │  │
│  │  └────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Module Configuration ────────────────────────┐  │
│  │  Backend / Cognition                          │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Cloud AI — Default               ▾    │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  Text-to-Speech (TTS)                         │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Disabled                          ▾    │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  Speech-to-Text (STT)     [Disabled ▾]       │  │
│  │  Vision                   [Disabled ▾]       │  │
│  │  Memory / RAG             [Disabled ▾]       │  │
│  │  Imagination              [Disabled ▾]       │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Danger Zone ─────────────────────────────────┐  │
│  │  [ 🗑  Delete Entity ]                        │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## EntityModuleSelector Component

**File:** `src/components/entities/EntityModuleSelector.tsx`

A labeled dropdown selector for a single module type. Shows "Disabled" as first option, then available configs.

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAppTheme } from '../../contexts/ThemeContext';
import { ThemedText } from '../themed/ThemedText';

interface ModuleConfig {
  id: number;
  name: string;
}

interface EntityModuleSelectorProps {
  label: string;
  configs: ModuleConfig[];
  selectedId: string;  // '' = disabled
  onChange: (id: string) => void;
  isLoading?: boolean;
}

export const EntityModuleSelector: React.FC<EntityModuleSelectorProps> = ({
  label, configs, selectedId, onChange, isLoading = false,
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <ThemedText size={13} variant="secondary" style={styles.label}>
        {label}
      </ThemedText>
      <View style={[
        styles.pickerWrapper,
        { borderColor: theme?.colors.border.default, backgroundColor: theme?.colors.background.elevated }
      ]}>
        <Picker
          selectedValue={selectedId}
          onValueChange={onChange}
          enabled={!isLoading}
          style={{ color: theme?.colors.text.primary }}
          dropdownIconColor={theme?.colors.text.muted}
        >
          <Picker.Item label="Disabled" value="" color={theme?.colors.text.muted} />
          {configs.map(config => (
            <Picker.Item
              key={config.id}
              label={config.name}
              value={String(config.id)}
              color={theme?.colors.text.primary}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 6, marginBottom: 12 },
  label: { paddingLeft: 2 },
  pickerWrapper: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
```

---

## Screen Implementation

**File:** `src/screens/EntityConfigEditScreen.tsx`

### State

```typescript
const { entityId } = route.params ?? {};

// Identity
const [alias, setAlias] = useState('');

// Character profile
const [allProfiles, setAllProfiles] = useState<CharacterProfile[]>([]);
const [selectedProfileId, setSelectedProfileId] = useState<string>('');
const [selectedProfile, setSelectedProfile] = useState<CharacterProfile | null>(null);
const [selectedProfileImageUri, setSelectedProfileImageUri] = useState<string | null>(null);

// Module configs — available options
const [cognitionConfigs, setCognitionConfigs] = useState<ModuleConfig[]>([]);
const [ttsConfigs, setTtsConfigs] = useState<ModuleConfig[]>([]);
const [sttConfigs, setSttConfigs] = useState<ModuleConfig[]>([]);
const [visionConfigs, setVisionConfigs] = useState<ModuleConfig[]>([]);
const [ragConfigs, setRagConfigs] = useState<ModuleConfig[]>([]);
const [imaginationConfigs, setImaginationConfigs] = useState<ModuleConfig[]>([]);

// Module configs — selected values
const [cognitionId, setCognitionId] = useState('');
const [ttsId, setTtsId] = useState('');
const [sttId, setSttId] = useState('');
const [visionId, setVisionId] = useState('');
const [ragId, setRagId] = useState('');
const [imaginationId, setImaginationId] = useState('');

// UI state
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
```

### Load on mount

```typescript
useEffect(() => {
  if (entityId) loadEntityData(entityId);
}, [entityId]);

const loadEntityData = async (id: string) => {
  setIsLoading(true);
  try {
    // Load entity
    const entity = await getEntity(id);
    if (!entity) {
      Alert.alert('Error', 'Entity not found.');
      navigation.goBack();
      return;
    }
    setAlias(entity.alias ?? '');

    // Load all profiles for the selector
    const profiles = await getAllCharacterProfiles();
    setAllProfiles(profiles);

    // Pre-select current profile
    if (entity.character_profile_id) {
      setSelectedProfileId(entity.character_profile_id);
      const profile = profiles.find(p => p.id === entity.character_profile_id) ?? null;
      setSelectedProfile(profile);
      if (profile) {
        await loadProfileImage(profile.id);
      }
    }

    // Load module mapping
    const mapping = await getEntityModuleMapping(id);
    if (mapping) {
      setCognitionId(String(mapping.cognition_config_id ?? ''));
      setTtsId(String(mapping.tts_config_id ?? ''));
      setSttId(String(mapping.stt_config_id ?? ''));
      setVisionId(String(mapping.vision_config_id ?? ''));
      setRagId(String(mapping.rag_config_id ?? ''));
      setImaginationId(String(mapping.imagination_config_id ?? ''));
    }

    // Load available module configs
    const [cognition, tts, stt, vision, rag, imagination] = await Promise.all([
      getAllModuleConfigs('cognition'),
      getAllModuleConfigs('tts'),
      getAllModuleConfigs('stt'),
      getAllModuleConfigs('vision'),
      getAllModuleConfigs('rag'),
      getAllModuleConfigs('imagination'),
    ]);
    setCognitionConfigs(cognition);
    setTtsConfigs(tts);
    setSttConfigs(stt);
    setVisionConfigs(vision);
    setRagConfigs(rag);
    setImaginationConfigs(imagination);

  } catch (err) {
    console.error('Failed to load entity:', err);
  } finally {
    setIsLoading(false);
  }
};
```

### Profile selection handler

When user picks a different profile in the selector, update preview:
```typescript
const handleProfileChange = async (profileId: string) => {
  setSelectedProfileId(profileId);
  const profile = allProfiles.find(p => p.id === profileId) ?? null;
  setSelectedProfile(profile);
  setSelectedProfileImageUri(null);
  if (profile) {
    await loadProfileImage(profile.id);
    // Auto-update alias to match profile name if alias is currently empty or was previously the old profile name
    if (!alias || alias === selectedProfile?.name) {
      setAlias(profile.name);
    }
  }
};
```

### Save logic

```typescript
const handleSave = async () => {
  if (!entityId) return;

  if (alias.trim()) {
    // Validate uniqueness via repository (throws on conflict)
    try {
      await updateEntityAlias(entityId, alias.trim());
    } catch (err: any) {
      Alert.alert('Alias Conflict', err.message ?? 'That alias is already taken.');
      return;
    }
  }

  setIsSaving(true);
  try {
    // Update entity character profile link
    await updateEntity(entityId, {
      character_profile_id: selectedProfileId || null,
      alias: alias.trim() || null,
    });

    // Update module mapping
    await createOrUpdateEntityModuleMapping({
      entity_id: entityId,
      cognition_config_id: cognitionId ? parseInt(cognitionId) : null,
      backend_config_id: cognitionId ? parseInt(cognitionId) : null, // backend = cognition for now
      tts_config_id: ttsId ? parseInt(ttsId) : null,
      stt_config_id: sttId ? parseInt(sttId) : null,
      vision_config_id: visionId ? parseInt(visionId) : null,
      rag_config_id: ragId ? parseInt(ragId) : null,
      imagination_config_id: imaginationId ? parseInt(imaginationId) : null,
      movement_config_id: null,
    });

    navigation.goBack();
  } catch (err) {
    Alert.alert('Error', 'Failed to save entity settings.');
  } finally {
    setIsSaving(false);
  }
};
```

### Delete entity handler

```typescript
const handleDelete = () => {
  Alert.alert(
    'Delete Entity',
    'This will permanently remove the entity configuration. Chat history will be preserved but the entity will no longer be accessible.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntity(entityId!);
            navigation.navigate('EntityConfig'); // go back to list
          } catch {
            Alert.alert('Error', 'Failed to delete entity.');
          }
        },
      },
    ]
  );
};
```

### Profile preview card

A small inline card shown below the profile selector:

```typescript
const renderProfilePreview = () => {
  if (!selectedProfile) return null;
  return (
    <View style={[styles.profilePreview, { backgroundColor: theme.colors.background.base, borderColor: theme.colors.border.default }]}>
      {selectedProfileImageUri ? (
        <Image source={{ uri: selectedProfileImageUri }} style={styles.previewAvatar} />
      ) : (
        <View style={[styles.previewAvatarPlaceholder, { backgroundColor: theme.colors.background.elevated }]}>
          <Icon name="account" size={24} color={theme.colors.text.muted} />
        </View>
      )}
      <View style={styles.previewText}>
        <ThemedText weight="bold" size={14}>{selectedProfile.name}</ThemedText>
        <ThemedText variant="muted" size={12} numberOfLines={1}>
          {selectedProfile.description ?? 'No description'}
        </ThemedText>
      </View>
      <TouchableOpacity
        onPress={() => navigation.navigate('CharacterProfileEdit', { profileId: selectedProfile.id })}
        style={styles.editProfileButton}
      >
        <Icon name="pencil" size={18} color={theme.colors.accent.primary} />
      </TouchableOpacity>
    </View>
  );
};
```

---

## Required Repository Functions

Verify/add these:
- `getEntity(id)` ✓
- `updateEntity(id, fields)` — verify signature; may need to add `alias` to update fields
- `updateEntityAlias(id, alias)` — added in Phase 1
- `getEntityModuleMapping(id)` — add if missing (noted in Phase 8-1)
- `createOrUpdateEntityModuleMapping()` — add if missing (noted in Phase 7)
- `deleteEntity(id)` — verify soft delete pattern
- `getAllCharacterProfiles()` — verify exists in characters repository
- `getAllModuleConfigs(type)` — verify in modules repository

### `updateEntity()` signature to support:
```typescript
export async function updateEntity(
  id: string,
  fields: Partial<Pick<Entity, 'character_profile_id' | 'alias' | 'lifecycle_config'>>
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const setClauses: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if ('character_profile_id' in fields) {
    setClauses.push('character_profile_id = ?');
    values.push(fields.character_profile_id ?? null);
  }
  if ('alias' in fields) {
    setClauses.push('alias = ?');
    values.push(fields.alias ?? null);
  }
  if ('lifecycle_config' in fields) {
    setClauses.push('lifecycle_config = ?');
    values.push(fields.lifecycle_config ?? null);
  }
  values.push(id);
  await db.executeSql(
    `UPDATE entities SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    values
  );
}
```

---

## Progress Checklist

- [ ] Create `src/components/entities/EntityModuleSelector.tsx`
- [ ] Create `src/screens/EntityConfigEditScreen.tsx`
- [ ] Verify `updateEntity()` in entities repository accepts `alias` field; update if needed
- [ ] Verify `getAllModuleConfigs(type)` exists and returns correct shape
- [ ] Verify `deleteEntity()` soft-delete exists
- [ ] Add `getEntityModuleMapping()` if missing (see Phase 8-1 notes)
- [ ] Add `createOrUpdateEntityModuleMapping()` if missing (see Phase 7 notes)
- [ ] Test: screen loads entity data correctly
- [ ] Test: alias field pre-filled from entity data
- [ ] Test: profile selector shows all profiles
- [ ] Test: profile preview card shows after selection
- [ ] Test: "Edit Profile" shortcut navigates to `CharacterProfileEdit`
- [ ] Test: module selectors populate from DB
- [ ] Test: "Disabled" option selectable for each module
- [ ] Test: alias uniqueness validation error shown correctly
- [ ] Test: save updates entity + module mapping
- [ ] Test: delete entity with confirmation dialog → navigates to `EntityConfig`
- [ ] Test: Picker displays correctly on both iOS and Android

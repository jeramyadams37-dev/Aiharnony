# Phase 7: Create AI Screen

## Objective
Implement the guided entity creation wizard as a full push screen. Allows users to create a new AI chat partner in under 60 seconds using progressive disclosure — simple fields up front, advanced module config hidden behind a toggle. On save: creates a `CharacterProfile` + an `Entity` (with alias) + navigates directly to `ChatDetailScreen`.

## Files to Create
- `src/screens/CreateAIScreen.tsx`

## Files to Reference
- `src/database/repositories/characters.ts` — `createCharacterProfile()`
- `src/database/repositories/entities.ts` — `createEntity()`, `updateEntityAlias()`
- `src/database/repositories/modules.ts` — `getAllModuleConfigs(type)` (for advanced section)
- `src/database/models.ts` — `Entity`, `CharacterProfile`, `EntityModuleMapping`
- `src/utils/uuid.ts` — UUID generation
- `src/contexts/SyncConnectionContext.tsx` — check if connected (needed for module list)
- `src/components/themed/ThemedButton.tsx`, `ThemedText.tsx`, `ThemedView.tsx`

---

## Route Parameters

```typescript
// From RootStackParamList:
CreateAI: { prefillProfileId?: string }

// prefillProfileId: if coming from CharacterProfileEditScreen's
// "Create Entity with this Profile" shortcut, pre-selects a profile
```

---

## Visual Design

### Standard (collapsed) state:

```
┌─────────────────────────────────────────────────────┐
│  ←  Create AI Partner                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│          ┌─────────────────┐                        │
│          │   [+  Photo]    │  ← tap to pick avatar  │
│          │   (optional)    │     from device gallery │
│          └─────────────────┘                        │
│                                                      │
│  Name *                                              │
│  ┌──────────────────────────────────────────────┐   │
│  │  e.g. Aria, Max, Luna...                     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Personality (optional)                              │
│  ┌──────────────────────────────────────────────┐   │
│  │  e.g. Helpful, playful, curious...           │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  ▸ Advanced Settings                        │   │  ← collapsed
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Start Chatting  →                   │   │  ← primary CTA
│  └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### With "Advanced Settings" expanded:

```
│  ┌──────────────────────────────────────────────┐   │
│  │  ▾ Advanced Settings                        │   │  ← expanded
│  │                                              │   │
│  │  Backend / Cognition                         │   │
│  │  ┌────────────────────────────────────────┐ │   │
│  │  │  Cloud AI (default)               ▾   │ │   │
│  │  └────────────────────────────────────────┘ │   │
│  │                                              │   │
│  │  Text-to-Speech (TTS)                        │   │
│  │  ┌────────────────────────────────────────┐ │   │
│  │  │  Disabled                          ▾   │ │   │
│  │  └────────────────────────────────────────┘ │   │
│  │                                              │   │
│  │  Speech-to-Text (STT)                        │   │
│  │  ┌────────────────────────────────────────┐ │   │
│  │  │  Disabled                          ▾   │ │   │
│  │  └────────────────────────────────────────┘ │   │
│  │                                              │   │
│  │  Vision                                      │   │
│  │  ┌────────────────────────────────────────┐ │   │
│  │  │  Disabled                          ▾   │ │   │
│  │  └────────────────────────────────────────┘ │   │
│  │                                              │   │
│  │  Memory / RAG                                │   │
│  │  ┌────────────────────────────────────────┐ │   │
│  │  │  Disabled                          ▾   │ │   │
│  │  └────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
```

### No module configs available:

```
│  ┌──────────────────────────────────────────────┐   │
│  │  ▾ Advanced Settings                        │   │
│  │                                              │   │
│  │  ⚠ No AI modules configured.               │   │
│  │    Connect to Harmony Link or Cloud to      │   │
│  │    configure AI backends.                   │   │
│  │                                              │   │
│  │    [→  Connection Setup]                    │   │
│  └──────────────────────────────────────────────┘   │
```

---

## Implementation Steps

### State

```typescript
// Core fields
const [name, setName] = useState('');
const [personality, setPersonality] = useState('');
const [avatarUri, setAvatarUri] = useState<string | null>(null);
const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
const [avatarFormat, setAvatarFormat] = useState<string>('jpeg');

// Advanced toggle
const [showAdvanced, setShowAdvanced] = useState(false);

// Module config selectors (advanced)
const [cognitionConfigId, setCognitionConfigId] = useState<string>('');
const [ttsConfigId, setTtsConfigId] = useState<string>('');
const [sttConfigId, setSttConfigId] = useState<string>('');
const [visionConfigId, setVisionConfigId] = useState<string>('');
const [ragConfigId, setRagConfigId] = useState<string>('');

// Available module configs (loaded when advanced opens)
const [cognitionConfigs, setCognitionConfigs] = useState<ModuleConfig[]>([]);
const [ttsConfigs, setTtsConfigs] = useState<ModuleConfig[]>([]);
const [sttConfigs, setSttConfigs] = useState<ModuleConfig[]>([]);
const [visionConfigs, setVisionConfigs] = useState<ModuleConfig[]>([]);
const [ragConfigs, setRagConfigs] = useState<ModuleConfig[]>([]);
const [hasAnyConfigs, setHasAnyConfigs] = useState<boolean | null>(null); // null = loading

// UI state
const [isSaving, setIsSaving] = useState(false);
```

### Load module configs when advanced expands

```typescript
useEffect(() => {
  if (showAdvanced && hasAnyConfigs === null) {
    loadModuleConfigs();
  }
}, [showAdvanced]);

const loadModuleConfigs = async () => {
  try {
    const [cognition, tts, stt, vision, rag] = await Promise.all([
      getAllModuleConfigs('cognition'),
      getAllModuleConfigs('tts'),
      getAllModuleConfigs('stt'),
      getAllModuleConfigs('vision'),
      getAllModuleConfigs('rag'),
    ]);
    setCognitionConfigs(cognition);
    setTtsConfigs(tts);
    setSttConfigs(stt);
    setVisionConfigs(vision);
    setRagConfigs(rag);
    setHasAnyConfigs(
      cognition.length > 0 || tts.length > 0 || stt.length > 0 ||
      vision.length > 0 || rag.length > 0
    );
  } catch {
    setHasAnyConfigs(false);
  }
};
```

### Avatar picker

```typescript
const handlePickAvatar = async () => {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    includeBase64: true,
    quality: 0.7,
  });
  if (result.assets?.[0]) {
    const asset = result.assets[0];
    setAvatarUri(asset.uri ?? null);
    setAvatarBase64(asset.base64 ?? null);
    setAvatarFormat(asset.type?.split('/')[1] ?? 'jpeg');
  }
};
```

### Save & Create

```typescript
const handleCreate = async () => {
  if (!name.trim()) {
    Alert.alert('Name Required', 'Please give your AI a name.');
    return;
  }

  setIsSaving(true);
  try {
    const profileId = generateUUID();
    const entityId = generateUUID();

    // 1. Create character profile
    await createCharacterProfile({
      id: profileId,
      name: name.trim(),
      description: personality.trim() || null,
      personality: personality.trim() || null,
      appearance: null,
      backstory: null,
      voice_characteristics: null,
      typing_speed_wpm: 60,
      audio_response_chance_percent: 50,
      vision_config_id: null,
      lifecycle_config: null,
      base_prompt: null,
      scenario: null,
      example_dialogues: null,
    });

    // 2. Add avatar image if selected
    if (avatarBase64 && avatarFormat) {
      await createCharacterImage({
        character_profile_id: profileId,
        data: avatarBase64,
        format: avatarFormat,
        is_primary: 1,
      });
    }

    // 3. Create entity with alias = name
    await createEntity({
      id: entityId,
      alias: name.trim(),
      character_profile_id: profileId,
      lifecycle_config: null,
    });

    // 4. Create entity module mapping (with selected or empty configs)
    await createOrUpdateEntityModuleMapping({
      entity_id: entityId,
      backend_config_id: cognitionConfigId ? parseInt(cognitionConfigId) : null,
      cognition_config_id: cognitionConfigId ? parseInt(cognitionConfigId) : null,
      tts_config_id: ttsConfigId ? parseInt(ttsConfigId) : null,
      stt_config_id: sttConfigId ? parseInt(sttConfigId) : null,
      vision_config_id: visionConfigId ? parseInt(visionConfigId) : null,
      rag_config_id: ragConfigId ? parseInt(ragConfigId) : null,
      imagination_config_id: null,
      movement_config_id: null,
    });

    // 5. Navigate to ChatDetail with the new entity
    navigation.replace('ChatDetail', { entityId });

  } catch (err: any) {
    Alert.alert('Error', 'Failed to create AI partner: ' + (err?.message ?? 'Unknown error'));
  } finally {
    setIsSaving(false);
  }
};
```

> **Note:** `navigation.replace()` is used instead of `navigate()` so the back button from ChatDetail goes to ChatList, not back to CreateAI (which would be confusing after creation).

### Module config selector component (inline)

A small reusable picker component used for each module type in the advanced section. Uses `Picker` from `@react-native-picker/picker` or a `ThemedSelect`-style dropdown:

```typescript
const ModuleConfigPicker = ({ label, configs, value, onChange }) => {
  const { theme } = useAppTheme();
  return (
    <View style={styles.pickerRow}>
      <ThemedText size={13} variant="secondary" style={styles.pickerLabel}>
        {label}
      </ThemedText>
      <View style={[styles.pickerContainer, { borderColor: theme.colors.border.default }]}>
        <Picker
          selectedValue={value}
          onValueChange={onChange}
          style={{ color: theme.colors.text.primary }}
          dropdownIconColor={theme.colors.text.muted}
        >
          <Picker.Item label="Disabled" value="" />
          {configs.map(config => (
            <Picker.Item
              key={config.id}
              label={config.name}
              value={String(config.id)}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
};
```

> **Note on `@react-native-picker/picker`:** Confirm this package is in `package.json`. If not, check what `EntityConfigEditScreen` uses (Phase 8) — they should use the same picker approach for consistency.

---

## Required Repository Functions

Verify these exist:
- `createCharacterProfile()` ✓
- `createCharacterImage()` — verify signature
- `createEntity()` — needs `alias` field after Phase 1 migration
- `getAllModuleConfigs(type: string)` — from `src/database/repositories/modules.ts`, verify
- `createOrUpdateEntityModuleMapping()` — verify exists in entities repository

If `createOrUpdateEntityModuleMapping()` doesn't exist, add:
```typescript
export async function createOrUpdateEntityModuleMapping(
  mapping: Omit<EntityModuleMapping, 'deleted_at'>
): Promise<void> {
  const db = getDatabase();
  await db.executeSql(
    `INSERT OR REPLACE INTO entity_module_mappings
     (entity_id, backend_config_id, cognition_config_id, imagination_config_id,
      movement_config_id, rag_config_id, stt_config_id, tts_config_id, vision_config_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mapping.entity_id,
      mapping.backend_config_id ?? null,
      mapping.cognition_config_id ?? null,
      mapping.imagination_config_id ?? null,
      mapping.movement_config_id ?? null,
      mapping.rag_config_id ?? null,
      mapping.stt_config_id ?? null,
      mapping.tts_config_id ?? null,
      mapping.vision_config_id ?? null,
    ]
  );
}
```

---

## Progress Checklist

- [ ] Create `src/screens/CreateAIScreen.tsx`
- [ ] Verify `getAllModuleConfigs(type)` in modules repository — check function name/signature
- [ ] Add `createOrUpdateEntityModuleMapping()` to entities repository if missing
- [ ] Verify `createEntity()` accepts `alias` field (after Phase 1 migration)
- [ ] Test: screen renders with empty form
- [ ] Test: name field validation (required)
- [ ] Test: avatar picker opens device gallery
- [ ] Test: avatar displays after selection
- [ ] Test: Advanced Settings toggle shows/hides module selectors
- [ ] Test: module config dropdowns populate from DB
- [ ] Test: "no configs" warning shown when no module configs exist
- [ ] Test: "Connection Setup" link in no-configs warning navigates correctly
- [ ] Test: "Start Chatting" creates profile + entity + navigates to ChatDetail
- [ ] Test: back button from ChatDetail goes to ChatList (not CreateAI) — confirms `navigation.replace()`
- [ ] Test: `prefillProfileId` param pre-selects existing character profile in advanced (future: when linking existing profile)

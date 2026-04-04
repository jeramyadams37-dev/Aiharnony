# Phase 6-3: CharacterProfileEditScreen

## Objective
Implement the character profile create/edit screen as a full push screen with a single scrollable form organized into labeled sections. Covers all character profile fields from the `CharacterProfile` model, plus image management.

## Files to Create
- `src/screens/CharacterProfileEditScreen.tsx`
- `src/components/characters/ProfileImagePicker.tsx`

## Files to Reference
- `src/database/models.ts` — `CharacterProfile`, `CharacterImage`
- `src/database/repositories/characters.ts` — full CRUD operations
- Harmony Link reference: `CharacterProfileEditor.jsx` — field reference (tabs → single scroll)
- `src/components/themed/ThemedButton.tsx`, `ThemedText.tsx`, `ThemedView.tsx`

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│  ← Create Profile      (or: ← Edit Profile)    [✓] │  ← Save button in header
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  BASIC INFORMATION                          │    │  ← section header
│  │                                             │    │
│  │  Name *                                     │    │
│  │  [_______________________________]          │    │
│  │                                             │    │
│  │  Description                                │    │
│  │  [_______________________________]          │    │
│  │  [_______________________________]          │    │
│  │                                             │    │
│  │  Personality                                │    │
│  │  [_______________________________]          │    │
│  │  [_______________________________]          │    │
│  │                                             │    │
│  │  Appearance                                 │    │
│  │  [_______________________________]          │    │
│  │                                             │    │
│  │  Backstory                                  │    │
│  │  [_______________________________]          │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  VOICE & BEHAVIOR                           │    │
│  │                                             │    │
│  │  Voice Characteristics                      │    │
│  │  [_______________________________]          │    │
│  │                                             │    │
│  │  Typing Speed (WPM)       [  60  ]          │    │  ← numeric input
│  │  Audio Response Chance (%)  [  50  ]        │    │  ← numeric input
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  PROMPTS & SCENARIO                         │    │
│  │                                             │    │
│  │  Base Prompt                                │    │
│  │  [_______________________________]          │    │
│  │  [_______________________________]          │    │
│  │                                             │    │
│  │  Scenario                                   │    │
│  │  [_______________________________]          │    │
│  │                                             │    │
│  │  Example Dialogues                          │    │
│  │  [_______________________________]          │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  IMAGES                                     │    │
│  │                                             │    │
│  │  ┌───┐  ┌───┐  ┌───┐  ┌─ + ─┐            │    │  ← image gallery
│  │  │img│★ │img│  │img│  │ Add │            │    │  ← ★ = primary
│  │  └───┘  └───┘  └───┘  └─────┘            │    │
│  │                                             │    │
│  │  Tap to set primary · Long-press to delete  │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [ Save Profile ]                                    │  ← bottom save button (redundant for large forms)
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Route Parameters

```typescript
// From AppNavigator RootStackParamList:
CharacterProfileEdit: { profileId?: string }

// profileId === undefined → create mode
// profileId !== undefined → edit mode, load from DB
```

---

## ProfileImagePicker Component

**File:** `src/components/characters/ProfileImagePicker.tsx`

Displays a horizontal scroll of existing images + an "Add" button. Tap an image to set it as primary (★). Long-press an image to delete it. Uses `react-native-image-picker` (or `launchImageLibrary`) to pick from the device gallery.

```typescript
import React from 'react';
import {
  View, ScrollView, TouchableOpacity, Image, StyleSheet, Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { CharacterImage } from '../../database/models';

interface ProfileImagePickerProps {
  images: CharacterImage[];
  primaryImageId: number | null;
  onAddImage: () => void;            // opens image picker
  onSetPrimary: (id: number) => void;
  onDeleteImage: (id: number) => void;
}

export const ProfileImagePicker: React.FC<ProfileImagePickerProps> = ({
  images, primaryImageId, onAddImage, onSetPrimary, onDeleteImage,
}) => {
  const { theme } = useAppTheme();

  const handleLongPress = (id: number) => {
    Alert.alert('Delete Image', 'Remove this image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteImage(id) },
    ]);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {images.map((img) => {
        const isPrimary = img.id === primaryImageId;
        return (
          <TouchableOpacity
            key={img.id}
            onPress={() => onSetPrimary(img.id)}
            onLongPress={() => handleLongPress(img.id)}
            style={[
              styles.imageSlot,
              isPrimary && { borderColor: theme?.colors.accent.primary, borderWidth: 3 },
            ]}
          >
            <Image
              source={{ uri: `data:image/${img.format};base64,${img.data}` }}
              style={styles.image}
              resizeMode="cover"
            />
            {isPrimary && (
              <View style={styles.starBadge}>
                <Icon name="star" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Add button */}
      <TouchableOpacity
        style={[styles.addSlot, { borderColor: theme?.colors.border.default, backgroundColor: theme?.colors.background.elevated }]}
        onPress={onAddImage}
      >
        <Icon name="plus" size={28} color={theme?.colors.accent.primary} />
      </TouchableOpacity>
    </ScrollView>
  );
};

const SLOT_SIZE = 80;

const styles = StyleSheet.create({
  scroll: { flexDirection: 'row' },
  imageSlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  image: { width: '100%', height: '100%' },
  starBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
  addSlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

> **Note on image picker:** Use `launchImageLibrary` from `react-native-image-picker` (already likely a project dependency from chat images support). If not present, add it. The picked image should be read as base64 and stored via `createCharacterImage()`.

---

## Screen Implementation

**File:** `src/screens/CharacterProfileEditScreen.tsx`

### Key state variables

```typescript
// Mode
const { profileId } = route.params ?? {};
const isEditMode = !!profileId;

// Profile fields
const [name, setName] = useState('');
const [description, setDescription] = useState('');
const [personality, setPersonality] = useState('');
const [appearance, setAppearance] = useState('');
const [backstory, setBackstory] = useState('');
const [voiceCharacteristics, setVoiceCharacteristics] = useState('');
const [typingSpeedWpm, setTypingSpeedWpm] = useState('60');
const [audioResponseChance, setAudioResponseChance] = useState('50');
const [basePrompt, setBasePrompt] = useState('');
const [scenario, setScenario] = useState('');
const [exampleDialogues, setExampleDialogues] = useState('');

// Images
const [images, setImages] = useState<CharacterImage[]>([]);
const [primaryImageId, setPrimaryImageId] = useState<number | null>(null);

// UI state
const [isSaving, setIsSaving] = useState(false);
const [isLoadingImages, setIsLoadingImages] = useState(false);
```

### Load in `useEffect`

```typescript
useEffect(() => {
  if (isEditMode && profileId) {
    loadProfile(profileId);
  }
}, [profileId]);

const loadProfile = async (id: string) => {
  const profile = await getCharacterProfile(id);
  if (!profile) return;
  setName(profile.name);
  setDescription(profile.description ?? '');
  setPersonality(profile.personality ?? '');
  setAppearance(profile.appearance ?? '');
  setBackstory(profile.backstory ?? '');
  setVoiceCharacteristics(profile.voice_characteristics ?? '');
  setTypingSpeedWpm(String(profile.typing_speed_wpm ?? 60));
  setAudioResponseChance(String(profile.audio_response_chance_percent ?? 50));
  setBasePrompt(profile.base_prompt ?? '');
  setScenario(profile.scenario ?? '');
  setExampleDialogues(profile.example_dialogues ?? '');

  // Load images
  const imgs = await getCharacterImages(id);
  setImages(imgs);
  const primary = imgs.find(img => (img as any).is_primary === 1);
  setPrimaryImageId(primary?.id ?? null);
};
```

### Save logic

```typescript
const handleSave = async () => {
  if (!name.trim()) {
    Alert.alert('Validation', 'Name is required.');
    return;
  }

  const typingWpm = parseInt(typingSpeedWpm, 10);
  if (isNaN(typingWpm) || typingWpm < 1 || typingWpm > 200) {
    Alert.alert('Validation', 'Typing speed must be between 1 and 200 WPM.');
    return;
  }

  const audioChance = parseInt(audioResponseChance, 10);
  if (isNaN(audioChance) || audioChance < 0 || audioChance > 100) {
    Alert.alert('Validation', 'Audio response chance must be between 0 and 100.');
    return;
  }

  setIsSaving(true);
  try {
    if (isEditMode && profileId) {
      await updateCharacterProfile(profileId, {
        name: name.trim(),
        description: description.trim() || null,
        personality: personality.trim() || null,
        appearance: appearance.trim() || null,
        backstory: backstory.trim() || null,
        voice_characteristics: voiceCharacteristics.trim() || null,
        typing_speed_wpm: typingWpm,
        audio_response_chance_percent: audioChance,
        base_prompt: basePrompt.trim() || null,
        scenario: scenario.trim() || null,
        example_dialogues: exampleDialogues.trim() || null,
      });
    } else {
      const newId = generateUUID(); // from uuid library or similar
      await createCharacterProfile({
        id: newId,
        name: name.trim(),
        description: description.trim() || null,
        personality: personality.trim() || null,
        appearance: appearance.trim() || null,
        backstory: backstory.trim() || null,
        voice_characteristics: voiceCharacteristics.trim() || null,
        typing_speed_wpm: typingWpm,
        audio_response_chance_percent: audioChance,
        vision_config_id: null,
        lifecycle_config: null,
        base_prompt: basePrompt.trim() || null,
        scenario: scenario.trim() || null,
        example_dialogues: exampleDialogues.trim() || null,
      });
    }
    navigation.goBack();
  } catch (err) {
    Alert.alert('Error', 'Failed to save profile. Please try again.');
  } finally {
    setIsSaving(false);
  }
};
```

### Image operations

```typescript
const handleAddImage = async () => {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    includeBase64: true,
    quality: 0.8,
  });

  if (result.assets && result.assets[0] && profileId) {
    const asset = result.assets[0];
    const format = asset.type?.split('/')[1] ?? 'jpeg';
    const base64Data = asset.base64!;

    const newImage = await createCharacterImage({
      character_profile_id: profileId,
      data: base64Data,
      format: format,
      is_primary: images.length === 0 ? 1 : 0, // first image auto-becomes primary
    });
    setImages(prev => [...prev, newImage]);
    if (images.length === 0) setPrimaryImageId(newImage.id);
  }
};

const handleSetPrimary = async (imageId: number) => {
  if (profileId) {
    await setCharacterImageAsPrimary(profileId, imageId);
    setPrimaryImageId(imageId);
  }
};

const handleDeleteImage = async (imageId: number) => {
  await deleteCharacterImage(imageId);
  setImages(prev => prev.filter(img => img.id !== imageId));
  if (primaryImageId === imageId) {
    const remaining = images.filter(img => img.id !== imageId);
    setPrimaryImageId(remaining[0]?.id ?? null);
  }
};
```

> **Note:** Image operations require the profile to exist in DB first (need `profileId`). In **create mode**, image management is disabled until after initial save. The UX handles this by showing a note: "Save the profile first to add images." The create flow will navigate to edit mode immediately after creation, allowing image addition on the next visit. Alternatively, you could auto-save a draft profile first and then allow images — but the simpler approach is to disable the Images section until saved.

### Section rendering

Use a `renderSection(title, children)` helper for consistent section headers:

```typescript
const renderSection = (title: string, children: React.ReactNode) => (
  <View style={[styles.section, { borderColor: theme.colors.border.default }]}>
    <ThemedText weight="bold" size={12} variant="muted" style={styles.sectionTitle}>
      {title}
    </ThemedText>
    {children}
  </View>
);
```

Use `renderField(label, input)` for consistent field layout:
```typescript
const renderField = (label: string, input: React.ReactNode, required = false) => (
  <View style={styles.field}>
    <ThemedText size={13} variant="secondary" style={styles.fieldLabel}>
      {label}{required ? ' *' : ''}
    </ThemedText>
    {input}
  </View>
);
```

---

## UUID Generation

Use the existing `uuid` or `uuidv4` pattern already in the codebase. Check `src/database/repositories/` for how other repositories generate IDs (likely `uuid.v4()` from the `uuid` package or similar). If no UUID util exists, add:

```typescript
// src/utils/uuid.ts
import 'react-native-get-random-values'; // required polyfill for React Native
import { v4 as uuidv4 } from 'uuid';
export const generateUUID = () => uuidv4();
```

Check `package.json` for existing `uuid` dependency before adding.

---

## Required Repository Functions

Verify these exist in `src/database/repositories/characters.ts`:
- `getCharacterProfile(id: string)` ✓ (confirmed exists)
- `createCharacterProfile(profile)` ✓ (confirmed exists)
- `updateCharacterProfile(id, fields)` — verify signature
- `getCharacterImages(profileId: string)` — verify name (may be `getCharacterImagesByProfileId`)
- `createCharacterImage(image)` — verify exists
- `deleteCharacterImage(id: number)` — verify exists
- `setCharacterImageAsPrimary(profileId, imageId)` — may need to be added

If `setCharacterImageAsPrimary` doesn't exist, implement it:
```typescript
export async function setCharacterImageAsPrimary(profileId: string, imageId: number): Promise<void> {
  const db = getDatabase();
  return withTransaction(db, async (tx) => {
    // Clear all primary flags for this profile
    await tx.executeSql(
      `UPDATE character_images SET is_primary = 0 WHERE character_profile_id = ?`,
      [profileId]
    );
    // Set the new primary
    await tx.executeSql(
      `UPDATE character_images SET is_primary = 1 WHERE id = ?`,
      [imageId]
    );
  });
}
```

---

## Progress Checklist

- [ ] Create `src/components/characters/ProfileImagePicker.tsx`
- [ ] Create `src/screens/CharacterProfileEditScreen.tsx`
- [ ] Verify `updateCharacterProfile()` exists in characters repository; if not, implement it
- [ ] Verify `getCharacterImages()` function name/signature
- [ ] Verify `createCharacterImage()` function name/signature
- [ ] Verify `deleteCharacterImage()` function name/signature
- [ ] Add `setCharacterImageAsPrimary()` if not present
- [ ] Verify UUID generation approach (use existing pattern or add `src/utils/uuid.ts`)
- [ ] Test: create mode — empty form saves new profile and navigates back
- [ ] Test: edit mode — form pre-fills with existing profile data
- [ ] Test: validation — name required, WPM/audio chance range checked
- [ ] Test: saving indicator shows while saving
- [ ] Test: image picker opens device gallery
- [ ] Test: adding image to existing profile works
- [ ] Test: setting primary image updates star badge
- [ ] Test: deleting image removes it from gallery
- [ ] Test: Images section disabled in create mode (before first save)
- [ ] Test: back navigation after save returns to CharactersScreen with refreshed list

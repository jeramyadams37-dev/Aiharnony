# Phase 6-2: CharacterProfileCard Component

## Objective
Create the `CharacterProfileCard` component used in the `CharactersScreen` grid. Displays a character's primary image (or placeholder icon), name, and description preview. Supports press (edit) and long-press (delete trigger).

## Files to Create
- `src/components/characters/CharacterProfileCard.tsx`

## Files to Reference
- Harmony Link reference: `CharacterProfileCard.jsx` — visual pattern reference
- `src/components/themed/ThemedText.tsx` — theming
- `src/contexts/ThemeContext.tsx`

---

## Visual Design

Each card occupies exactly half the screen width (minus padding/gap), with a portrait-oriented (3:4 ratio) image area at the top and text below.

```
┌─────────────────┐
│                 │
│   [Portrait     │  ← aspect ratio 3:4 image
│    Image or     │
│    placeholder  │
│    👤 icon]     │
│                 │
│─────────────────│
│  Aria           │  ← name, bold, accent color, truncated to 1 line
│  Playful AI...  │  ← description, muted, truncated to 2 lines
└─────────────────┘
```

On long-press:
- Brief scale-down animation (haptic feedback)
- Calls `onLongPress` callback (parent handles Alert dialog)

---

## Component Implementation

**File:** `src/components/characters/CharacterProfileCard.tsx`

```typescript
import React, { useRef } from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { ThemedText } from '../themed/ThemedText';
import { CharacterProfile } from '../../database/models';

interface CharacterProfileCardProps {
  profile: CharacterProfile;
  imageUri: string | null;      // base64 data URL or null for placeholder
  onPress: () => void;
  onLongPress: () => void;
}

export const CharacterProfileCard: React.FC<CharacterProfileCardProps> = ({
  profile,
  imageUri,
  onPress,
  onLongPress,
}) => {
  const { theme } = useAppTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  if (!theme) return null;

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.background.elevated,
            borderColor: theme.colors.border.default,
          },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        delayLongPress={400}
      >
        {/* Image area — 3:4 aspect ratio */}
        <View style={[styles.imageContainer, { backgroundColor: theme.colors.background.base }]}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Icon
                name="account"
                size={48}
                color={theme.colors.text.disabled ?? theme.colors.text.muted}
              />
            </View>
          )}
        </View>

        {/* Text area */}
        <View style={styles.textContainer}>
          <ThemedText
            weight="bold"
            size={14}
            numberOfLines={1}
            style={[styles.name, { color: theme.colors.accent.primary }]}
          >
            {profile.name}
          </ThemedText>
          <ThemedText
            variant="muted"
            size={12}
            numberOfLines={2}
            style={styles.description}
          >
            {profile.description || 'No description provided.'}
          </ThemedText>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,          // fills one column in FlatList numColumns={2}
    maxWidth: '50%',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    aspectRatio: 3 / 4,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    padding: 10,
    gap: 4,
  },
  name: {
    letterSpacing: 0.1,
  },
  description: {
    lineHeight: 16,
    minHeight: 32,   // reserve space for 2 lines even when empty
  },
});
```

---

## Notes

- `flex: 1` + `maxWidth: '50%'` on the wrapper is the correct pattern for 2-column FlatList cards. Combined with `columnWrapperStyle={{ gap: 12 }}` in the parent, this ensures proper spacing.
- The `Animated.Value` scale spring gives tactile feedback on press without needing a third-party library.
- `delayLongPress={400}` is a comfortable delay — not too sensitive, not too slow.
- `imageUri` is expected to be a fully formed data URL (`data:image/jpeg;base64,...`), produced by `createDataURL()` in the parent screen.

---

## Progress Checklist

- [ ] Create `src/components/characters/CharacterProfileCard.tsx`
- [ ] Test: card renders correctly with an image
- [ ] Test: card renders placeholder icon when no image
- [ ] Test: name truncates correctly with `numberOfLines={1}`
- [ ] Test: description truncates to 2 lines
- [ ] Test: `onPress` fires on tap
- [ ] Test: `onLongPress` fires after 400ms hold
- [ ] Test: scale animation plays smoothly on press/long-press
- [ ] Test: two cards side-by-side fill screen width correctly with gap

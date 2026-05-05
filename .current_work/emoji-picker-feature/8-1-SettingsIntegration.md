# Phase 8: Settings Integration

## Objective

Add an "Emoji Style" section to the existing `ThemeSettingsScreen` where users can visually preview and switch between emoji base designs (Native, Google Noto, Twemoji). **The preview cards use the active emoji set** so users can see the difference before committing.

## Codebase References

- [`src/screens/settings/ThemeSettingsScreen.tsx`](../../src/screens/settings/ThemeSettingsScreen.tsx) — settings screen to extend
- [`src/components/settings/ThemeCard.tsx`](../../src/components/settings/ThemeCard.tsx) — card selector pattern reference
- [`src/contexts/EmojiContext.tsx`](../../src/contexts/EmojiContext.tsx) — `useEmoji()` hook, `setEmojiSet()`
- [`src/types/emoji.ts`](../../src/types/emoji.ts) — `EmojiSet` type
- [`src/components/navigation/SettingsMenu.tsx`](../../src/components/navigation/SettingsMenu.tsx) — settings menu navigation

---

## Task 1 — Create EmojiStyleCard component

**File:** `src/components/settings/EmojiStyleCard.tsx`

Card with visual preview. Uses `EmojiText` so the preview renders in the card's own emoji set style:

```typescript
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme } from '../../theme/types';
import { EmojiSet } from '../../types/emoji';

interface EmojiStyleCardProps {
  emojiSet: EmojiSet;
  label: string;
  description: string;
  sampleEmojis: string[];    // native emoji characters for preview
  isActive: boolean;
  onPress: () => void;
  theme: Theme;
}

export const EmojiStyleCard: React.FC<EmojiStyleCardProps> = memo(({
  emojiSet,
  label,
  description,
  sampleEmojis,
  isActive,
  onPress,
  theme,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.card,
      {
        backgroundColor: theme.colors.background.elevated,
        borderColor: isActive ? theme.colors.accent.primary : theme.colors.border.default,
      },
    ]}
    activeOpacity={0.7}
  >
    {isActive && (
      <View style={[styles.activeBadge, { backgroundColor: theme.colors.accent.primary }]}>
        <Icon name="check" size={14} color="#fff" />
      </View>
    )}

    <View style={styles.previewRow}>
      {sampleEmojis.map((emoji, index) => (
        <Text key={index} style={styles.previewEmoji}>{emoji}</Text>
      ))}
    </View>

    <Text style={[styles.label, { color: theme.colors.text.primary }]}>{label}</Text>
    <Text style={[styles.description, { color: theme.colors.text.secondary }]}>{description}</Text>
  </TouchableOpacity>
));

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, borderWidth: 2, position: 'relative' },
  activeBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  previewRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  previewEmoji: { fontSize: 28 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  description: { fontSize: 13 },
});
```

> **Enhancement note:** In a future iteration, the preview emojis could be rendered using `EmojiText` with the card's specific `emojiSet` prop, so each card shows its own emoji style. This requires a temporary emoji set override. For the initial implementation, native text rendering in the preview cards is sufficient.

---

## Task 2 — Add Emoji Style section to ThemeSettingsScreen

**File:** `src/screens/settings/ThemeSettingsScreen.tsx`

Add imports, hook, and a new section in the ScrollView between "Theme Mode" and "Current Theme":

```typescript
import { useEmoji } from '../../contexts/EmojiContext';
import { EmojiStyleCard } from '../../components/settings/EmojiStyleCard';
import { EmojiSet } from '../../types/emoji';

// In component:
const { emojiSet, setEmojiSet } = useEmoji();

const EMOJI_STYLES = [
  { set: 'native', label: 'Native (System)', description: 'Use your device\'s built-in emoji style', sampleEmojis: ['😀', '👍', '❤️', '🎉', '🚀'] },
  { set: 'noto', label: 'Google Noto', description: 'Colorful, modern emoji by Google (Apache 2.0)', sampleEmojis: ['😀', '👍', '❤️', '🎉', '🚀'] },
  { set: 'twemoji', label: 'Twemoji', description: 'Clean, flat emoji originally by Twitter/X (CC-BY 4.0)', sampleEmojis: ['😀', '👍', '❤️', '🎉', '🚀'] },
];
```

Section JSX follows the same layout pattern as the "Theme Mode" section (refer to Phase 7 in original plan for full code).

---

## Task 3 (Optional) — Add emoji style entry to SettingsMenu

Add to `src/components/navigation/SettingsMenu.tsx` under "App Settings":
```typescript
{ icon: 'emoticon-outline', label: 'Emoji Style', screen: 'ThemeSettings', badge: 'NEW' },
```

---

## Progress Checklist

- [ ] `src/components/settings/EmojiStyleCard.tsx` created
- [ ] `ThemeSettingsScreen.tsx` updated with "Emoji Style" section
- [ ] Three emoji style options: Native, Google Noto, Twemoji
- [ ] Tapping a card switches emoji set immediately
- [ ] Active style shows checkmark indicator
- [ ] Preference persists across app restarts
- [ ] (Optional) SettingsMenu updated

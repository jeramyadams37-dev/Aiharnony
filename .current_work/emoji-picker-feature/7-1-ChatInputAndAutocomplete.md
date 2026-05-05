# Phase 7: ChatInput Integration & Shortcode Autocomplete

## Objective

1. Integrate the emoji picker toggle into `ChatInput`
2. Add shortcode autocomplete popup — when user types `:`, show matching emojis in a dropdown; as they type more (`:jo`), filter to `:joy:`, `:joystick:`, etc. Selecting one inserts the native emoji
3. Handle keyboard ↔ picker transitions
4. Expose `insertEmoji` via `useImperativeHandle` for programmatic insertion from the picker

## Codebase References

- [`src/components/chat/ChatInput.tsx`](../../src/components/chat/ChatInput.tsx) — the input bar to modify
- [`src/screens/ChatDetailScreen.tsx`](../../src/screens/ChatDetailScreen.tsx) — parent screen
- [`src/components/emoji/EmojiPickerModal.tsx`](../../src/components/emoji/EmojiPickerModal.tsx) — the picker modal
- [`src/services/EmojiService.ts`](../../src/services/EmojiService.ts) — `searchByShortcodePrefix()` for autocomplete
- [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md)

---

## Task 1 — Add emoji toggle button to ChatInput

**File:** `src/components/chat/ChatInput.tsx`

Add to `ChatInputProps`:

```typescript
interface ChatInputProps {
  onSendText: (text: string) => void;
  onSendAudio: (audioData: string, duration: number) => void;
  onSendImage: (imageBase64: string, mimeType: string, caption?: string) => void;
  onTypingStart?: () => void;
  onEmojiToggle?: () => void;    // toggles emoji picker visibility
  showEmojiButton?: boolean;     // whether emoji button is visible
  disabled?: boolean;
  theme: Theme;
}
```

Add the emoji button before the image picker button in the input row:

```tsx
{/* Emoji toggle button */}
{showEmojiButton !== false && onEmojiToggle && (
  <TouchableOpacity
    onPress={onEmojiToggle}
    disabled={disabled || isProcessing}
    style={styles.iconButton}
  >
    <Icon
      name="emoticon-outline"
      size={24}
      color={disabled ? theme.colors.text.disabled : theme.colors.accent.primary}
    />
  </TouchableOpacity>
)}
```

---

## Task 2 — Create EmojiAutocomplete component

**File:** `src/components/emoji/EmojiAutocomplete.tsx`

A compact popup showing above the text input when the user types `:`. Displays matching emojis with shortcodes. Selecting one replaces the partial shortcode with the native emoji character.

```typescript
import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { EmojiText } from './EmojiText';
import { EmojiEntry } from '../../types/emoji';
import { Theme } from '../../theme/types';

interface EmojiAutocompleteProps {
  /** Matching emoji results */
  results: EmojiEntry[];
  /** The partial shortcode being typed (e.g., "jo" from ":jo") */
  query: string;
  /** Called when user selects an emoji from the list */
  onSelect: (emoji: EmojiEntry) => void;
  /** Called when user dismisses the autocomplete */
  onDismiss: () => void;
  theme: Theme;
}

export const EmojiAutocomplete: React.FC<EmojiAutocompleteProps> = memo(({
  results,
  query,
  onSelect,
  onDismiss,
  theme,
}) => {
  if (results.length === 0 || !query) return null;

  const renderItem = useCallback(({ item }: { item: EmojiEntry }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: theme.colors.background.elevated }]}
      onPress={() => onSelect(item)}
      activeOpacity={0.6}
    >
      <EmojiText native={item.native} size={22} emojiEntry={item} />
      <Text style={[styles.shortcode, { color: theme.colors.text.primary }]}>
        :{item.id}:
      </Text>
    </TouchableOpacity>
  ), [onSelect, theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.surface, borderColor: theme.colors.border.default }]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    maxHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  shortcode: {
    fontSize: 13,
    fontWeight: '500',
  },
});
```

---

## Task 3 — Add shortcode autocomplete logic to ChatInput

**File:** `src/components/chat/ChatInput.tsx`

Add state and logic inside the ChatInput component to detect `:` typing and show the autocomplete:

```typescript
import { EmojiAutocomplete } from './EmojiAutocomplete';
import EmojiService from '../../services/EmojiService';
import { EmojiEntry } from '../../types/emoji';

// Inside the component:
const [autocompleteResults, setAutocompleteResults] = useState<EmojiEntry[]>([]);
const [shortcodePrefix, setShortcodePrefix] = useState('');
const [cursorPosition, setCursorPosition] = useState(0);

const handleTextChange = (newText: string) => {
  setText(newText);
  if (newText.length === 1 && onTypingStart) {
    onTypingStart();
  }

  // Detect shortcode autocomplete trigger
  detectShortcodeAutocomplete(newText);
};

/**
 * Detect if cursor is inside a :shortcode: pattern and show autocomplete.
 * Looks backwards from cursor to find opening `:`.
 */
const detectShortcodeAutocomplete = (text: string) => {
  // Simple approach: find the last `:` in the text
  const lastColonIndex = text.lastIndexOf(':');

  if (lastColonIndex === -1 || lastColonIndex === text.length - 1) {
    // Just typed `:` or no colon — show all popular emojis
    if (lastColonIndex === text.length - 1) {
      // Show initial suggestions (popular emojis)
      const popular = EmojiService.searchByShortcodePrefix('', 8);
      setAutocompleteResults(popular);
      setShortcodePrefix('');
    } else {
      // No colon — hide autocomplete
      setAutocompleteResults([]);
      setShortcodePrefix('');
    }
    return;
  }

  // Extract text between last `:` and cursor
  const prefix = text.slice(lastColonIndex + 1);

  // If prefix contains spaces or another `:`, it's not a shortcode
  if (prefix.includes(' ') || prefix.includes(':')) {
    setAutocompleteResults([]);
    setShortcodePrefix('');
    return;
  }

  // Search for matching emojis
  const results = EmojiService.searchByShortcodePrefix(prefix.toLowerCase(), 8);
  setAutocompleteResults(results);
  setShortcodePrefix(prefix);
};

/**
 * Handle emoji selection from autocomplete.
 * Replaces the partial `:prefix` in the text with the native emoji.
 */
const handleAutocompleteSelect = (emoji: EmojiEntry) => {
  const lastColonIndex = text.lastIndexOf(':');
  if (lastColonIndex === -1) return;

  // Replace from `:` to cursor with the native emoji
  const before = text.slice(0, lastColonIndex);
  const after = text.slice(lastColonIndex + shortcodePrefix.length + 1);
  const newText = before + emoji.native + after;

  setText(newText);
  setAutocompleteResults([]);
  setShortcodePrefix('');

  if (onTypingStart) onTypingStart();
};
```

Add the autocomplete rendering inside the ChatInput layout, above the input row:

```tsx
return (
  <ThemedView style={[styles.container, ...]}>
    {/* Shortcode autocomplete (shown when typing `:`) */}
    <EmojiAutocomplete
      results={autocompleteResults}
      query={shortcodePrefix}
      onSelect={handleAutocompleteSelect}
      onDismiss={() => { setAutocompleteResults([]); setShortcodePrefix(''); }}
      theme={theme}
    />

    {/* Existing input row */}
    <View style={styles.inputRow}>
      {/* ... existing buttons and input ... */}
    </View>
  </ThemedView>
);
```

---

## Task 4 — Expose insertEmoji via useImperativeHandle

**File:** `src/components/chat/ChatInput.tsx`

```typescript
export interface ChatInputRef {
  insertEmoji: (emoji: string) => void;
}

export const ChatInput = React.forwardRef<ChatInputRef, ChatInputProps>(({
  // ... existing props
}, ref) => {
  const [text, setText] = useState('');

  useImperativeHandle(ref, () => ({
    insertEmoji: (emoji: string) => {
      setText(prev => prev + emoji);
    },
  }));

  // ... rest of component
});
```

---

## Task 5 — Integrate in ChatDetailScreen

**File:** `src/screens/ChatDetailScreen.tsx`

```typescript
import { EmojiPickerModal } from '../components/emoji';
import { ChatInputRef } from '../components/chat/ChatInput';

const chatInputRef = useRef<ChatInputRef>(null);
const [showEmojiPicker, setShowEmojiPicker] = useState(false);

const handleEmojiSelected = useCallback((emoji: EmojiEntry) => {
  chatInputRef.current?.insertEmoji(emoji.native);
  // Don't close picker — multi-pick UX
}, []);

// Keyboard transitions
useEffect(() => {
  const listener = Keyboard.addListener('keyboardDidShow', () => {
    if (showEmojiPicker) setShowEmojiPicker(false);
  });
  return () => listener.remove();
}, [showEmojiPicker]);

// In render:
<EmojiPickerModal
  visible={showEmojiPicker}
  onClose={() => setShowEmojiPicker(false)}
  onEmojiSelected={handleEmojiSelected}
/>

<ChatInput
  ref={chatInputRef}
  onSendText={handleSendText}
  onSendAudio={handleSendAudio}
  onSendImage={handleSendImage}
  onTypingStart={handleTypingStart}
  onEmojiToggle={() => {
    if (!showEmojiPicker) Keyboard.dismiss();
    setShowEmojiPicker(prev => !prev);
  }}
  showEmojiButton={true}
  disabled={isDualSessionActive}
  theme={theme}
/>
```

---

## Progress Checklist

- [ ] `ChatInputProps` extended with `onEmojiToggle` and `showEmojiButton`
- [ ] Emoji toggle button added to ChatInput layout (left of image picker)
- [ ] `src/components/emoji/EmojiAutocomplete.tsx` created — horizontal dropdown with emoji + shortcode
- [ ] Shortcode detection logic added to `handleTextChange` in ChatInput
- [ ] Typing `:` shows autocomplete with popular emojis
- [ ] Typing `:jo` filters to `:joy:`, `:joystick:`, etc.
- [ ] Selecting from autocomplete replaces `:prefix` with native emoji character
- [ ] Spaces or second `:` dismisses autocomplete
- [ ] `ChatInputRef` with `insertEmoji` exposed via `useImperativeHandle`
- [ ] `ChatInput` converted to `forwardRef`
- [ ] `ChatDetailScreen` has `showEmojiPicker` state, `EmojiPickerModal`, `chatInputRef`
- [ ] Emoji picker stays open after selection (multi-pick UX)
- [ ] Keyboard dismisses when emoji picker opens and vice versa
- [ ] No regression to existing text/voice/image send functionality

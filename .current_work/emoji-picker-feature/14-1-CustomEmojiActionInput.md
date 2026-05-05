# Phase 14: Client — Custom EmojiActionInput Component

## Objective

Replace the standard `TextInput` in ChatInput with a custom component that renders inline substitution previews. When the user types an emoji with an assigned action, the component displays the substitution text in parentheses, italic and slightly dimmed, directly after the emoji: `🍔(*eats a burger*)`.

The component maintains a plain text string internally (including emoji characters). The rich display is a render-only transformation — editing works on the raw text buffer.

## Codebase References

- [`src/components/chat/ChatInput.tsx`](../../src/components/chat/ChatInput.tsx) — current input component (lines 1-375), will be modified to use EmojiActionInput
- [`src/services/EntityEmojiActionService.ts`](../../src/services/EntityEmojiActionService.ts) — action lookup (Phase 11)
- [`src/services/EmojiService.ts`](../../src/services/EmojiService.ts) — `splitTextOnEmojis()` for text segmentation
- [`src/types/emoji.ts`](../../src/types/emoji.ts) — TextSegment, EmojiAction, EmotionEffect types
- [`src/contexts/EmojiContext.tsx`](../../src/contexts/EmojiContext.tsx) — emoji context hook
- [`src/components/emoji/EmojiText.tsx`](../../src/components/emoji/EmojiText.tsx) — emoji renderer (Phase 4)

---

## Task 1 — Create EmojiActionInput component

**File:** `src/components/chat/EmojiActionInput.tsx`

```typescript
import React, { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import EntityEmojiActionService from '../../services/EntityEmojiActionService';
import EmojiService from '../../services/EmojiService';
import { EmojiAction, TextSegment } from '../../types/emoji';
import { Theme } from '../../theme/types';
import { createLogger } from '../../utils/logger';

const log = createLogger('[EmojiActionInput]');

interface EmojiActionInputProps {
  /** Current text value */
  value: string;
  /** Called when text changes */
  onChangeText: (text: string) => void;
  /** Called on submit */
  onSubmitEditing?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Placeholder color */
  placeholderTextColor?: string;
  /** Text color */
  textColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Whether input is editable */
  editable?: boolean;
  /** Whether to blur on submit */
  blurOnSubmit?: boolean;
  /** Maximum length */
  maxLength?: number;
  /** The entity ID for looking up emoji actions */
  entityId: string | null;
  /** Theme */
  theme: Theme;
  /** Style overrides */
  style?: any;
}

interface DisplaySegment {
  type: 'text' | 'emoji_raw' | 'emoji_action_preview';
  value: string;
  substitutionText?: string;
}

export const EmojiActionInput: React.FC<EmojiActionInputProps> = memo(({
  value,
  onChangeText,
  onSubmitEditing,
  placeholder,
  placeholderTextColor,
  textColor,
  backgroundColor,
  editable = true,
  blurOnSubmit = false,
  maxLength = 2000,
  entityId,
  theme,
  style,
}) => {
  const [actionsMap, setActionsMap] = useState<Map<string, EmojiAction> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Load actions map for this entity
  useEffect(() => {
    if (!entityId) {
      setActionsMap(null);
      return;
    }

    EntityEmojiActionService.getActionsMap(entityId).then(setActionsMap).catch(err => {
      log.error('Failed to load actions map:', err);
      setActionsMap(null);
    });
  }, [entityId]);

  // Build display segments from the raw text
  const displaySegments = useMemo((): DisplaySegment[] => {
    if (!value || !actionsMap || actionsMap.size === 0) {
      return [{ type: 'text', value }];
    }

    const segments: DisplaySegment[] = [];
    const textSegments: TextSegment[] = EmojiService.splitTextOnEmojis(value);

    for (const seg of textSegments) {
      if (seg.type === 'text') {
        segments.push({ type: 'text', value: seg.value });
      } else {
        const action = actionsMap.get(seg.value);
        if (action && action.substitutionText) {
          segments.push({
            type: 'emoji_action_preview',
            value: seg.value,
            substitutionText: action.substitutionText,
          });
        } else {
          segments.push({ type: 'emoji_raw', value: seg.value });
        }
      }
    }

    return segments;
  }, [value, actionsMap]);

  // Build the display string (what the user sees)
  // The actual editing happens on the raw text, but we overlay
  // a display layer showing the substitution previews.
  const displayText = useMemo(() => {
    if (!actionsMap || actionsMap.size === 0) return value;

    return displaySegments.map(seg => {
      if (seg.type === 'emoji_action_preview') {
        // Show: emoji(substitution_text)
        return `${seg.value}(${seg.substitutionText})`;
      }
      return seg.value;
    }).join('');
  }, [displaySegments, actionsMap, value]);

  // Handle text input — work with raw text only
  const handleChangeText = useCallback((newText: string) => {
    onChangeText(newText);
  }, [onChangeText]);

  // Handle submit
  const handleSubmitEditing = useCallback(() => {
    onSubmitEditing?.();
  }, [onSubmitEditing]);

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {/*
       * Rendering strategy:
       * Layer 1 (bottom): Invisible TextInput that handles all editing
       * Layer 2 (top): Display overlay showing formatted text with substitution previews
       *
       * The TextInput is transparent but maintains focus and cursor.
       * The overlay mirrors the text but adds formatting.
       *
       * IMPORTANT: This approach requires matching font sizes and padding exactly.
       */}

      {/* Editing layer (invisible, captures input) */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        style={[
          styles.input,
          { color: 'transparent', backgroundColor: 'transparent' },
        ]}
        multiline
        maxLength={maxLength}
        editable={editable}
        blurOnSubmit={blurOnSubmit}
      />

      {/* Display layer (visible, formatted) */}
      {value ? (
        <View style={styles.displayLayer} pointerEvents="none">
          <Text style={[styles.displayText, { color: textColor }]}>
            {displaySegments.map((seg, i) => {
              if (seg.type === 'emoji_action_preview') {
                return (
                  <React.Fragment key={i}>
                    <Text style={{ color: textColor }}>{seg.value}</Text>
                    <Text style={[
                      styles.substitutionPreview,
                      { color: textColor + '99' },
                    ]}>
                      ({seg.substitutionText})
                    </Text>
                  </React.Fragment>
                );
              }
              return <Text key={i} style={{ color: textColor }}>{seg.value}</Text>;
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 20,
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    maxHeight: 80,
    // Must match displayText exactly in font size, padding, etc.
  },
  displayLayer: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
  },
  displayText: {
    fontSize: 16,
    lineHeight: 20,
  },
  substitutionPreview: {
    fontStyle: 'italic',
    fontSize: 14,
  },
});
```

> **Implementation notes:**
>
> 1. **Dual-layer approach**: The invisible TextInput handles all editing (cursor, selection, keyboard input). The display overlay renders the formatted text. Font size, padding, and line height must match exactly between the two layers.
>
> 2. **Performance**: `displaySegments` is memoized — recomputes only when `value` or `actionsMap` changes. `actionsMap` is loaded once when entityId changes and cached by the service.
>
> 3. **Fallback**: If no entity is set or no actions are loaded, the component renders a plain TextInput (no overlay needed).
>
> 4. **Alternative approach** (if dual-layer proves fragile): Use a single TextInput with the raw text, and show a separate preview row below the input listing pending substitutions. This is simpler but less immersive.
>
> 5. The transparent text approach requires careful alignment testing on both iOS and Android. If alignment issues arise, consider using `opacity: 0` instead of `color: 'transparent'` for the input text.

---

## Task 2 — Integrate EmojiActionInput into ChatInput

**File:** `src/components/chat/ChatInput.tsx`

Replace the existing `<TextInput>` (lines 265-276) with `<EmojiActionInput>`. This requires:

1. New prop `entityId` on ChatInput (passed from ChatDetailScreen)
2. Import EmojiActionInput
3. Replace the TextInput block

```typescript
// New import
import { EmojiActionInput } from './EmojiActionInput';

// Add to ChatInputProps interface:
interface ChatInputProps {
  // ... existing props ...
  entityId?: string | null;  // The partner entity ID for emoji action lookup
}

// In the render, replace the TextInput block:
// OLD:
//   <TextInput
//     value={text}
//     onChangeText={handleTextChange}
//     ...
//   />
//
// NEW:
<EmojiActionInput
  value={text}
  onChangeText={handleTextChange}
  placeholder="Type a message..."
  placeholderTextColor={theme.colors.text.muted}
  textColor={theme.colors.text.primary}
  backgroundColor={theme.colors.background.elevated}
  multiline
  maxLength={2000}
  editable={!disabled && !isProcessing}
  onSubmitEditing={handleSend}
  blurOnSubmit={false}
  entityId={entityId ?? null}
  theme={theme}
/>
```

The `entityId` prop comes from the parent `ChatDetailScreen` which already knows the `partnerEntityId`.

---

## Progress Checklist

- [ ] `src/components/chat/EmojiActionInput.tsx` created with dual-layer rendering
- [ ] Display layer shows substitution text in italic/dim after action-mapped emojis
- [ ] Editing layer (transparent TextInput) maintains cursor and selection
- [ ] Font size and padding match between editing and display layers
- [ ] Actions map loaded on entityId change, cached by service
- [ ] `displaySegments` memoized for performance
- [ ] Fallback to plain input when no entityId or no actions loaded
- [ ] `ChatInput.tsx` updated to use EmojiActionInput instead of TextInput
- [ ] ChatInput accepts new `entityId` prop
- [ ] ChatDetailScreen passes `partnerEntityId` as `entityId` to ChatInput
- [ ] Input works correctly on both iOS and Android
- [ ] No visual regression for messages without emoji actions
- [ ] TypeScript compiles without errors

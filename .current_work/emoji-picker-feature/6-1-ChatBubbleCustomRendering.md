# Phase 6: ChatBubble Custom Emoji Rendering

## Objective

Make custom emoji sets render in **chat message bubbles**, not just the picker. This is the core value of supporting custom sets — users see their chosen emoji style throughout the entire chat.

Create `EmojiAwareText` — a drop-in replacement for plain text rendering that:
1. Parses `:shortcode:` patterns → native Unicode (handles AI and user shortcode input)
2. Splits text on emoji characters using `emoji-regex`
3. Renders text segments as `<Text>` and emoji segments using `<EmojiText>` (sprite sheet or native)
4. Wraps in a flexbox row with `flexWrap` for inline image layout

## Codebase References

- [`src/components/chat/ChatBubble.tsx`](../../src/components/chat/ChatBubble.tsx) — contains `FormattedRPText` (lines 33-68) to enhance
- [`src/components/emoji/EmojiText.tsx`](../../src/components/emoji/EmojiText.tsx) — single-emoji renderer (from Phase 4)
- [`src/services/EmojiService.ts`](../../src/services/EmojiService.ts) — `parseShortcodes()`, `splitTextOnEmojis()`
- [`src/contexts/EmojiContext.tsx`](../../src/contexts/EmojiContext.tsx) — `useEmoji()` for active set
- [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md)

---

## Technical Approach: Inline Emoji Rendering in React Native

React Native's `<Text>` component does **not** support inline `<Image>` children on all platforms. To render custom emoji images inline within flowing text, we use the **flexbox wrapping pattern**:

```
<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
  <Text>Hello </Text>
  <EmojiText native="😂" size={16} />  ← sprite sheet image, same height as text line
  <Text> world!</Text>
</View>
```

This produces visually correct inline rendering. Line breaks are handled by `flexWrap: 'wrap'`. Text segments flow naturally; emoji images are sized to match the font line height.

**Performance optimization:** When `emojiSet === 'native'`, skip splitting entirely and render the full text as a single `<Text>` (no performance overhead for the default case).

---

## Task 1 — Create EmojiAwareText component

**File:** `src/components/emoji/EmojiAwareText.tsx`

This component handles the full pipeline:
1. `parseShortcodes(text)` — converts `:joy:` → `😂`
2. `splitTextOnEmojis(text)` — splits into `TextSegment[]`
3. Renders segments: text as `<Text>`, emoji as `<EmojiText>`
4. For native set: skips splitting, renders as plain `<Text>` (zero overhead)

```typescript
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EmojiText } from './EmojiText';
import { useEmoji } from '../../contexts/EmojiContext';
import EmojiService from '../../services/EmojiService';
import { TextSegment } from '../../types/emoji';

interface EmojiAwareTextProps {
  /** Raw text content — may contain :shortcodes: and/or native emoji */
  content: string;
  /** Base text style (font size, color, weight, etc.) */
  style?: any;
  /** Font size for text and emoji sizing (default: 16) */
  fontSize?: number;
}

/**
 * Renders text with emoji awareness:
 * - Parses :shortcodes: → native Unicode
 * - For native emoji set: renders as plain text (no overhead)
 * - For custom sets: splits text, renders emoji as sprite sheet images inline
 */
export const EmojiAwareText: React.FC<EmojiAwareTextProps> = memo(({
  content,
  style,
  fontSize = 16,
}) => {
  const { emojiSet } = useEmoji();

  // Step 1: Parse shortcodes → native Unicode (always, for both user and AI messages)
  const normalizedText = useMemo(() => {
    return EmojiService.parseShortcodes(content);
  }, [content]);

  // Step 2: For native set, render as plain text (fast path)
  if (emojiSet === 'native') {
    return <Text style={style}>{normalizedText}</Text>;
  }

  // Step 3: Split text on emoji characters
  const segments = useMemo(() => {
    return EmojiService.splitTextOnEmojis(normalizedText);
  }, [normalizedText]);

  // Step 4: Render segments with inline emoji images
  return (
    <View style={[styles.container, { alignItems: 'flex-end' }]}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <Text key={index} style={style}>
              {segment.value}
            </Text>
          );
        }

        // Emoji segment — render using EmojiText (sprite sheet or fallback)
        return (
          <EmojiText
            key={index}
            native={segment.value}
            size={fontSize}
            emojiEntry={segment.emojiEntry}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
```

---

## Task 2 — Update FormattedRPText to integrate EmojiAwareText

**File:** `src/components/chat/ChatBubble.tsx`

The existing `FormattedRPText` (lines 33-68) splits text on `*asterisks*` for roleplay formatting. We need to wrap each text segment (both italic/RP and normal) through `EmojiAwareText` so emojis render with the custom set.

### Current FormattedRPText:
```typescript
// Currently returns raw <Text> fragments:
return <>{content}</>;   // plain text — no emoji handling
// or:
return <Text style={{ fontStyle: 'italic', ... }}>{part.slice(1, -1)}</Text>;  // RP text
```

### Updated FormattedRPText:

```typescript
import { EmojiAwareText } from '../emoji/EmojiAwareText';

const FormattedRPText: React.FC<{
  content: string;
  isOwn: boolean;
  accentColor: string;
}> = ({ content, isOwn, accentColor }) => {
  // Parse shortcodes first (handles both user and AI messages)
  const normalizedContent = EmojiService.parseShortcodes(content);

  const parts = normalizedContent.split(/(\*[^*]+\*)/g);

  if (parts.length <= 1 && !normalizedContent.includes('*')) {
    // No RP formatting — render entire text as a single EmojiAwareText
    return <EmojiAwareText content={normalizedContent} fontSize={16} />;
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          // Non-verbal action — italic with accent color
          return (
            <Text
              key={index}
              style={{
                fontStyle: 'italic',
                color: isOwn ? undefined : accentColor,
              }}
            >
              {part.slice(1, -1)}
            </Text>
          );
        }
        // Regular text segment — render with emoji awareness
        return (
          <EmojiAwareText
            key={index}
            content={part}
            fontSize={16}
          />
        );
      })}
    </>
  );
};
```

> **Important:** `EmojiAwareText` for the native set (default) is a zero-overhead passthrough — it just renders `<Text>`. No performance regression for users who haven't changed their emoji style.

> **Note on RP italic segments:** For the `*italic*` RP text segments, we keep them as plain `<Text>` since emojis inside RP actions are rare and the styling complication isn't worth it. If needed, this can be enhanced later to also use `EmojiAwareText`.

---

## Task 3 — Verify rendering in ChatBubble

No changes needed to the `ChatBubble` component's `renderContent()` or layout. The `FormattedRPText` enhancement from Task 2 handles everything transparently — the `ThemedText` wrapper still works:

```tsx
{/* This existing code now gets emoji-aware rendering automatically: */}
<ThemedText variant={isOwn ? 'primary' : 'secondary'} style={styles.textContent}>
  <FormattedRPText
    content={message.content}
    isOwn={isOwn}
    accentColor={theme.colors.accent.primary}
  />
</ThemedText>
```

### Verify these scenarios:

| Scenario | Input | Expected (Native set) | Expected (Noto/Twemoji set) |
|----------|-------|-----------------------|----------------------------|
| User sends native emoji | `"Hello 😂"` | `Hello 😂` (system) | `Hello [Noto/Twemoji 😂 image]` |
| AI sends native emoji | `"Hello 😂"` | `Hello 😂` (system) | `Hello [Noto/Twemoji 😂 image]` |
| AI sends shortcode | `"Hello :joy:"` | `Hello 😂` (system) | `Hello [Noto/Twemoji 😂 image]` |
| Mixed content | `":wave: Hi *smiles* 🎉"` | `👋 Hi smiles 🎉` | `[emoji] Hi [italic]smiles[/] [emoji]` |
| No emojis | `"Hello world"` | `Hello world` | `Hello world` (same speed as before) |
| Unknown shortcode | `"Hello :xyzfoo:"` | `Hello :xyzfoo:` (left as-is) | `Hello :xyzfoo:` (left as-is) |

---

## Progress Checklist

- [ ] `src/components/emoji/EmojiAwareText.tsx` created — splits text, renders emoji inline
- [ ] `FormattedRPText` in `ChatBubble.tsx` updated to use `EmojiAwareText`
- [ ] Shortcode parsing (`:joy:` → `😂`) works in chat bubble rendering
- [ ] Native emoji set: zero overhead passthrough (no splitting, no image rendering)
- [ ] Custom emoji sets: emoji characters in messages render as sprite sheet images
- [ ] Mixed content (text + emoji + RP formatting) renders correctly
- [ ] Unknown shortcodes left as-is (not stripped)
- [ ] Performance: native set renders messages with no measurable overhead vs. current code
- [ ] No regression to existing RP formatting (`*italic*` actions still work)

# Phase 15: Client — Picker Integration (Indicator, Popup & Advanced Button)

## Objective

Integrate emoji action awareness into the emoji picker:
1. **Dot indicator** — small colored dot on emojis that have actions assigned
2. **Long-press popup** — on long-pressing an emoji with an action, show a popup displaying the effects
3. **"Advanced Emoji Settings" button** — link in the picker header that navigates to the EmojiActionEditorScreen

## Codebase References

- [`src/components/emoji/EmojiItem.tsx`](../../src/components/emoji/EmojiItem.tsx) — picker grid button (Phase 4), needs dot indicator + long-press popup
- [`src/components/emoji/EmojiPickerModal.tsx`](../../src/components/emoji/EmojiPickerModal.tsx) — picker modal (Phase 4), needs "Advanced" button in header
- [`src/components/emoji/EmojiGrid.tsx`](../../src/components/emoji/EmojiGrid.tsx) — FlatList grid (Phase 4)
- [`src/services/EntityEmojiActionService.ts`](../../src/services/EntityEmojiActionService.ts) — action lookup (Phase 11)
- [`src/screens/settings/EmojiActionEditorScreen.tsx`](../../src/screens/settings/EmojiActionEditorScreen.tsx) — action editor screen (Phase 13)
- [`src/types/emoji.ts`](../../src/types/emoji.ts) — EmojiAction types (Phase 10)

---

## Task 1 — Add action indicator dot to EmojiItem

**File:** `src/components/emoji/EmojiItem.tsx`

Modify the existing EmojiItem component (from Phase 4) to accept an optional `hasAction` prop and render a small dot:

```typescript
import React, { memo, useCallback, useState } from 'react';
import { TouchableOpacity, View, StyleSheet, Modal, Text } from 'react-native';
import { EmojiText } from './EmojiText';
import { useEmoji } from '../../contexts/EmojiContext';
import { EmojiEntry, EmojiAction } from '../../types/emoji';
import { Theme } from '../../theme/types';

interface EmojiItemProps {
  emoji: EmojiEntry;
  size: number;
  onPress: (emoji: EmojiEntry) => void;
  onLongPress?: (emoji: EmojiEntry) => void;
  /** Whether this emoji has an action mapping */
  action?: EmojiAction | null;
  /** Theme for the action indicator dot */
  theme?: Theme;
}

export const EmojiItem: React.FC<EmojiItemProps> = memo(({
  emoji,
  size,
  onPress,
  onLongPress,
  action,
  theme,
}) => {
  const { skinTone } = useEmoji();
  const [showPopup, setShowPopup] = useState(false);

  const handlePress = useCallback(() => onPress(emoji), [emoji, onPress]);
  const handleLongPress = useCallback(() => {
    if (action) {
      setShowPopup(true);
    } else {
      onLongPress?.(emoji);
    }
  }, [emoji, onLongPress, action]);

  // Resolve which skin variant to display
  const skinIndex = Math.min(skinTone - 1, emoji.skins.length - 1);
  const activeSkin = emoji.skins[skinIndex] ?? emoji.skins[0];
  const nativeChar = activeSkin?.native ?? emoji.native;

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={[styles.touchable, { width: size + 8, height: size + 8 }]}
        activeOpacity={0.6}
      >
        <EmojiText native={nativeChar} size={size * 0.78} emojiEntry={emoji} />

        {/* Action indicator dot */}
        {action && theme && (
          <View style={[styles.actionDot, { backgroundColor: theme.colors.accent.primary }]} />
        )}
      </TouchableOpacity>

      {/* Long-press action popup */}
      {action && theme && showPopup && (
        <ActionPreviewPopup
          action={action}
          theme={theme}
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  );
});

// ---------------------------------------------------------------------------
// Action Preview Popup — shown on long-press of an emoji with an action
// ---------------------------------------------------------------------------

interface ActionPreviewPopupProps {
  action: EmojiAction;
  theme: Theme;
  onClose: () => void;
}

const ActionPreviewPopup: React.FC<ActionPreviewPopupProps> = ({ action, theme, onClose }) => (
  <Modal transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity
      style={styles.popupBackdrop}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={[styles.popupCard, { backgroundColor: theme.colors.background.elevated }]}>
        {/* Header */}
        <View style={styles.popupHeader}>
          <EmojiText native={action.emojiNative} size={28} />
          <Text style={[styles.popupTitle, { color: theme.colors.text.primary }]}>
            Emoji Action
          </Text>
        </View>

        {/* Emotion effect */}
        {action.emotionEffect && (
          <View style={styles.popupRow}>
            <Text style={[styles.popupLabel, { color: theme.colors.text.secondary }]}>Emotion:</Text>
            <View style={[styles.popupBadge, { backgroundColor: theme.colors.accent.primary + '22' }]}>
              <Text style={[styles.popupBadgeText, { color: theme.colors.accent.primary }]}>
                {action.emotionEffect.emotion} {action.emotionEffect.delta > 0 ? '+' : ''}{action.emotionEffect.delta}
              </Text>
            </View>
          </View>
        )}

        {/* Metabolism placeholder */}
        {action.metabolismVector && (
          <View style={styles.popupRow}>
            <Text style={[styles.popupLabel, { color: theme.colors.text.secondary }]}>Metabolism:</Text>
            <View style={[styles.popupBadge, { backgroundColor: theme.colors.status.success + '22' }]}>
              <Text style={[styles.popupBadgeText, { color: theme.colors.status.success }]}>
                {action.metabolismVector.type}: {action.metabolismVector.item}
              </Text>
            </View>
          </View>
        )}

        {/* Substitution text */}
        {action.substitutionText && (
          <View style={styles.popupRow}>
            <Text style={[styles.popupLabel, { color: theme.colors.text.secondary }]}>Substitution:</Text>
            <Text style={[styles.popupSubstitution, { color: theme.colors.text.primary }]}>
              {action.substitutionText}
            </Text>
          </View>
        )}

        {/* Tap to dismiss */}
        <Text style={[styles.popupDismiss, { color: theme.colors.text.muted }]}>
          Tap anywhere to dismiss
        </Text>
      </View>
    </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  touchable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Popup styles
  popupBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  popupCard: {
    width: 280,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  popupRow: {
    gap: 4,
  },
  popupLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  popupBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  popupBadgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  popupSubstitution: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  popupDismiss: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
```

---

## Task 2 — Pass action data through EmojiGrid

**File:** `src/components/emoji/EmojiGrid.tsx`

The EmojiGrid needs to receive the actions map and pass the relevant action to each EmojiItem. Add `actionsMap` prop:

```typescript
// Add to EmojiGridProps:
interface EmojiGridProps {
  categories: EmojiCategory[];
  activeCategory: string;
  onEmojiPress: (emoji: EmojiEntry) => void;
  onEmojiLongPress: (emoji: EmojiEntry) => void;
  theme: Theme;
  actionsMap?: Map<string, EmojiAction> | null;  // NEW
}

// In renderItem, pass the action:
const renderItem = useCallback(({ item }: { item: GridItem }) => {
  if (item.type === 'header') {
    // ... existing header rendering (unchanged) ...
  }

  return (
    <EmojiItem
      emoji={item.emoji!}
      size={EMOJI_SIZE}
      onPress={onEmojiPress}
      onLongPress={onEmojiLongPress}
      action={actionsMap?.get(item.emoji!.native) ?? null}
      theme={theme}
    />
  );
}, [theme, onEmojiPress, onEmojiLongPress, actionsMap]);
```

---

## Task 3 — Add "Advanced Emoji Settings" button to EmojiPickerModal

**File:** `src/components/emoji/EmojiPickerModal.tsx`

Add a button in the picker header (top-right, above or beside the category tabs). Also pass the actions map through to the grid.

```typescript
// Add to EmojiPickerModalProps:
interface EmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelected: (emoji: EmojiEntry) => void;
  entityId?: string | null;        // NEW: for action lookup and navigation
  onOpenActionEditor?: () => void; // NEW: navigation callback
}

// In component body:
const [actionsMap, setActionsMap] = useState<Map<string, EmojiAction> | null>(null);

useEffect(() => {
  if (!entityId || !visible) {
    setActionsMap(null);
    return;
  }
  EntityEmojiActionService.getActionsMap(entityId).then(setActionsMap);
}, [entityId, visible]);

// In the JSX, add above the CategoryTabBar:
<View style={[styles.pickerHeader, { backgroundColor: theme.colors.background.surface }]}>
  <CategoryTabBar
    categories={categories}
    activeCategory={activeCategory}
    onSelectCategory={setActiveCategory}
    theme={theme}
  />
  {onOpenActionEditor && (
    <TouchableOpacity
      onPress={onOpenActionEditor}
      style={styles.advancedButton}
    >
      <Icon name="tune-variant" size={18} color={theme.colors.accent.primary} />
      <ThemedText variant="accent" style={styles.advancedButtonText}>
        Advanced
      </ThemedText>
    </TouchableOpacity>
  )}
</View>

// Pass actionsMap to EmojiGrid:
<EmojiGrid
  categories={categories}
  activeCategory={activeCategory}
  onEmojiPress={handleEmojiPress}
  onEmojiLongPress={handleEmojiLongPress}
  theme={theme}
  actionsMap={actionsMap}
/>
```

New styles:
```typescript
pickerHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingRight: 8,
},
advancedButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingHorizontal: 8,
  paddingVertical: 4,
},
advancedButtonText: {
  fontSize: 12,
},
```

---

## Progress Checklist

- [ ] `EmojiItem.tsx` updated with `action` and `theme` props
- [ ] Small accent-colored dot rendered on emojis with assigned actions
- [ ] Long-press on action-mapped emoji shows popup with effect details
- [ ] Long-press on non-mapped emoji preserves existing behavior (skin tone picker)
- [ ] Popup dismisses on tap outside
- [ ] Popup shows emotion effect, metabolism placeholder, and substitution text
- [ ] `EmojiGrid.tsx` updated with `actionsMap` prop, passed through to EmojiItem
- [ ] `EmojiPickerModal.tsx` updated with `entityId` and `onOpenActionEditor` props
- [ ] Actions map loaded when picker becomes visible
- [ ] "Advanced Emoji Settings" button rendered in picker header
- [ ] Button navigates to EmojiActionEditorScreen via callback
- [ ] No visual regression for emojis without actions
- [ ] TypeScript compiles without errors

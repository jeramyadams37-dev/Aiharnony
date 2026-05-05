# Phase 4: Emoji Picker UI — Core Grid, Categories & Inline Renderer

## Objective

Build the core native emoji picker components with:
- Category tab bar (horizontal scrollable icons)
- Emoji grid (FlatList with columns)
- Modal wrapper for showing/hiding the picker
- **EmojiText inline renderer** — renders a single emoji as a sprite sheet crop or native text, used both in the picker grid AND in chat bubble text rendering
- Proper theming integration with ThemedView/ThemedText

## Codebase References

- [`src/components/chat/ChatInput.tsx`](../../src/components/chat/ChatInput.tsx) — bottom bar layout reference
- [`src/components/themed/ThemedView.tsx`](../../src/components/themed/ThemedView.tsx) — themed container pattern
- [`src/components/themed/ThemedText.tsx`](../../src/components/themed/ThemedText.tsx) — themed text pattern
- [`src/contexts/ThemeContext.tsx`](../../src/contexts/ThemeContext.tsx) — theme access pattern
- [`src/types/emoji.ts`](../../src/types/emoji.ts) — EmojiEntry, EmojiCategory, TextSegment types
- [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md) — component patterns

---

## Task 1 — Create EmojiText inline renderer

**File:** `src/components/emoji/EmojiText.tsx`

This is the **core rendering primitive** — renders a single emoji character using the active emoji set. Used by:
- `EmojiItem` (picker grid buttons)
- `EmojiAwareText` (chat bubble inline rendering, Phase 6)
- Anywhere a single emoji needs custom-set rendering

```typescript
import React, { memo, useRef, useEffect } from 'react';
import { View, Text, Image, ImageResolvedSource, StyleSheet } from 'react-native';
import { useEmoji } from '../../contexts/EmojiContext';
import { EmojiEntry } from '../../types/emoji';

interface EmojiTextProps {
  /** The native Unicode emoji character to render */
  native: string;
  /** Display size in pixels (default: 16, matches body text) */
  size?: number;
  /** Optional pre-resolved EmojiEntry (skips lookup if provided) */
  emojiEntry?: EmojiEntry;
}

/**
 * Renders a single emoji using the active emoji set.
 * - Native set: renders as Unicode text (system emoji font)
 * - Noto/Twemoji: renders as a cropped sprite sheet image
 *
 * Used by:
 * - EmojiItem (picker grid buttons)
 * - EmojiAwareText (chat bubble inline rendering)
 * - Anywhere a single emoji needs custom-set rendering
 */
export const EmojiText: React.FC<EmojiTextProps> = memo(({
  native,
  size = 16,
  emojiEntry: providedEntry,
}) => {
  const { emojiSet, emojiService } = useEmoji();
  const sheetDims = useRef<{ width: number; height: number } | null>(null);

  // Resolve emoji data (use provided entry or look up by native char)
  const entry = providedEntry ?? emojiService.getEmojiByNative(native);

  // Native set: render as text — zero overhead, no image loading
  if (emojiSet === 'native') {
    return (
      <Text style={{ fontSize: size }}>
        {native}
      </Text>
    );
  }

  // Custom set: render from sprite sheet
  const sheet = emojiService.getSpriteSheet(emojiSet);
  if (!sheet || !entry) {
    // Fallback to native if sprite or entry unavailable
    return <Text style={{ fontSize: size }}>{native}</Text>;
  }

  const crop = emojiService.getSpriteCrop(entry.sheetX, entry.sheetY);
  const scale = size / 64; // sprite cells are 64px

  // Resolve actual sheet dimensions for accurate scaling
  const resolved: ImageResolvedSource = Image.resolveAssetSource(sheet);
  const sheetWidth = resolved.width;
  const sheetHeight = resolved.height;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={resolved}
        style={{
          position: 'absolute',
          left: -crop.x * scale,
          top: -crop.y * scale,
          width: sheetWidth * scale,
          height: sheetHeight * scale,
          resizeMode: 'contain',
        }}
        fadeDuration={0}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

> **Implementation note:** The sprite sheet dimensions are resolved dynamically via `Image.resolveAssetSource()`. No hardcoded 3840px values — the actual sheet width/height from the asset is used for accurate scaling.

---

## Task 2 — Create EmojiItem component (picker grid button)

**File:** `src/components/emoji/EmojiItem.tsx`

Wraps `EmojiText` in a touchable button for the picker grid. Handles skin tone resolution.

```typescript
import React, { memo, useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { EmojiText } from './EmojiText';
import { useEmoji } from '../../contexts/EmojiContext';
import { EmojiEntry } from '../../types/emoji';

interface EmojiItemProps {
  emoji: EmojiEntry;
  size: number;
  onPress: (emoji: EmojiEntry) => void;
  onLongPress?: (emoji: EmojiEntry) => void;
}

export const EmojiItem: React.FC<EmojiItemProps> = memo(({
  emoji,
  size,
  onPress,
  onLongPress,
}) => {
  const { skinTone } = useEmoji();

  const handlePress = useCallback(() => onPress(emoji), [emoji, onPress]);
  const handleLongPress = useCallback(() => onLongPress?.(emoji), [emoji, onLongPress]);

  // Resolve which skin variant to display
  const skinIndex = Math.min(skinTone - 1, emoji.skins.length - 1);
  const activeSkin = emoji.skins[skinIndex] ?? emoji.skins[0];
  const nativeChar = activeSkin?.native ?? emoji.native;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={[styles.touchable, { width: size + 8, height: size + 8 }]}
      activeOpacity={0.6}
    >
      <EmojiText native={nativeChar} size={size * 0.78} emojiEntry={emoji} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  touchable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

---

## Task 3 — Create CategoryTabBar component

**File:** `src/components/emoji/CategoryTabBar.tsx`

Horizontal scrollable tab bar showing category icons. Matches the app's existing rounded pill/badge style. Tapping a tab scrolls the grid to that category section.

```typescript
import React, { memo, useCallback, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { EmojiCategory } from '../../types/emoji';
import { Theme } from '../../theme/types';

interface CategoryTabBarProps {
  categories: EmojiCategory[];
  activeCategory: string;
  onSelectCategory: (categoryId: string) => void;
  theme: Theme;
}

export const CategoryTabBar: React.FC<CategoryTabBarProps> = memo(({
  categories,
  activeCategory,
  onSelectCategory,
  theme,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.container, { backgroundColor: theme.colors.background.surface }]}
      contentContainerStyle={styles.content}
    >
      {categories.map(category => {
        const isActive = category.id === activeCategory;
        return (
          <TouchableOpacity
            key={category.id}
            onPress={() => onSelectCategory(category.id)}
            style={[
              styles.tab,
              {
                backgroundColor: isActive
                  ? theme.colors.accent.primary + '22'
                  : 'transparent',
                borderBottomColor: isActive
                  ? theme.colors.accent.primary
                  : 'transparent',
              },
            ]}
            activeOpacity={0.6}
          >
            <Text style={[styles.tabIcon, { fontSize: 18 }]}>
              {category.icon}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    maxHeight: 44,
  },
  content: {
    paddingHorizontal: 8,
    gap: 2,
  },
  tab: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderRadius: 4,
  },
  tabIcon: {
    textAlign: 'center',
  },
});
```

---

## Task 4 — Create EmojiGrid component

**File:** `src/components/emoji/EmojiGrid.tsx`

FlatList-based emoji grid. Renders sections per category with sticky category headers. Supports scrolling to a specific category when the user taps a tab.

```typescript
import React, { memo, useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { EmojiItem } from './EmojiItem';
import { ThemedText } from '../themed/ThemedText';
import { EmojiCategory, EmojiEntry } from '../../types/emoji';
import { Theme } from '../../theme/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EMOJI_SIZE = 36;
const HORIZONTAL_PADDING = 12;
const EMOJIS_PER_ROW = Math.floor(
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2) / (EMOJI_SIZE + 8)
);

interface EmojiGridProps {
  categories: EmojiCategory[];
  activeCategory: string;
  onEmojiPress: (emoji: EmojiEntry) => void;
  onEmojiLongPress: (emoji: EmojiEntry) => void;
  theme: Theme;
}

interface GridItem {
  type: 'header' | 'emoji';
  categoryId: string;
  categoryLabel?: string;
  emoji?: EmojiEntry;
}

export const EmojiGrid: React.FC<EmojiGridProps> = memo(({
  categories,
  activeCategory,
  onEmojiPress,
  onEmojiLongPress,
  theme,
}) => {
  const flatListRef = useRef<FlatList>(null);

  // Flatten categories into a single list of headers + emoji rows
  const gridItems = useMemo((): GridItem[] => {
    const items: GridItem[] = [];
    for (const category of categories) {
      items.push({
        type: 'header',
        categoryId: category.id,
        categoryLabel: category.name,
      });
      for (const emoji of category.emojis) {
        items.push({
          type: 'emoji',
          categoryId: category.id,
          emoji,
        });
      }
    }
    return items;
  }, [categories]);

  const renderItem = useCallback(({ item }: { item: GridItem }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.header, { backgroundColor: theme.colors.background.surface }]}>
          <ThemedText variant="secondary" style={styles.headerText}>
            {item.categoryLabel}
          </ThemedText>
        </View>
      );
    }

    return (
      <EmojiItem
        emoji={item.emoji!}
        size={EMOJI_SIZE}
        onPress={onEmojiPress}
        onLongPress={onEmojiLongPress}
      />
    );
  }, [theme, onEmojiPress, onEmojiLongPress]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: EMOJI_SIZE + 8,
    offset: (EMOJI_SIZE + 8) * index,
    index,
  }), []);

  // Scroll to category when active changes
  const scrollToCategory = useCallback((categoryId: string) => {
    const index = gridItems.findIndex(
      item => item.type === 'header' && item.categoryId === categoryId
    );
    if (index >= 0) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  }, [gridItems]);

  return (
    <FlatList
      ref={flatListRef}
      data={gridItems}
      keyExtractor={(item, index) =>
        item.type === 'header' ? `h-${item.categoryId}` : `e-${item.emoji!.id}`
      }
      renderItem={renderItem}
      numColumns={EMOJIS_PER_ROW}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.gridContent}
      onScrollToIndexFailed={(info) => {
        // Graceful fallback for scroll failures
        flatListRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: true,
        });
      }}
    />
  );
});

const styles = StyleSheet.create({
  gridContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
```

> **Note:** The `scrollToCategory` function is exposed but not called internally. Phase 5 wires it up via an imperative handle so the parent `EmojiPickerModal` can trigger scroll when the user taps a category tab.

---

## Task 5 — Create EmojiPickerModal wrapper

**File:** `src/components/emoji/EmojiPickerModal.tsx`

Modal wrapper that shows/hides the full picker. Integrates CategoryTabBar, EmojiGrid, and search (Phase 5 adds search bar and skin tone selector). Uses a bottom-sheet style layout with slide animation.

```typescript
import React, { useState, useCallback, memo } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { EmojiGrid } from './EmojiGrid';
import { CategoryTabBar } from './CategoryTabBar';
import { ThemedView } from '../themed/ThemedView';
import { ThemedText } from '../themed/ThemedText';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useEmoji } from '../../contexts/EmojiContext';
import { EmojiEntry } from '../../types/emoji';

interface EmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelected: (emoji: EmojiEntry) => void;
}

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = memo(({
  visible,
  onClose,
  onEmojiSelected,
}) => {
  const { theme } = useAppTheme();
  const { emojiService } = useEmoji();
  const [activeCategory, setActiveCategory] = useState('people');
  const [showSkinTonePicker, setShowSkinTonePicker] = useState(false);

  const categories = emojiService.getCategories();

  const handleEmojiPress = useCallback((emoji: EmojiEntry) => {
    onEmojiSelected(emoji);
  }, [onEmojiSelected]);

  const handleEmojiLongPress = useCallback((emoji: EmojiEntry) => {
    // Skin tone picker will be implemented in Phase 5
    setShowSkinTonePicker(true);
  }, []);

  if (!theme) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <ThemedView style={[styles.pickerContainer, { backgroundColor: theme.colors.background.base }]}>
          {/* Category tabs */}
          <CategoryTabBar
            categories={categories}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            theme={theme}
          />

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />

          {/* Emoji grid */}
          <EmojiGrid
            categories={categories}
            activeCategory={activeCategory}
            onEmojiPress={handleEmojiPress}
            onEmojiLongPress={handleEmojiLongPress}
            theme={theme}
          />
        </ThemedView>
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  pickerContainer: {
    height: '55%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
```

> **Phase 5 additions:** The modal will be extended to add a search bar at the top (above category tabs) and a skin tone selector (bottom-left). The existing structure supports these additions without restructuring.

---

## Task 6 — Export barrel file

**File:** `src/components/emoji/index.ts`

```typescript
export { EmojiText } from './EmojiText';
export { EmojiItem } from './EmojiItem';
export { EmojiGrid } from './EmojiGrid';
export { CategoryTabBar } from './CategoryTabBar';
export { EmojiPickerModal } from './EmojiPickerModal';
```

---

## Progress Checklist

- [ ] `src/components/emoji/EmojiText.tsx` created — renders emoji via active set (native text or sprite sheet crop)
- [ ] `src/components/emoji/EmojiItem.tsx` created — picker grid button wrapping EmojiText with skin tone resolution
- [ ] `src/components/emoji/CategoryTabBar.tsx` created — horizontal scrollable category tabs with active indicator
- [ ] `src/components/emoji/EmojiGrid.tsx` created — FlatList grid with section headers and category scroll
- [ ] `src/components/emoji/EmojiPickerModal.tsx` created — modal wrapper with bottom-sheet layout
- [ ] `src/components/emoji/index.ts` barrel export created (includes EmojiText)
- [ ] EmojiText renders correctly for native set (Unicode text)
- [ ] EmojiText renders correctly for custom sets (sprite sheet crop with dynamic sheet dimensions)
- [ ] All components compile without TypeScript errors
- [ ] Components use ThemedView/ThemedText and `useAppTheme()` consistently

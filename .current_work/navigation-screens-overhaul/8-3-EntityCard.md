# Phase 8-3: EntityCard Component

## Objective
Create the `EntityCard` component used in the `EntityConfigScreen` list. Displays entity alias, linked character profile name, avatar image, and active module chips. Includes a context menu (⋮) for edit and delete actions.

## Files to Create
- `src/components/entities/EntityCard.tsx`

---

## Visual Design

```
┌──────────────────────────────────────────────────────┐
│  ┌──────┐                                            │
│  │ [🤖] │  Aria                              [⋮]    │  ← alias + context menu
│  │ img  │  Character: Aria (profile name)           │  ← character profile link
│  └──────┘  [Cognition] [TTS]                        │  ← module chips
└──────────────────────────────────────────────────────┘
```

Avatar: 52×52 rounded square showing character profile primary image or robot placeholder icon.

Module chips: small rounded pill labels for each active module (`Cognition`, `TTS`, `STT`, `Vision`, `Memory`, `Imagination`). Displayed inline, wrapping if needed.

---

## Component Implementation

**File:** `src/components/entities/EntityCard.tsx`

```typescript
import React, { useState } from 'react';
import {
  View, TouchableOpacity, Image, StyleSheet, Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { ThemedText } from '../themed/ThemedText';

// The EntityListItem type (matches definition in EntityConfigScreen)
export interface EntityListItem {
  entity: {
    id: string;
    alias: string | null;
    character_profile_id: string | null;
  };
  characterProfileName: string | null;
  characterProfileImageUri: string | null;
  moduleMapping: any | null;
  activeModuleNames: string[];
}

interface EntityCardProps {
  item: EntityListItem;
  onPress: () => void;
  onDelete: () => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({ item, onPress, onDelete }) => {
  const { theme } = useAppTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const displayName = item.entity.alias ?? item.entity.id.substring(0, 8) + '…';

  if (!theme) return null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.background.elevated,
          borderColor: theme.colors.border.default,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: theme.colors.background.base }]}>
        {item.characterProfileImageUri ? (
          <Image
            source={{ uri: item.characterProfileImageUri }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Icon name="robot-outline" size={28} color={theme.colors.text.muted} />
        )}
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Entity alias */}
        <ThemedText weight="bold" size={15} numberOfLines={1}>
          {displayName}
        </ThemedText>

        {/* Character profile name */}
        <ThemedText variant="secondary" size={12} numberOfLines={1} style={styles.profileName}>
          {item.characterProfileName
            ? `Character: ${item.characterProfileName}`
            : 'No character profile'}
        </ThemedText>

        {/* Module chips */}
        {item.activeModuleNames.length > 0 ? (
          <View style={styles.chipsRow}>
            {item.activeModuleNames.map(name => (
              <View
                key={name}
                style={[styles.chip, { backgroundColor: theme.colors.accent.primary + '22', borderColor: theme.colors.accent.primary + '44' }]}
              >
                <ThemedText size={10} style={{ color: theme.colors.accent.primary }}>
                  {name}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText variant="muted" size={11} style={styles.noModules}>
            No modules configured
          </ThemedText>
        )}
      </View>

      {/* Context menu button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="dots-vertical" size={20} color={theme.colors.text.muted} />
      </TouchableOpacity>

      {/* Context menu modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.contextMenu, { backgroundColor: theme.colors.background.elevated }]}>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => { setMenuVisible(false); onPress(); }}
                >
                  <Icon name="pencil" size={18} color={theme.colors.text.primary} style={styles.contextMenuIcon} />
                  <ThemedText size={15}>Edit Settings</ThemedText>
                </TouchableOpacity>
                <View style={[styles.menuDivider, { backgroundColor: theme.colors.border.default }]} />
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => { setMenuVisible(false); onDelete(); }}
                >
                  <Icon name="delete-outline" size={18} color={theme.colors.status?.error ?? '#f44336'} style={styles.contextMenuIcon} />
                  <ThemedText size={15} style={{ color: theme.colors.status?.error ?? '#f44336' }}>
                    Delete Entity
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: { width: '100%', height: '100%' },
  content: { flex: 1, gap: 3 },
  profileName: { opacity: 0.8 },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  noModules: { marginTop: 2 },
  menuButton: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    borderRadius: 12,
    minWidth: 200,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  contextMenuIcon: { marginRight: 12 },
  menuDivider: { height: StyleSheet.hairlineWidth },
});
```

---

## Progress Checklist

- [ ] Create `src/components/entities/EntityCard.tsx`
- [ ] Export `EntityListItem` interface from `EntityCard.tsx` (used by `EntityConfigScreen`)
- [ ] Test: card renders with image avatar
- [ ] Test: card renders with robot placeholder when no image
- [ ] Test: alias displayed; falls back to truncated UUID when no alias
- [ ] Test: character profile name shown; "No character profile" when not linked
- [ ] Test: module chips render for each active module
- [ ] Test: "No modules configured" shown when empty
- [ ] Test: ⋮ button opens context menu
- [ ] Test: "Edit Settings" in context menu calls `onPress`
- [ ] Test: "Delete Entity" in context menu calls `onDelete`
- [ ] Test: tapping outside context menu dismisses it

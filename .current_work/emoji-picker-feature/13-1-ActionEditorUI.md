# Phase 13: Client — Emoji Action Editor UI

## Objective

Create a dedicated screen for managing emoji action mappings per entity. Accessible from:
1. Entity settings (direct navigation)
2. "Advanced Emoji Settings" button in the emoji picker header (Phase 15 wires this)

The screen displays all assigned actions, allows creating/editing/deleting actions, and provides "Reset to Defaults" functionality.

## Codebase References

- [`src/screens/settings/ThemeSettingsScreen.tsx`](../../src/screens/settings/ThemeSettingsScreen.tsx) — settings screen layout pattern
- [`src/screens/EntityConfigScreen.tsx`](../../src/screens/EntityConfigScreen.tsx) — entity management screen pattern
- [`src/components/settings/EmojiStyleCard.tsx`](../../src/components/settings/EmojiStyleCard.tsx) — card UI pattern (Phase 8)
- [`src/components/themed/ThemedView.tsx`](../../src/components/themed/ThemedView.tsx) — themed container
- [`src/components/themed/ThemedText.tsx`](../../src/components/themed/ThemedText.tsx) — themed text
- [`src/components/themed/ThemedButton.tsx`](../../src/components/themed/ThemedButton.tsx) — themed button
- [`src/contexts/ThemeContext.tsx`](../../src/contexts/ThemeContext.tsx) — `useAppTheme()` hook
- [`src/types/emoji.ts`](../../src/types/emoji.ts) — EmojiAction, EmotionEffect, MetabolismVector, EKMAN8_EMOTIONS, Ekman8Emotion
- [`src/services/EntityEmojiActionService.ts`](../../src/services/EntityEmojiActionService.ts) — action CRUD + aggregation
- [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md) — component/screen naming conventions

---

## Task 1 — Create EmojiActionEditorScreen

**File:** `src/screens/settings/EmojiActionEditorScreen.tsx`

Full screen with:
- Header with entity name and "Reset to Defaults" button
- FlatList of action cards (emoji + effects summary + substitution text)
- FAB or header "+" button to add new action
- Each card shows: emoji, emotion effect badge, metabolism badge, substitution text preview
- Tap card → edit modal
- Swipe or long-press → delete with confirmation

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { ThemedView } from '../../components/themed/ThemedView';
import { ThemedText } from '../../components/themed/ThemedText';
import { EmojiText } from '../../components/emoji/EmojiText';
import { EmojiActionCard } from '../../components/settings/EmojiActionCard';
import { EmojiActionEditModal } from '../../components/settings/EmojiActionEditModal';
import EntityEmojiActionService from '../../services/EntityEmojiActionService';
import { EmojiAction, Ekman8Emotion, EKMAN8_EMOTIONS } from '../../types/emoji';
import { createLogger } from '../../utils/logger';

const log = createLogger('[EmojiActionEditor]');

interface EmojiActionEditorProps {
  route: {
    params: {
      entityId: string;
      entityName: string;
    };
  };
  navigation: any;
}

export const EmojiActionEditorScreen: React.FC<EmojiActionEditorProps> = ({
  route,
  navigation,
}) => {
  const { entityId, entityName } = route.params;
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [actions, setActions] = useState<EmojiAction[]>([]);
  const [editingAction, setEditingAction] = useState<EmojiAction | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load actions
  const loadActions = useCallback(async () => {
    try {
      const allActions = await EntityEmojiActionService.getAllActions(entityId);
      setActions(allActions);
    } catch (error) {
      log.error('Failed to load emoji actions:', error);
    }
  }, [entityId]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  // Set navigation options
  useEffect(() => {
    navigation.setOptions({
      title: `${entityName} — Emoji Actions`,
      headerRight: () => (
        <TouchableOpacity
          onPress={handleResetDefaults}
          style={styles.headerButton}
        >
          <Icon name="refresh" size={22} color={theme.colors.accent.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, entityName, theme]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActions();
    setRefreshing(false);
  }, [loadActions]);

  const handleAddAction = useCallback(() => {
    setIsCreating(true);
    setEditingAction(null);
  }, []);

  const handleEditAction = useCallback((action: EmojiAction) => {
    setIsCreating(false);
    setEditingAction(action);
  }, []);

  const handleDeleteAction = useCallback((action: EmojiAction) => {
    Alert.alert(
      'Delete Action',
      `Remove the action for ${action.emojiNative}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await EntityEmojiActionService.removeAction(action.id, entityId);
            await loadActions();
          },
        },
      ],
    );
  }, [entityId, loadActions]);

  const handleSaveAction = useCallback(async (action: Omit<EmojiAction, 'createdAt' | 'updatedAt'>) => {
    await EntityEmojiActionService.saveAction(action);
    setEditingAction(null);
    setIsCreating(false);
    await loadActions();
  }, [loadActions]);

  const handleCloseModal = useCallback(() => {
    setEditingAction(null);
    setIsCreating(false);
  }, []);

  const handleResetDefaults = useCallback(() => {
    Alert.alert(
      'Reset to Defaults',
      'This will delete all custom actions and restore the default emoji mappings. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await EntityEmojiActionService.seedDefaults(entityId, true);
            await loadActions();
          },
        },
      ],
    );
  }, [entityId, loadActions]);

  if (!theme) return null;

  const renderAction = useCallback(({ item }: { item: EmojiAction }) => (
    <EmojiActionCard
      action={item}
      onPress={() => handleEditAction(item)}
      onDelete={() => handleDeleteAction(item)}
      theme={theme}
    />
  ), [theme, handleEditAction, handleDeleteAction]);

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Summary header */}
      <View style={[styles.summary, { backgroundColor: theme.colors.background.surface }]}>
        <ThemedText variant="secondary" style={styles.summaryText}>
          {actions.length} emoji action{actions.length !== 1 ? 's' : ''} configured
        </ThemedText>
        <TouchableOpacity onPress={handleAddAction} style={styles.addButton}>
          <Icon name="plus" size={20} color={theme.colors.accent.primary} />
          <ThemedText variant="accent" style={styles.addButtonText}>Add Action</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Action list */}
      <FlatList
        data={actions}
        keyExtractor={item => item.id}
        renderItem={renderAction}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText variant="secondary" style={styles.emptyText}>
              No emoji actions configured yet.
            </ThemedText>
            <TouchableOpacity onPress={handleAddAction}>
              <ThemedText variant="accent">Add your first action</ThemedText>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={actions.length === 0 ? styles.emptyList : styles.list}
      />

      {/* Add FAB */}
      {actions.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.accent.primary }]}
          onPress={handleAddAction}
        >
          <Icon name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Edit/Create Modal */}
      {(editingAction || isCreating) && (
        <EmojiActionEditModal
          entityId={entityId}
          existingAction={editingAction}
          existingActions={actions}
          onSave={handleSaveAction}
          onClose={handleCloseModal}
          visible={true}
        />
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerButton: { padding: 8, marginRight: 4 },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  summaryText: { fontSize: 14 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { fontSize: 14 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  emptyList: { flexGrow: 1, paddingHorizontal: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
```

---

## Task 2 — Create EmojiActionCard component

**File:** `src/components/settings/EmojiActionCard.tsx`

Card displaying a single action mapping with emoji, effect badges, and substitution preview:

```typescript
import React, { memo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedText } from '../themed/ThemedText';
import { EmojiText } from '../emoji/EmojiText';
import { Theme } from '../../theme/types';
import { EmojiAction } from '../../types/emoji';

interface EmojiActionCardProps {
  action: EmojiAction;
  onPress: () => void;
  onDelete: () => void;
  theme: Theme;
}

export const EmojiActionCard: React.FC<EmojiActionCardProps> = memo(({
  action,
  onPress,
  onDelete,
  theme,
}) => {
  const hasEmotion = action.emotionEffect !== null;
  const hasMetabolism = action.metabolismVector !== null;
  const hasSubstitution = action.substitutionText !== null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.colors.background.elevated }]}
      activeOpacity={0.7}
    >
      {/* Delete button */}
      <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
        <Icon name="close-circle" size={18} color={theme.colors.text.muted} />
      </TouchableOpacity>

      {/* Default badge */}
      {action.isDefault && (
        <View style={[styles.defaultBadge, { backgroundColor: theme.colors.accent.primary + '22' }]}>
          <ThemedText variant="accent" style={styles.defaultBadgeText}>DEFAULT</ThemedText>
        </View>
      )}

      {/* Row: Emoji + Substitution preview */}
      <View style={styles.mainRow}>
        <EmojiText native={action.emojiNative} size={32} />
        <View style={styles.textContainer}>
          {hasSubstitution ? (
            <ThemedText variant="primary" style={styles.substitutionText} numberOfLines={2}>
              {action.substitutionText}
            </ThemedText>
          ) : (
            <ThemedText variant="secondary" style={styles.noSubstitution}>
              No substitution text
            </ThemedText>
          )}
        </View>
      </View>

      {/* Effect badges */}
      <View style={styles.badges}>
        {hasEmotion && (
          <View style={[styles.badge, { backgroundColor: theme.colors.accent.primary + '15' }]}>
            <ThemedText variant="accent" style={styles.badgeText}>
              {action.emotionEffect!.emotion} {action.emotionEffect!.delta > 0 ? '+' : ''}{action.emotionEffect!.delta}
            </ThemedText>
          </View>
        )}
        {hasMetabolism && (
          <View style={[styles.badge, { backgroundColor: theme.colors.status.success + '15' }]}>
            <ThemedText variant="secondary" style={styles.badgeText}>
              {action.metabolismVector!.type}: {action.metabolismVector!.item}
            </ThemedText>
          </View>
        )}
        {!hasEmotion && !hasMetabolism && (
          <ThemedText variant="secondary" style={styles.noEffects}>No effects defined</ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  defaultBadge: {
    position: 'absolute',
    top: 8,
    left: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '600' },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  textContainer: { flex: 1 },
  substitutionText: { fontSize: 14, fontStyle: 'italic' },
  noSubstitution: { fontSize: 14, fontStyle: 'italic' },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { fontSize: 12 },
  noEffects: { fontSize: 12, fontStyle: 'italic' },
});
```

---

## Task 3 — Create EmojiActionEditModal

**File:** `src/components/settings/EmojiActionEditModal.tsx`

Modal for creating or editing an action. Contains:
- Emoji selector (reuses the emoji picker from Phase 4-5)
- Emotion selector dropdown (Ekman8 + intensity slider)
- Metabolism type/item inputs (placeholder)
- Substitution text editor (with auto-generate toggle)
- Save / Cancel buttons

```typescript
import React, { useState, useCallback, memo } from 'react';
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedView } from '../themed/ThemedView';
import { ThemedText } from '../themed/ThemedText';
import { useAppTheme } from '../../contexts/ThemeContext';
import { EmojiPickerModal } from '../emoji/EmojiPickerModal';
import { EmojiText } from '../emoji/EmojiText';
import EntityEmojiActionService from '../../services/EntityEmojiActionService';
import {
  EmojiAction,
  EmojiEntry,
  EmotionEffect,
  MetabolismVector,
  Ekman8Emotion,
  EKMAN8_EMOTIONS,
} from '../../types/emoji';
import { Theme } from '../../theme/types';

interface EmojiActionEditModalProps {
  entityId: string;
  existingAction: EmojiAction | null;  // null = creating new
  existingActions: EmojiAction[];       // for duplicate emoji check
  visible: boolean;
  onSave: (action: Omit<EmojiAction, 'createdAt' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
}

export const EmojiActionEditModal: React.FC<EmojiActionEditModalProps> = memo(({
  entityId,
  existingAction,
  existingActions,
  visible,
  onSave,
  onClose,
}) => {
  const { theme } = useAppTheme();

  // State initialized from existing action or defaults
  const [selectedEmoji, setSelectedEmoji] = useState<string>(
    existingAction?.emojiNative ?? ''
  );
  const [emotionEnabled, setEmotionEnabled] = useState(
    existingAction?.emotionEffect !== null
  );
  const [selectedEmotion, setSelectedEmotion] = useState<Ekman8Emotion>(
    existingAction?.emotionEffect?.emotion ?? 'joy'
  );
  const [emotionDelta, setEmotionDelta] = useState<string>(
    existingAction?.emotionEffect?.delta?.toString() ?? '2.0'
  );
  const [metabolismEnabled, setMetabolismEnabled] = useState(
    existingAction?.metabolismVector !== null
  );
  const [metabolismType, setMetabolismType] = useState(
    existingAction?.metabolismVector?.type ?? 'eat'
  );
  const [metabolismItem, setMetabolismItem] = useState(
    existingAction?.metabolismVector?.item ?? ''
  );
  const [substitutionText, setSubstitutionText] = useState(
    existingAction?.substitutionText ?? ''
  );
  const [autoGenerated, setAutoGenerated] = useState(
    existingAction?.autoGenerated ?? true
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEmojiSelect = useCallback((emoji: EmojiEntry) => {
    // Check for duplicate
    const existing = existingActions.find(a => a.emojiNative === emoji.native);
    if (existing && (!existingAction || existing.id !== existingAction.id)) {
      Alert.alert('Duplicate', `An action already exists for ${emoji.native}. Edit the existing one instead.`);
      return;
    }
    setSelectedEmoji(emoji.native);
    setShowEmojiPicker(false);
  }, [existingActions, existingAction]);

  const handleAutoGenerate = useCallback(() => {
    const effects: { emotionEffect: EmotionEffect | null; metabolismVector: MetabolismVector | null } = {
      emotionEffect: emotionEnabled ? { emotion: selectedEmotion, delta: parseFloat(emotionDelta) || 0 } : null,
      metabolismVector: metabolismEnabled ? { type: metabolismType, item: metabolismItem || 'something' } : null,
    };
    const generated = EntityEmojiActionService.generateSubstitutionText(effects);
    if (generated) {
      setSubstitutionText(generated);
      setAutoGenerated(true);
    }
  }, [emotionEnabled, selectedEmotion, emotionDelta, metabolismEnabled, metabolismType, metabolismItem]);

  const handleSave = useCallback(async () => {
    if (!selectedEmoji) {
      Alert.alert('Missing Emoji', 'Please select an emoji for this action.');
      return;
    }

    setSaving(true);
    try {
      const actionId = existingAction?.id ?? `${entityId}_${selectedEmoji}_${Date.now()}`;

      await onSave({
        id: actionId,
        entityId,
        emojiNative: selectedEmoji,
        emotionEffect: emotionEnabled
          ? { emotion: selectedEmotion, delta: parseFloat(emotionDelta) || 0 }
          : null,
        metabolismVector: metabolismEnabled
          ? { type: metabolismType, item: metabolismItem || 'something' }
          : null,
        substitutionText: substitutionText || null,
        autoGenerated,
        isDefault: existingAction?.isDefault ?? false,
      });
    } finally {
      setSaving(false);
    }
  }, [
    selectedEmoji, entityId, existingAction, emotionEnabled, selectedEmotion,
    emotionDelta, metabolismEnabled, metabolismType, metabolismItem,
    substitutionText, autoGenerated, onSave,
  ]);

  if (!theme) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
          <TouchableOpacity onPress={onClose}>
            <ThemedText variant="secondary">Cancel</ThemedText>
          </TouchableOpacity>
          <ThemedText variant="primary" style={styles.headerTitle}>
            {existingAction ? 'Edit Action' : 'New Action'}
          </ThemedText>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <ThemedText variant="accent" style={styles.saveButton}>
              {saving ? 'Saving...' : 'Save'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
          {/* Emoji Selector */}
          <View style={styles.section}>
            <ThemedText variant="secondary" style={styles.label}>Emoji</ThemedText>
            <TouchableOpacity
              style={[styles.emojiSelector, { backgroundColor: theme.colors.background.elevated }]}
              onPress={() => setShowEmojiPicker(true)}
            >
              {selectedEmoji ? (
                <View style={styles.emojiSelectorRow}>
                  <EmojiText native={selectedEmoji} size={32} />
                  <ThemedText variant="secondary">Tap to change</ThemedText>
                </View>
              ) : (
                <ThemedText variant="secondary">Select an emoji...</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* Emotion Effect */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <ThemedText variant="secondary" style={styles.label}>Emotion Effect</ThemedText>
              <Switch value={emotionEnabled} onValueChange={setEmotionEnabled} />
            </View>
            {emotionEnabled && (
              <View style={styles.effectInputs}>
                {/* Emotion picker — simple scrollable row of emotion names */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emotionScroll}>
                  {EKMAN8_EMOTIONS.map(em => (
                    <TouchableOpacity
                      key={em}
                      onPress={() => setSelectedEmotion(em)}
                      style={[
                        styles.emotionChip,
                        {
                          backgroundColor: em === selectedEmotion
                            ? theme.colors.accent.primary + '22'
                            : theme.colors.background.elevated,
                          borderColor: em === selectedEmotion
                            ? theme.colors.accent.primary
                            : theme.colors.border.default,
                        },
                      ]}
                    >
                      <ThemedText variant={em === selectedEmotion ? 'accent' : 'secondary'}>
                        {em}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* Delta input */}
                <View style={styles.deltaRow}>
                  <ThemedText variant="secondary">Intensity (-5.0 to +5.0):</ThemedText>
                  <TextInput
                    value={emotionDelta}
                    onChangeText={setEmotionDelta}
                    keyboardType="decimal-pad"
                    style={[
                      styles.deltaInput,
                      { color: theme.colors.text.primary, backgroundColor: theme.colors.background.elevated },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Metabolism Placeholder */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <ThemedText variant="secondary" style={styles.label}>Metabolism Effect</ThemedText>
              <Switch value={metabolismEnabled} onValueChange={setMetabolismEnabled} />
            </View>
            {metabolismEnabled && (
              <View style={styles.effectInputs}>
                <View style={styles.metabolismRow}>
                  <TextInput
                    value={metabolismType}
                    onChangeText={setMetabolismType}
                    placeholder="Type (eat, drink...)"
                    placeholderTextColor={theme.colors.text.muted}
                    style={[
                      styles.smallInput,
                      { color: theme.colors.text.primary, backgroundColor: theme.colors.background.elevated },
                    ]}
                  />
                  <TextInput
                    value={metabolismItem}
                    onChangeText={setMetabolismItem}
                    placeholder="Item (burger, water...)"
                    placeholderTextColor={theme.colors.text.muted}
                    style={[
                      styles.smallInput,
                      { color: theme.colors.text.primary, backgroundColor: theme.colors.background.elevated },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Substitution Text */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <ThemedText variant="secondary" style={styles.label}>Substitution Text</ThemedText>
              <TouchableOpacity onPress={handleAutoGenerate}>
                <ThemedText variant="accent" style={styles.autoGenButton}>Auto-generate</ThemedText>
              </TouchableOpacity>
            </View>
            <TextInput
              value={substitutionText}
              onChangeText={(text) => {
                setSubstitutionText(text);
                setAutoGenerated(false); // User edited manually
              }}
              placeholder="*roleplay text replacing the emoji*"
              placeholderTextColor={theme.colors.text.muted}
              multiline
              style={[
                styles.substitutionInput,
                { color: theme.colors.text.primary, backgroundColor: theme.colors.background.elevated },
              ]}
            />
          </View>
        </ScrollView>

        {/* Emoji Picker Modal (for emoji selection) */}
        <EmojiPickerModal
          visible={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelected={handleEmojiSelect}
        />
      </ThemedView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveButton: { fontSize: 17, fontWeight: '600' },
  form: { flex: 1 },
  formContent: { paddingHorizontal: 16, paddingVertical: 12 },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  emojiSelector: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  emojiSelectorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  effectInputs: { gap: 8 },
  emotionScroll: { marginBottom: 8 },
  emotionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
  },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deltaInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 16,
  },
  metabolismRow: { flexDirection: 'row', gap: 8 },
  smallInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
  },
  autoGenButton: { fontSize: 14 },
  substitutionInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
```

---

## Task 4 — Register screen in navigation

**File:** Navigation configuration (wherever screens are registered — check the navigator setup)

Add `EmojiActionEditorScreen` to the stack navigator with a route name like `'EmojiActionEditor'`.

---

## Progress Checklist

- [ ] `src/screens/settings/EmojiActionEditorScreen.tsx` created
- [ ] `src/components/settings/EmojiActionCard.tsx` created
- [ ] `src/components/settings/EmojiActionEditModal.tsx` created
- [ ] Screen loads actions for the specified entity on mount
- [ ] Pull-to-refresh reloads actions
- [ ] "Add Action" opens edit modal in creation mode (no existing action)
- [ ] Tap card opens edit modal in edit mode (pre-fills fields)
- [ ] Delete action shows confirmation dialog
- [ ] "Reset to Defaults" shows confirmation, then calls `seedDefaults(force=true)`
- [ ] Emoji selector opens EmojiPickerModal for emoji selection
- [ ] Duplicate emoji detection prevents creating two actions for the same emoji
- [ ] Emotion picker shows all 8 Ekman8 emotions as selectable chips
- [ ] Delta input accepts decimal values, clamped to -5.0 to +5.0 on save
- [ ] "Auto-generate" button creates substitution text from current effects
- [ ] Manual substitution text editing sets `autoGenerated = false`
- [ ] Screen registered in navigation stack
- [ ] All components use ThemedView/ThemedText and `useAppTheme()`
- [ ] TypeScript compiles without errors

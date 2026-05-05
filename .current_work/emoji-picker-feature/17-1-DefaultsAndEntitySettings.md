# Phase 17: Client — Pre-seeded Defaults & Entity Settings Link

## Objective

1. Add an "Emoji Actions" entry to the entity settings/configuration screen, providing a direct path to the EmojiActionEditorScreen.
2. Ensure the pre-seeded defaults are properly managed (seeded on first session, resettable from editor).
3. Add any remaining navigation wiring so users can discover and access the emoji action feature.

## Codebase References

- [`src/screens/EntityConfigScreen.tsx`](../../src/screens/EntityConfigScreen.tsx) — entity configuration screen
- [`src/components/navigation/SettingsMenu.tsx`](../../src/components/navigation/SettingsMenu.tsx) — settings menu structure
- [`src/components/entities/EntityCard.tsx`](../../src/components/entities/EntityCard.tsx) — entity card component
- [`src/screens/settings/EmojiActionEditorScreen.tsx`](../../src/screens/settings/EmojiActionEditorScreen.tsx) — action editor (Phase 13)
- [`src/services/EntityEmojiActionService.ts`](../../src/services/EntityEmojiActionService.ts) — service with `seedDefaults()` (Phase 11)

---

## Task 1 — Add "Emoji Actions" entry to EntityConfigScreen

**File:** `src/screens/EntityConfigScreen.tsx`

Add a navigation item in the entity settings that opens the EmojiActionEditorScreen:

```typescript
// In the settings section of EntityConfigScreen, add a new row:
<TouchableOpacity
  style={[styles.menuItem, { borderBottomColor: theme.colors.border.default }]}
  onPress={() => navigation.navigate('EmojiActionEditor', {
    entityId: entity.id,
    entityName: entity.alias || entity.id,
  })}
>
  <View style={styles.menuItemLeft}>
    <Icon name="emoticon-outline" size={24} color={theme.colors.accent.primary} />
    <ThemedText variant="primary" style={styles.menuItemText}>
      Emoji Actions
    </ThemedText>
  </View>
  <View style={styles.menuItemRight}>
    <ThemedText variant="secondary" style={styles.menuItemHint}>
      Customize emoji behaviors
    </ThemedText>
    <Icon name="chevron-right" size={20} color={theme.colors.text.muted} />
  </View>
</TouchableOpacity>
```

**Placement:** Add after any existing entity settings items, before destructive actions (delete, etc.). This gives users a clear entry point to the emoji action feature from the entity management flow.

---

## Task 2 — Ensure pre-seeded defaults work correctly

The `EntityEmojiActionService.seedDefaults()` method (Phase 11) handles seeding. This task verifies the lifecycle:

1. **First session** — `ChatDetailScreen` calls `seedDefaults(entityId)` when session starts. The method checks `countEmojiActions()` — if 0, seeds the 20 defaults. If >0, skips.

2. **Reset to defaults** — The EmojiActionEditorScreen has a "Reset to Defaults" button that calls `seedDefaults(entityId, true)`, which deletes all existing actions and re-seeds.

3. **Cache invalidation** — After seeding, the in-memory cache is invalidated so the next lookup loads fresh data.

No new code needed here — this is a verification task. The implementation is in Phase 11 (service) and Phase 16 (session lifecycle hook).

**Verification steps:**
- Create a new entity → start chat session → verify 20 default actions are seeded
- Delete a default action → verify it's gone from the editor
- "Reset to Defaults" → verify all 20 actions are restored
- Edit a default action → verify changes persist across app restarts
- Create a custom action → verify it appears alongside defaults

---

## Task 3 — Verify navigation graph completeness

Ensure the following navigation paths all work:

| From | To | Route |
|------|----|-------|
| Entity Config Screen | Emoji Action Editor | `navigation.navigate('EmojiActionEditor', { entityId, entityName })` |
| Emoji Picker (Advanced button) | Emoji Action Editor | Via `onOpenActionEditor` callback in ChatDetailScreen |
| Emoji Action Editor | Emoji Picker (emoji select) | Via `EmojiPickerModal` in `EmojiActionEditModal` |

The navigation route `EmojiActionEditor` must be registered in the app's navigator (Phase 13, Task 4). Verify this registration exists and passes the correct params.

---

## Task 4 — Add feature discovery hint (optional)

If the entity has no emoji actions configured (unlikely after auto-seeding, but possible if user deleted all), show a hint in the chat interface. This is optional and low priority:

**File:** `src/components/chat/ChatInput.tsx` or `ChatDetailScreen.tsx`

If `EntityEmojiActionService.countEmojiActions(entityId) === 0`, show a one-time tooltip or hint:
```
"💡 You can assign custom behaviors to emojis! Go to Entity Settings → Emoji Actions"
```

This is **optional** and can be deferred to a later iteration.

---

## Progress Checklist

- [ ] EntityConfigScreen has "Emoji Actions" menu item with icon and description
- [ ] Navigation to EmojiActionEditorScreen works from EntityConfigScreen
- [ ] Navigation to EmojiActionEditorScreen works from emoji picker "Advanced" button
- [ ] Pre-seeded defaults (20 actions) correctly seeded on first entity session
- [ ] Defaults are editable and deletable by the user
- [ ] "Reset to Defaults" restores all 20 original actions
- [ ] Custom actions appear alongside defaults in the editor
- [ ] In-memory cache properly invalidated after seeding
- [ ] All navigation routes registered and working
- [ ] No TypeScript errors
- [ ] (Optional) Feature discovery hint for entities with no actions

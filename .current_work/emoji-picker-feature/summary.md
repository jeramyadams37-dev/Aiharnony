# Emoji Picker & Emoji Actions — Implementation Plan

## Overview

Add a native emoji picker to the chat UI screen, allowing users to browse, search, and insert emojis into messages. Users can switch between **three bundled emoji base designs** (Native / System, Google Noto, Twemoji) via the Appearance & Theme settings screen. **Custom emoji sets render everywhere** — in the picker, in chat bubbles, and in the shortcode autocomplete.

**Emoji Actions** extend the emoji picker with per-entity behavioral mappings: users can assign emotion vectors, metabolism effects (placeholder), and substitution text to any emoji. When sent, the emoji is replaced by its substitution text (e.g., `🍔` → `*eats a burger hungrily*`) and the emotion effects are applied to the entity via the backend's `EmotionEngine`.

**Emoji Picker Approach:** Hybrid — `@emoji-mart/data` for emoji metadata and headless search, `emoji-datasource` sprite sheets for bundled images, fully custom native React Native UI built with the existing ThemedView/ThemedText system.

**Emoji Actions Approach:** Per-entity emoji→action mappings stored in SQLite, resolved client-side at send time. Effects sent as `additional_effects` on the `ENTITY_UTTERANCE` event. Backend applies them via the existing `EmotionEngine.SetEmotion()` API. Pre-seeded with ~20 default mappings (food, emotion, action emojis).

**Emoji text handling:** Supports both native Unicode characters (`😂`) and shortcodes (`:joy:`) in messages. Shortcode autocomplete popup appears when user types `:` in the text input. Chat bubbles render emojis using the selected emoji set (Noto/Twemoji sprite sheet images or native system glyphs).

**Emoji Sets (all bundled, all open-licensed):**

| Set | License | Source |
|-----|---------|--------|
| **Native (System)** | N/A | OS-provided Unicode rendering |
| **Google Noto** | Apache 2.0 / SIL OFL 1.1 | `emoji-datasource-google` sprite sheets |
| **Twemoji** | CC-BY 4.0 (graphics) / MIT (code) | `emoji-datasource-twitter` sprite sheets (via jdecked/twemoji fork) |

**Effect Aggregation Rule:** When multiple emojis with the same emotion effect are in one message, the result per emotion is: `clamp(sum, negCeiling, posCeiling)` where `posCeiling = max positive individual delta` and `negCeiling = min negative individual delta`. This prevents stacking beyond the strongest single emoji.

**Codebase mapping reference:** [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md) | [`.planning/codebase/ARCHITECTURE.md`](../../.planning/codebase/ARCHITECTURE.md)

---

## Phases

### Emoji Picker (Phases 1–9)

1. **Dependencies & Asset Setup** — Install npm packages, bundle sprite sheet assets, configure Metro.
2. **Emoji Data Service** — EmojiService with metadata, categories, search, shortcode parsing, Unicode emoji detection, sprite resolution, and lookup maps.
3. **Emoji Style Context** — EmojiContext with AsyncStorage persistence for emoji set, skin tone, and recent emojis.
4. **Emoji Picker UI — Core Grid & Categories** — Native picker with category tabs, emoji grid, modal wrapper, and EmojiText inline renderer for chat bubbles.
5. **Emoji Picker UI — Search & Skin Tones** — Search bar, skin tone selector, recent emoji tracking.
6. **ChatBubble Custom Emoji Rendering** — EmojiAwareText component, integration with FormattedRPText, shortcode→Unicode parsing, custom emoji set rendering in message bubbles.
7. **ChatInput Integration & Autocomplete** — Emoji toggle button, emoji insertion via ref, keyboard transitions, shortcode autocomplete popup (`:joy` → 😂).
8. **Settings Integration** — "Emoji Style" section in ThemeSettingsScreen with visual preview cards per emoji set.
9. **Attribution & Documentation** — Third-party attribution in README.md for CC-BY 4.0 (Twemoji) and Apache 2.0 (Noto).

### Emoji Actions (Phases 10–17)

10. **Client — Types & Database Schema** — EmojiAction types, Ekman8Emotion type, EmotionEffect/MetabolismVector interfaces, `entity_emoji_actions` table (migration 22).
11. **Client — EntityEmojiActionService** — CRUD repository, service singleton with in-memory cache, effect aggregation (`clamp(sum, negCeiling, posCeiling)`), message resolution, substitution text generation, pre-seeded defaults (~20 mappings).
12. **Backend — AdditionalEffects, Database Migration & Sync** — Add `AdditionalEffects` field to Go `Utterance` struct, parse in `CognitionModule.HandleEvent()`, apply via `EmotionEngine.SetEmotion()`. Create `entity_emoji_actions` table on backend (migration 022). Add full bi-directional sync support: model/sync types, CRUD repository, outgoing/incoming sync handlers, size estimates, entity cascade delete. Client-side sync pipeline registration and cache invalidation.
13. **Client — Action Editor UI** — Dedicated EmojiActionEditorScreen with FlatList of action cards, create/edit modal with emoji selector, emotion picker (Ekman8 chips), intensity slider, metabolism inputs, substitution text editor with auto-generate.
14. **Client — Custom EmojiActionInput** — Rich input component replacing TextInput in ChatInput. Dual-layer rendering: transparent editing layer + formatted display layer showing `🍔(*eats a burger*)` with italic/dim substitution preview.
15. **Client — Picker Integration** — Dot indicator on emojis with actions, long-press popup showing effect details, "Advanced Emoji Settings" button in picker header.
16. **Client — Send Pipeline Integration** — Resolve actions on send, substitute emojis with RP text, attach `additional_effects` to utterance, seed defaults on first entity session, wire ChatInput and EmojiPickerModal with entity context.
17. **Client — Defaults & Entity Settings Link** — "Emoji Actions" entry in EntityConfigScreen, verify default seeding lifecycle, complete navigation graph.

---

## Implementation Status

- [ ] **Phase 1: Dependencies & Asset Setup** ([1-1-DependenciesAndAssets.md](1-1-DependenciesAndAssets.md))
- [ ] **Phase 2: Emoji Data Service** ([2-1-EmojiDataService.md](2-1-EmojiDataService.md))
- [ ] **Phase 3: Emoji Style Context** ([3-1-EmojiStyleContext.md](3-1-EmojiStyleContext.md))
- [ ] **Phase 4: Emoji Picker UI — Core Grid & Categories** ([4-1-EmojiPickerCoreGrid.md](4-1-EmojiPickerCoreGrid.md))
- [ ] **Phase 5: Emoji Picker UI — Search & Skin Tones** ([5-1-EmojiPickerSearchAndSkin.md](5-1-EmojiPickerSearchAndSkin.md))
- [ ] **Phase 6: ChatBubble Custom Emoji Rendering** ([6-1-ChatBubbleCustomRendering.md](6-1-ChatBubbleCustomRendering.md))
- [ ] **Phase 7: ChatInput Integration & Autocomplete** ([7-1-ChatInputAndAutocomplete.md](7-1-ChatInputAndAutocomplete.md))
- [ ] **Phase 8: Settings Integration** ([8-1-SettingsIntegration.md](8-1-SettingsIntegration.md))
- [ ] **Phase 9: Attribution & Documentation** ([9-1-AttributionAndDocs.md](9-1-AttributionAndDocs.md))
- [ ] **Phase 10: Client — Types & Database Schema** ([10-1-TypesAndDatabase.md](10-1-TypesAndDatabase.md))
- [ ] **Phase 11: Client — EntityEmojiActionService** ([11-1-EntityEmojiActionService.md](11-1-EntityEmojiActionService.md))
- [ ] **Phase 12: Backend — AdditionalEffects Support** ([12-1-BackendAdditionalEffects.md](12-1-BackendAdditionalEffects.md))
- [ ] **Phase 13: Client — Action Editor UI** ([13-1-ActionEditorUI.md](13-1-ActionEditorUI.md))
- [ ] **Phase 14: Client — Custom EmojiActionInput** ([14-1-CustomEmojiActionInput.md](14-1-CustomEmojiActionInput.md))
- [ ] **Phase 15: Client — Picker Integration** ([15-1-PickerIntegration.md](15-1-PickerIntegration.md))
- [ ] **Phase 16: Client — Send Pipeline Integration** ([16-1-SendPipelineIntegration.md](16-1-SendPipelineIntegration.md))
- [ ] **Phase 17: Client — Defaults & Entity Settings Link** ([17-1-DefaultsAndEntitySettings.md](17-1-DefaultsAndEntitySettings.md))

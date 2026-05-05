# Phase 2: Emoji Data Service

## Objective

Create `EmojiService` — a singleton service that provides:
1. Emoji metadata, category groupings, and search (via `emoji-mart` headless)
2. Shortcode parsing (`:joy:` → `😂`) and reverse lookup (`😂` → emoji data)
3. Unicode emoji detection and text splitting (via `emoji-regex`)
4. Sprite sheet image resolution per active `EmojiSet`

## Codebase References

- [`src/services/`](../../src/services/) — existing service layer
- [`src/services/ChatPreferencesService.ts`](../../src/services/ChatPreferencesService.ts) — service pattern reference (module exports, AsyncStorage, logger)
- [`src/theme/types.ts`](../../src/theme/types.ts) — type definition pattern
- [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md) — naming conventions (PascalCase services, camelCase functions)

---

## Task 1 — Create emoji type definitions

**File:** `src/types/emoji.ts`

Define all types the service and UI components will work with:

```typescript
/**
 * Supported emoji image sets
 */
export type EmojiSet = 'native' | 'noto' | 'twemoji';

/**
 * A single emoji skin variant
 */
export interface EmojiSkin {
  unified: string;       // e.g., '1F600'
  native: string;        // e.g., '😀'
  x: number;             // sprite sheet column
  y: number;             // sprite sheet row
}

/**
 * A single emoji entry for the picker
 */
export interface EmojiEntry {
  id: string;            // emoji-mart id, e.g., 'grinning'
  name: string;          // display name, e.g., 'Grinning Face'
  native: string;        // Unicode character, e.g., '😀'
  unified: string;       // hex codepoint, e.g., '1F600'
  category: string;      // category id, e.g., 'people'
  keywords: string[];    // search keywords
  skins: EmojiSkin[];    // skin tone variants (index 0 = default)
  sheetX: number;        // sprite sheet column
  sheetY: number;        // sprite sheet row
}

/**
 * An emoji category for the picker tabs
 */
export interface EmojiCategory {
  id: string;            // e.g., 'people'
  name: string;          // e.g., 'Smileys & People'
  icon: string;          // representative emoji native character
  emojis: EmojiEntry[];  // emojis in this category
}

/**
 * A segment produced by splitting text on emojis.
 * Used by EmojiAwareText to render custom emoji images inline.
 */
export interface TextSegment {
  type: 'text' | 'emoji';
  value: string;           // for 'text': raw text; for 'emoji': the native emoji character
  emojiEntry?: EmojiEntry; // for 'emoji': resolved emoji data (undefined if not found in lookup)
}

/**
 * Emoji style preference persisted to AsyncStorage
 */
export interface EmojiStylePreference {
  set: EmojiSet;
  skinTone: number;      // 1-6, default 1
}
```

---

## Task 2 — Create EmojiService

**File:** `src/services/EmojiService.ts`

This service:
1. Loads emoji data from `@emoji-mart/data` on initialization
2. Transforms it into the `EmojiCategory[]` structure
3. Provides search via `emoji-mart`'s `SearchIndex`
4. Resolves sprite sheet image source based on active `EmojiSet`
5. Provides sprite sheet coordinate math for rendering individual emojis
6. Builds **reverse lookup maps**: `nativeToEmoji` (Unicode → EmojiEntry) and `shortcodeToNative` (shortcode name → native char)
7. Provides `parseShortcodes()` to convert `:shortcode:` patterns in text
8. Provides `splitTextOnEmojis()` to split text into text/emoji segments using `emoji-regex`
9. Provides `searchByShortcodePrefix()` for autocomplete suggestions

```typescript
import { init, SearchIndex } from 'emoji-mart';
import data from '@emoji-mart/data';
import emojiRegex from 'emoji-regex';
import { createLogger } from '../utils/logger';
import { EmojiSet, EmojiEntry, EmojiCategory, EmojiSkin, TextSegment } from '../types/emoji';

const log = createLogger('[EmojiService]');

// Sprite sheet image requires — adjust paths if using node_modules directly
const SPRITE_SHEETS: Record<Exclude<EmojiSet, 'native'>, any> = {
  noto: require('../../node_modules/emoji-datasource-google/img/google/sheets-clean/64.png'),
  twemoji: require('../../node_modules/emoji-datasource-twitter/img/twitter/sheets-clean/64.png'),
};

// OR if copied to src/assets:
// const SPRITE_SHEETS: Record<Exclude<EmojiSet, 'native'>, any> = {
//   noto: require('../assets/emoji/sheets/google-64.png'),
//   twemoji: require('../assets/emoji/sheets/twitter-64.png'),
// };

const SPRITE_SIZE = 64; // px — each emoji cell is 64x64
const SHEET_CELL = SPRITE_SIZE + 2; // 1px transparent border on each side

// Category display order with representative icons
const CATEGORY_META: Record<string, { name: string; icon: string }> = {
  frequent:   { name: 'Frequently Used', icon: '🕐' },
  people:     { name: 'Smileys & People', icon: '😀' },
  nature:     { name: 'Animals & Nature', icon: '🐻' },
  foods:      { name: 'Food & Drink',     icon: '🍔' },
  activity:   { name: 'Activities',       icon: '⚽' },
  places:     { name: 'Travel & Places',  icon: '🏠' },
  objects:    { name: 'Objects',          icon: '💡' },
  symbols:    { name: 'Symbols',          icon: '🔣' },
  flags:      { name: 'Flags',            icon: '🏴' },
};

class EmojiService {
  private initialized = false;
  private categories: EmojiCategory[] = [];
  private allEmojis: Map<string, EmojiEntry> = new Map();       // id → entry
  private nativeToEmoji: Map<string, EmojiEntry> = new Map();   // native char → entry
  private shortcodeToNative: Map<string, string> = new Map();   // "joy" → "😂"
  private emojiRegexInstance: RegExp = emojiRegex();

  /**
   * Initialize the service — loads emoji data and search index.
   * Call once at app startup.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize emoji-mart search index
      init({ data });

      // Transform emoji-mart data into our category structure
      this.categories = this.buildCategories(data);

      // Build flat lookup maps
      for (const cat of this.categories) {
        for (const emoji of cat.emojis) {
          this.allEmojis.set(emoji.id, emoji);

          // Reverse lookup: native character → EmojiEntry
          this.nativeToEmoji.set(emoji.native, emoji);

          // Shortcode lookup: id (shortcode name without colons) → native char
          this.shortcodeToNative.set(emoji.id, emoji.native);
        }
      }

      this.initialized = true;
      log.info(`Initialized with ${this.allEmojis.size} emojis, ${this.shortcodeToNative.size} shortcodes`);
    } catch (error) {
      log.error('Failed to initialize EmojiService:', error);
      throw error;
    }
  }

  /**
   * Get all emoji categories (excludes 'frequent' — that's handled separately)
   */
  getCategories(): EmojiCategory[] {
    return this.categories.filter(c => c.id !== 'frequent');
  }

  /**
   * Get a specific emoji by its id (shortcode name)
   */
  getEmoji(id: string): EmojiEntry | undefined {
    return this.allEmojis.get(id);
  }

  /**
   * Get an emoji by its native Unicode character.
   * Used for reverse lookup when rendering emojis in chat bubbles.
   */
  getEmojiByNative(nativeChar: string): EmojiEntry | undefined {
    return this.nativeToEmoji.get(nativeChar);
  }

  /**
   * Search emojis by keyword or shortcode. Returns matching EmojiEntry[].
   * Used by both the picker search bar and the autocomplete popup.
   */
  async search(query: string): Promise<EmojiEntry[]> {
    if (!query.trim()) return [];

    try {
      const results = await SearchIndex.search(query);
      const entries: EmojiEntry[] = [];

      for (const emoji of results) {
        const entry = this.allEmojis.get(emoji.id);
        if (entry) entries.push(entry);
      }

      return entries;
    } catch (error) {
      log.error('Emoji search failed:', error);
      return [];
    }
  }

  /**
   * Search by shortcode prefix (for autocomplete).
   * Returns emojis whose id starts with the prefix, sorted by relevance.
   * Limited to `limit` results (default 8).
   */
  searchByShortcodePrefix(prefix: string, limit = 8): EmojiEntry[] {
    if (!prefix.trim()) return [];
    const lower = prefix.toLowerCase();
    const results: EmojiEntry[] = [];

    for (const [id, entry] of this.allEmojis) {
      if (id.startsWith(lower) || entry.keywords.some(k => k.startsWith(lower))) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  /**
   * Parse :shortcode: patterns in text → native Unicode emoji characters.
   * Unknown shortcodes are left as-is (not stripped).
   * Always runs (regardless of emoji set) to normalize both user and AI messages.
   *
   * Example: "Hello :joy: world" → "Hello 😂 world"
   * Example: "Hello :xyzfoo: world" → "Hello :xyzfoo: world" (unknown, kept as-is)
   */
  parseShortcodes(text: string): string {
    return text.replace(/:([a-z0-9_+-]+):/gi, (match, name) => {
      const native = this.shortcodeToNative.get(name.toLowerCase());
      return native ?? match;
    });
  }

  /**
   * Split text into segments of plain text and emoji characters.
   * Used by EmojiAwareText to render custom emoji images inline.
   *
   * Uses `emoji-regex` which correctly handles:
   * - Basic emojis (single codepoint): 😀 U+1F600
   * - Emoji with skin tone modifiers: 👍🏻 U+1F44D U+1F3FB
   * - ZWJ sequences: 👨‍👩‍👧 U+1F468 U+200D U+1F469 U+200D U+1F467
   * - Flag sequences: 🇺🇸 U+1F1FA U+1F1F8
   * - Keycap sequences: #️⃣ U+0023 U+FE0F U+20E3
   *
   * Example: "Hello 😂 world 🙈!" →
   *   [{type:'text', value:'Hello '},
   *    {type:'emoji', value:'😂', emojiEntry:...},
   *    {type:'text', value:' world '},
   *    {type:'emoji', value:'🙈', emojiEntry:...},
   *    {type:'text', value:'!'}]
   */
  splitTextOnEmojis(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let lastIndex = 0;

    // Reset regex state (regex is stateful with /g flag)
    this.emojiRegexInstance.lastIndex = 0;

    let match;
    while ((match = this.emojiRegexInstance.exec(text)) !== null) {
      const emojiChar = match[0];
      const startIndex = match.index;

      // Add preceding text segment if any
      if (startIndex > lastIndex) {
        segments.push({
          type: 'text',
          value: text.slice(lastIndex, startIndex),
        });
      }

      // Add emoji segment with resolved entry (may be undefined if not in our data)
      const emojiEntry = this.nativeToEmoji.get(emojiChar);
      segments.push({
        type: 'emoji',
        value: emojiChar,
        emojiEntry,
      });

      lastIndex = startIndex + emojiChar.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        value: text.slice(lastIndex),
      });
    }

    return segments.length > 0 ? segments : [{ type: 'text', value: text }];
  }

  /**
   * Get the sprite sheet image source for a given EmojiSet.
   * Returns null for 'native' (uses system rendering).
   */
  getSpriteSheet(emojiSet: EmojiSet): any | null {
    if (emojiSet === 'native') return null;
    return SPRITE_SHEETS[emojiSet];
  }

  /**
   * Calculate the crop rectangle for an emoji on the sprite sheet.
   * Returns { x, y, width, height } for use with Image resolvedSource.
   */
  getSpriteCrop(sheetX: number, sheetY: number): { x: number; y: number; width: number; height: number } {
    return {
      x: sheetX * SHEET_CELL + 1,
      y: sheetY * SHEET_CELL + 1,
      width: SPRITE_SIZE,
      height: SPRITE_SIZE,
    };
  }

  /**
   * Transform emoji-mart data into our category structure
   */
  private buildCategories(data: any): EmojiCategory[] {
    const categories: EmojiCategory[] = [];

    // emoji-mart data has categories array and emojis map
    for (const cat of data.categories) {
      const meta = CATEGORY_META[cat.id];
      if (!meta) continue;

      const emojis: EmojiEntry[] = [];
      for (const emojiId of cat.emojis) {
        const raw = data.emojis[emojiId];
        if (!raw) continue;

        const skins: EmojiSkin[] = raw.skins?.map((s: any, i: number) => ({
          unified: s.unified || raw.unified,
          native: s.native || raw.native,
          x: s.x ?? raw.sheet_x ?? 0,
          y: s.y ?? raw.sheet_y ?? 0,
        })) ?? [];

        // Ensure at least one skin
        if (skins.length === 0) {
          skins.push({
            unified: raw.unified,
            native: raw.native,
            x: raw.sheet_x ?? 0,
            y: raw.sheet_y ?? 0,
          });
        }

        emojis.push({
          id: raw.id,
          name: raw.name,
          native: raw.native,
          unified: raw.unified,
          category: cat.id,
          keywords: raw.keywords ?? [],
          skins,
          sheetX: raw.sheet_x ?? 0,
          sheetY: raw.sheet_y ?? 0,
        });
      }

      if (emojis.length > 0) {
        categories.push({
          id: cat.id,
          name: meta.name,
          icon: meta.icon,
          emojis,
        });
      }
    }

    return categories;
  }
}

// Export singleton instance
export default new EmojiService();
```

**Key design decisions:**
- **Singleton pattern** — matches existing service pattern (SyncService, etc.)
- **`initialize()` called once** — will be called from `EmojiContext` provider on mount
- **`getSpriteCrop()`** — returns pixel coordinates for cropping individual emojis from the sprite sheet using RN Image `resolveAssetSource`
- **`getSpriteSheet()`** — returns the `require()`'d image for the active set, or `null` for native
- **`nativeToEmoji` map** — reverse lookup from Unicode character → EmojiEntry, built during init. Used by `splitTextOnEmojis()` and `EmojiAwareText`
- **`shortcodeToNative` map** — shortcode name (without colons) → native char. Used by `parseShortcodes()`
- **`emojiRegexInstance`** — compiled once, reused. Reset `lastIndex` before each use because the regex has the `/g` flag
- **`splitTextOnEmojis()`** — handles ZWJ sequences, skin tone modifiers, flags, and keycaps via the `emoji-regex` library
- **`parseShortcodes()`** — simple regex replacement, unknown shortcodes preserved as-is
- **`searchByShortcodePrefix()`** — linear scan of the map. For ~3,600 emojis this is fast enough. If performance becomes an issue, a trie structure could be used

---

## Task 3 — Create a sprite sheet rendering utility

**File:** `src/utils/emojiSprite.ts`

Helper to render a cropped emoji from a sprite sheet using React Native's Image component:

```typescript
import { Image, StyleSheet } from 'react-native';
import { ImageResolvedSource } from 'react-native';
import EmojiService from '../services/EmojiService';
import { EmojiSet, EmojiSkin } from '../types/emoji';

/**
 * Get resolved image source for a sprite sheet of a given EmojiSet.
 * Returns null for 'native' set.
 */
export function getSpriteSheetSource(emojiSet: EmojiSet): ImageResolvedSource | null {
  const sheet = EmojiService.getSpriteSheet(emojiSet);
  if (!sheet) return null;

  const resolved = Image.resolveAssetSource(sheet);
  return resolved;
}

/**
 * Get style object for cropping a specific emoji from the sprite sheet.
 * Uses overflow:hidden container + absolute positioning pattern.
 */
export function getEmojiCropStyle(sheetX: number, sheetY: number): {
  container: any;
  image: any;
} {
  const SPRITE_SIZE = 64;
  const SHEET_CELL = 66; // 64 + 2px border

  const cropX = sheetX * SHEET_CELL + 1;
  const cropY = sheetY * SHEET_CELL + 1;

  return {
    container: {
      width: SPRITE_SIZE,
      height: SPRITE_SIZE,
      overflow: 'hidden',
    },
    image: {
      position: 'absolute' as const,
      left: -cropX,
      top: -cropY,
      width: SPRITE_SIZE,  // will be overridden by actual sheet dimensions
      height: SPRITE_SIZE,
    },
  };
}

/**
 * Dimensions for emoji rendering at different sizes
 */
export function getEmojiDimensions(displaySize: number) {
  return {
    containerSize: displaySize,
    emojiSize: displaySize,
  };
}
```

---

## Progress Checklist

- [ ] `src/types/emoji.ts` created — includes `TextSegment` type for inline rendering
- [ ] `src/services/EmojiService.ts` created with singleton, categories, search, sprite resolution
- [ ] `nativeToEmoji` reverse lookup map built during initialization
- [ ] `shortcodeToNative` map built during initialization
- [ ] `parseShortcodes()` method converts `:joy:` → `😂` in text strings
- [ ] `splitTextOnEmojis()` method splits text into `TextSegment[]` using `emoji-regex`
- [ ] `searchByShortcodePrefix()` method returns autocomplete matches
- [ ] `src/utils/emojiSprite.ts` created with crop style helpers
- [ ] TypeScript compiles without errors
- [ ] Service can be imported and `initialize()` resolves successfully

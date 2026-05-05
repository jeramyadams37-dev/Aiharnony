# Phase 12: Backend — AdditionalEffects, Database Migration & Sync Integration

## Objective

1. Add `AdditionalEffects` field to the Go `Utterance` struct
2. Parse and apply emoji action effects in `CognitionModule.HandleEvent()`
3. Create the `entity_emoji_actions` table on the backend (migration 022)
4. Add sync support: backend → app and app → backend transfer of emoji action data

## Codebase References

### Backend (harmony-link-private)
- [`events/events.go`](../../harmony-link-private/events/events.go) — `Utterance` struct (lines 133-149)
- [`modules/cognition.go`](../../harmony-link-private/modules/cognition.go) — `CognitionModule.HandleEvent()` (lines 709-830)
- [`modules/cognition/base.go`](../../harmony-link-private/modules/cognition/base.go) — `EmotionEffect` struct (lines 240-243)
- [`emotion/emotion_engine.go`](../../harmony-link-private/emotion/emotion_engine.go) — `EmotionEngine.SetEmotion(em, delta)` (lines 192-218)
- [`emotion/ekman8.go`](../../harmony-link-private/emotion/ekman8.go) — `Ekman8Emotions` map, `Ekman8Names`
- [`database/migrations/`](../../harmony-link-private/database/migrations/) — SQL migration files (currently 000001–000021)
- [`database/sync_utils.go`](../../harmony-link-private/database/sync_utils.go) — `GetChangedEmotionStates()`, query patterns for sync
- [`eventserver/synchronization.go`](../../harmony-link-private/eventserver/synchronization.go) — sync send/apply handlers, `convertToSyncModel()` (line 1808), table list (line 575), incoming handler (line 1027)
- [`database/models/`](../../harmony-link-private/database/models/) — sync model pattern (e.g., `EmotionStateSync` with `ToSyncModel()`/`ToDBModel()`)
- [`database/repository/entities/emotion.go`](../../harmony-link-private/database/repository/entities/emotion.go) — `SaveEmotionState()` pattern

### Client (harmony-ai-app)
- [`src/database/sync.ts`](../../src/database/sync.ts) — `getChangedRecords()`, `applySyncRecord()`, `getPrimaryKeyField()`, `normalizeBooleanFields()`
- [`src/services/SyncService.ts`](../../src/services/SyncService.ts) — `sendLocalChangesSequentially()` table list (line 575), `applyBufferedSyncData()` (line 337)
- [`src/database/repositories/emoji_actions.ts`](../../src/database/repositories/emoji_actions.ts) — CRUD repository (Phase 11)

---

## Task 1 — Add AdditionalEffects to Utterance struct

**File:** `events/events.go`

Add new types and field after the existing `Utterance` struct:

```go
// Utterance contains pre-classified utterance data of an AI or human
type Utterance struct {
	MessageID     string  `json:"message_id,omitempty"`
	EntityId      string  `json:"entity_id,omitempty"`
	Type          string  `json:"type"`
	Content       string  `json:"content"`
	Audio         string  `json:"audio"`
	AudioFile     string  `json:"audio_file"`
	AudioType     string  `json:"audio_type"`
	AudioDuration float64 `json:"audio_duration,omitempty"`
	ImageData     string  `json:"image_data,omitempty"`
	ImageMimeType string  `json:"image_mime_type,omitempty"`

	// Recon tracking fields
	IsReconFollowUp bool   `json:"is_recon_followup,omitempty"`
	IsEdited        bool   `json:"is_edited,omitempty"`
	EditOfMessageID string `json:"edit_of_message_id,omitempty"`

	// Additional effects from client-side emoji actions
	AdditionalEffects *AdditionalEffects `json:"additional_effects,omitempty"`
}

// AdditionalEffects contains client-resolved effects to apply to the entity.
type AdditionalEffects struct {
	EmotionEffects []ClientEmotionEffect `json:"emotion_effects,omitempty"`
}

// ClientEmotionEffect represents a single emotion delta from an emoji action.
// Separate type from modules/cognition/base.go EmotionEffect to avoid import cycles.
type ClientEmotionEffect struct {
	Emotion string  `json:"emotion"` // lowercase Ekman8 name
	Delta   float64 `json:"delta"`   // signed intensity change
}
```

---

## Task 2 — Apply AdditionalEffects in CognitionModule.HandleEvent()

**File:** `modules/cognition.go`

After the message is stored in the database (after line 815: `err := db.CreateConversationMessage(ctx, msg)`) and before `UpdateCognitionOnUtterance` (line 823), insert:

```go
			// Apply additional effects from client emoji actions
			if utterance.AdditionalEffects != nil && len(utterance.AdditionalEffects.EmotionEffects) > 0 {
				c.logger.Infof("Applying %d additional emotion effects from emoji actions for entity %s",
					len(utterance.AdditionalEffects.EmotionEffects), c.entityId)

				if c.emotionEngine != nil {
					for _, effect := range utterance.AdditionalEffects.EmotionEffects {
						em, ok := emotion.Ekman8Emotions[effect.Emotion]
						if !ok {
							c.logger.Warnf("Unknown emotion '%s' in additional effects for entity %s", effect.Emotion, c.entityId)
							continue
						}

						c.logger.Infof("  -> additional effect: emotion=%s delta=%.2f", effect.Emotion, effect.Delta)
						c.emotionEngine.SetEmotion(em, effect.Delta)
						c.logger.Infof("Entity %s emotion %s updated by additional delta=%.2f", c.entityId, effect.Emotion, effect.Delta)
					}
				} else {
					c.logger.Warnf("No emotion engine available for entity %s, skipping additional effects", c.entityId)
				}
			}
```

---

## Task 3 — Create backend migration 022 for entity_emoji_actions

**File:** `database/migrations/000022_add_entity_emoji_actions.up.sql`

```sql
-- Per-entity emoji action mappings
CREATE TABLE IF NOT EXISTS entity_emoji_actions (
  id TEXT PRIMARY KEY NOT NULL,
  entity_id TEXT NOT NULL,
  emoji_native TEXT NOT NULL,
  emotion_effect TEXT,                -- JSON: {"emotion":"joy","delta":2.0} or NULL
  metabolism_vector TEXT,             -- JSON: {"type":"eat","item":"burger"} or NULL
  substitution_text TEXT,            -- User-written or auto-generated RP text
  auto_generated INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id),
  UNIQUE(entity_id, emoji_native)
);

CREATE INDEX idx_emoji_actions_entity_id ON entity_emoji_actions(entity_id);
```

**File:** `database/migrations/000022_add_entity_emoji_actions.down.sql`

```sql
DROP INDEX IF EXISTS idx_emoji_actions_entity_id;
DROP TABLE IF EXISTS entity_emoji_actions;
```

---

## Task 4 — Create backend model and sync types

**File:** `database/models/emoji_action.go`

```go
package models

import (
	"database/sql"
	"time"
)

// EntityEmojiAction represents a per-entity emoji→action mapping
type EntityEmojiAction struct {
	ID               string         `db:"id" json:"id"`
	EntityID         string         `db:"entity_id" json:"entity_id"`
	EmojiNative      string         `db:"emoji_native" json:"emoji_native"`
	EmotionEffect    sql.NullString `db:"emotion_effect" json:"emotion_effect"`
	MetabolismVector sql.NullString `db:"metabolism_vector" json:"metabolism_vector"`
	SubstitutionText sql.NullString `db:"substitution_text" json:"substitution_text"`
	AutoGenerated    bool           `db:"auto_generated" json:"auto_generated"`
	IsDefault        bool           `db:"is_default" json:"is_default"`
	DeletedAt        sql.NullTime   `db:"deleted_at" json:"deleted_at"`
	CreatedAt        time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time      `db:"updated_at" json:"updated_at"`
}

// EntityEmojiActionSync is the sync-safe version with pointer types for nullable fields
type EntityEmojiActionSync struct {
	ID               string     `json:"id"`
	EntityID         string     `json:"entity_id"`
	EmojiNative      string     `json:"emoji_native"`
	EmotionEffect    *string    `json:"emotion_effect,omitempty"`
	MetabolismVector *string    `json:"metabolism_vector,omitempty"`
	SubstitutionText *string    `json:"substitution_text,omitempty"`
	AutoGenerated    bool       `json:"auto_generated"`
	IsDefault        bool       `json:"is_default"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (e *EntityEmojiAction) ToSyncModel() *EntityEmojiActionSync {
	sync := &EntityEmojiActionSync{
		ID:            e.ID,
		EntityID:      e.EntityID,
		EmojiNative:   e.EmojiNative,
		AutoGenerated: e.AutoGenerated,
		IsDefault:     e.IsDefault,
		CreatedAt:     e.CreatedAt,
		UpdatedAt:     e.UpdatedAt,
	}
	if e.EmotionEffect.Valid {
		sync.EmotionEffect = &e.EmotionEffect.String
	}
	if e.MetabolismVector.Valid {
		sync.MetabolismVector = &e.MetabolismVector.String
	}
	if e.SubstitutionText.Valid {
		sync.SubstitutionText = &e.SubstitutionText.String
	}
	if e.DeletedAt.Valid {
		sync.DeletedAt = &e.DeletedAt.Time
	}
	return sync
}

func (sync *EntityEmojiActionSync) ToDBModel() *EntityEmojiAction {
	e := &EntityEmojiAction{
		ID:            sync.ID,
		EntityID:      sync.EntityID,
		EmojiNative:   sync.EmojiNative,
		AutoGenerated: sync.AutoGenerated,
		IsDefault:     sync.IsDefault,
		CreatedAt:     sync.CreatedAt,
		UpdatedAt:     sync.UpdatedAt,
	}
	if sync.EmotionEffect != nil {
		e.EmotionEffect = sql.NullString{String: *sync.EmotionEffect, Valid: true}
	}
	if sync.MetabolismVector != nil {
		e.MetabolismVector = sql.NullString{String: *sync.MetabolismVector, Valid: true}
	}
	if sync.SubstitutionText != nil {
		e.SubstitutionText = sql.NullString{String: *sync.SubstitutionText, Valid: true}
	}
	if sync.DeletedAt != nil {
		e.DeletedAt = sql.NullTime{Time: *sync.DeletedAt, Valid: true}
	}
	return e
}
```

---

## Task 5 — Create backend sync utils for entity_emoji_actions

**File:** `database/sync_utils_emoji_actions.go`

```go
package database

import (
	"database/sql"
	"time"

	"github.com/harmony-ai-solutions/harmony-link-private/database/models"
)

const queryGetChangedEmojiActions = `
	SELECT id, entity_id, emoji_native, emotion_effect, metabolism_vector,
	       substitution_text, auto_generated, is_default, deleted_at, created_at, updated_at
	FROM entity_emoji_actions
	WHERE CAST(strftime('%s', updated_at) AS INTEGER) > ?
	   OR CAST(strftime('%s', created_at) AS INTEGER) > ?
	   OR (deleted_at IS NOT NULL AND CAST(strftime('%s', deleted_at) AS INTEGER) > ?)`

// GetChangedEmojiActions retrieves entity_emoji_actions rows changed since sinceTimestamp.
func GetChangedEmojiActions(tx *sql.Tx, sinceTimestamp int64) ([]models.EntityEmojiAction, error) {
	rows, err := tx.Query(queryGetChangedEmojiActions, sinceTimestamp, sinceTimestamp, sinceTimestamp)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var actions []models.EntityEmojiAction
	for rows.Next() {
		var a models.EntityEmojiAction
		var autoGen, isDef int
		err := rows.Scan(
			&a.ID, &a.EntityID, &a.EmojiNative, &a.EmotionEffect, &a.MetabolismVector,
			&a.SubstitutionText, &autoGen, &isDef, &a.DeletedAt, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		a.AutoGenerated = autoGen == 1
		a.IsDefault = isDef == 1
		actions = append(actions, a)
	}
	return actions, rows.Err()
}
```

---

## Task 6 — Create backend CRUD repository

**File:** `database/repository/entities/emoji_action.go`

```go
package entities

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/harmony-ai-solutions/harmony-link-private/database/models"
)

func GetEmojiAction(tx *sql.Tx, id string) (*models.EntityEmojiAction, error) {
	var a models.EntityEmojiAction
	var autoGen, isDef int
	err := tx.QueryRow(
		`SELECT id, entity_id, emoji_native, emotion_effect, metabolism_vector,
		        substitution_text, auto_generated, is_default, deleted_at, created_at, updated_at
		 FROM entity_emoji_actions WHERE id = ?`, id,
	).Scan(&a.ID, &a.EntityID, &a.EmojiNative, &a.EmotionEffect, &a.MetabolismVector,
		&a.SubstitutionText, &autoGen, &isDef, &a.DeletedAt, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.AutoGenerated = autoGen == 1
	a.IsDefault = isDef == 1
	return &a, nil
}

func CreateEmojiAction(tx *sql.Tx, a *models.EntityEmojiAction) error {
	autoGen := 0
	if a.AutoGenerated { autoGen = 1 }
	isDef := 0
	if a.IsDefault { isDef = 1 }
	_, err := tx.Exec(
		`INSERT OR REPLACE INTO entity_emoji_actions
		 (id, entity_id, emoji_native, emotion_effect, metabolism_vector,
		  substitution_text, auto_generated, is_default, deleted_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.EntityID, a.EmojiNative, a.EmotionEffect, a.MetabolismVector,
		a.SubstitutionText, autoGen, isDef, a.DeletedAt, a.CreatedAt, a.UpdatedAt,
	)
	return err
}

func UpdateEmojiAction(tx *sql.Tx, a *models.EntityEmojiAction) error {
	autoGen := 0
	if a.AutoGenerated { autoGen = 1 }
	isDef := 0
	if a.IsDefault { isDef = 1 }
	_, err := tx.Exec(
		`UPDATE entity_emoji_actions SET
		  entity_id=?, emoji_native=?, emotion_effect=?, metabolism_vector=?,
		  substitution_text=?, auto_generated=?, is_default=?, deleted_at=?, updated_at=?
		 WHERE id=?`,
		a.EntityID, a.EmojiNative, a.EmotionEffect, a.MetabolismVector,
		a.SubstitutionText, autoGen, isDef, a.DeletedAt, a.UpdatedAt, a.ID,
	)
	return err
}

func DeleteEmojiAction(tx *sql.Tx, id string) error {
	_, err := tx.Exec(`DELETE FROM entity_emoji_actions WHERE id = ?`, id)
	return err
}

func SoftDeleteEmojiActionsByEntity(ctx context.Context, tx *sql.Tx, entityID string) error {
	_, err := tx.Exec(
		`UPDATE entity_emoji_actions SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		 WHERE entity_id = ? AND deleted_at IS NULL`, entityID)
	return err
}
```

---

## Task 7 — Add entity_emoji_actions to backend sync send pipeline

**File:** `eventserver/synchronization.go`

### 7a. Add to outgoing sync (after emotion_state, before memories)

After the emotion_state sync block (around line 864) and before memories (line 866), insert:

```go
		// 9b. EMOJI ACTIONS (after entities, FK dependency on entity_id)
		sessionLogger.Debug("Fetching emoji action changes")
		emojiActions, err := database.GetChangedEmojiActions(tx, lastSync)
		if err != nil {
			sessionLogger.Errorf("Failed to get changed emoji actions: %v", err)
			return err
		}
		sessionLogger.Infof("Found %d emoji actions to sync", len(emojiActions))
		for _, ea := range emojiActions {
			op := database.DetermineOperation(ea.CreatedAt, ea.UpdatedAt, ea.DeletedAt, lastSync)
			if err := h.sendSyncDataWithConfirmation(session, "entity_emoji_actions", op, ea); err != nil {
				return err
			}
		}
```

### 7b. Add to incoming sync handler (applyIncomingSyncRecord)

In the switch statement handling incoming records (around line 1075, after emotion_state), add:

```go
		case "entity_emoji_actions":
			var syncModel models.EntityEmojiActionSync
			if err := json.Unmarshal(payload.Record, &syncModel); err != nil {
				return fmt.Errorf("failed to unmarshal entity_emoji_actions record: %w", err)
			}
			m := syncModel.ToDBModel()
			existing, err := entities.GetEmojiAction(tx, m.ID)
			if payload.Operation == "delete" {
				if existing == nil {
					return nil
				}
				return entities.DeleteEmojiAction(tx, m.ID)
			}
			if err != nil || existing == nil || m.UpdatedAt.After(existing.UpdatedAt) {
				if existing == nil {
					return entities.CreateEmojiAction(tx, m)
				}
				return entities.UpdateEmojiAction(tx, m)
			}
```

### 7c. Add to convertToSyncModel

In the `convertToSyncModel()` function (line 1808), add a case:

```go
	case "entity_emoji_actions":
		if a, ok := record.(models.EntityEmojiAction); ok {
			return a.ToSyncModel()
		}
		if a, ok := record.(*models.EntityEmojiAction); ok {
			return a.ToSyncModel()
		}
```

### 7d. Add to size estimate

In the `sendSizeEstimate()` function (around line 1366), add:

```go
	estimate.TotalRecords += countChanges("entity_emoji_actions")
```

### 7e. Cascade delete on entity soft-delete

In `database/repository/entities/entities.go` `DeleteEntity()` function, add cascade soft-delete for emoji actions after the existing cascade for entity_module_mappings:

```go
	// Cascade soft-delete to entity_emoji_actions
	emojiActionQuery := "UPDATE entity_emoji_actions SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE entity_id = ? AND deleted_at IS NULL"
	_, err = tx.Exec(emojiActionQuery, id)
	if err != nil {
		return fmt.Errorf("failed to cascade soft-delete entity_emoji_actions: %w", err)
	}
```

---

## Task 8 — Add entity_emoji_actions to client sync pipeline

**File:** `src/services/SyncService.ts`

### 8a. Add to outgoing sync table list

In `sendLocalChangesSequentially()`, add `entity_emoji_actions` after `emotion_state` in the tables array (around line 605):

```typescript
const tables = [
  // ... existing tables ...
  'emotion_state',
  'entity_emoji_actions',  // NEW: emoji action mappings (after entities, FK on entity_id)
  'memories',
];
```

### 8b. Add to pkField detection

In `getPrimaryKeyField()` in `src/database/sync.ts`, no change needed — the table uses `id` as PK (default case).

### 8c. Add to NO_DELETED_AT_TABLES check (not needed)

`entity_emoji_actions` HAS a `deleted_at` column (unlike `emotion_state`), so no change to `NO_DELETED_AT_TABLES`.

### 8d. Add to applyBufferedSyncData incoming handler

**File:** `src/services/SyncService.ts`

In the `applyBufferedSyncData()` method's table routing switch (find where `emotion_state` is handled), add a case for `entity_emoji_actions`. This uses the generic `applySyncRecord()` from `sync.ts` which handles LWW automatically:

```typescript
case 'entity_emoji_actions':
  // Use generic LWW apply — no special handling needed
  await SyncHelpers.applySyncRecord(table, operation, record, tx);
  // Invalidate service cache for this entity
  EntityEmojiActionService.invalidateCache(record.entity_id);
  break;
```

### 8e. Add to boolean field normalization

**File:** `src/database/sync.ts`

In `normalizeBooleanFields()`, add the table:

```typescript
const booleanFields: Record<string, string[]> = {
  'character_image': ['is_primary'],
  'conversation_messages': ['is_recon_followup', 'is_edited'],
  'entity_emoji_actions': ['auto_generated', 'is_default'],  // NEW
};
```

### 8f. Register EntityEmojiActionService import

**File:** `src/services/SyncService.ts`

```typescript
import EntityEmojiActionService from './EntityEmojiActionService';
```

---

## Progress Checklist

- [ ] **Backend: Utterance struct**
  - [ ] `AdditionalEffects` and `ClientEmotionEffect` types added to `events/events.go`
  - [ ] `omitempty` ensures backward compatibility

- [ ] **Backend: Cognition handler**
  - [ ] Effects parsed and applied via `EmotionEngine.SetEmotion()` after message storage
  - [ ] Unknown emotions logged as warnings and skipped
  - [ ] Nil emotionEngine handled gracefully

- [ ] **Backend: Migration 022**
  - [ ] `000022_add_entity_emoji_actions.up.sql` created with matching schema to client
  - [ ] `000022_add_entity_emoji_actions.down.sql` created
  - [ ] Migration applies cleanly

- [ ] **Backend: Model & sync types**
  - [ ] `database/models/emoji_action.go` with `EntityEmojiAction`, `EntityEmojiActionSync`
  - [ ] `ToSyncModel()` and `ToDBModel()` conversion methods
  - [ ] Nullable fields use pointer types in sync model

- [ ] **Backend: Sync utils**
  - [ ] `database/sync_utils_emoji_actions.go` with `GetChangedEmojiActions()`
  - [ ] Query filters by created_at/updated_at/deleted_at

- [ ] **Backend: CRUD repository**
  - [ ] `database/repository/entities/emoji_action.go` with Get/Create/Update/Delete
  - [ ] `SoftDeleteEmojiActionsByEntity()` for entity cascade

- [ ] **Backend: Sync pipeline (synchronization.go)**
  - [ ] Outgoing: emoji actions sent after emotion_state
  - [ ] Incoming: emoji actions handled in apply switch
  - [ ] `convertToSyncModel()` includes emoji actions case
  - [ ] Size estimate includes emoji actions count
  - [ ] Entity soft-delete cascades to emoji actions

- [ ] **Client: Sync pipeline**
  - [ ] `SyncService.ts` table list includes `entity_emoji_actions`
  - [ ] Incoming handler applies records via generic LWW
  - [ ] Service cache invalidated on incoming sync records
  - [ ] Boolean fields normalized for `auto_generated` and `is_default`

- [ ] **Cross-cutting**
  - [ ] Backend schema matches client schema exactly (same column names, types, constraints)
  - [ ] Go code compiles without errors
  - [ ] TypeScript compiles without errors
  - [ ] Existing tests pass (all changes are additive, no modifications to existing behavior)
  - [ ] Backward compatible: utterances without `additional_effects` work as before

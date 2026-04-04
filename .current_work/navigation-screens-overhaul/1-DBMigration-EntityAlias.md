# Phase 1: DB Migration — Entity Alias Field

## Objective
Add an `alias` field to the `entities` table. This allows entities to have a human-readable display name independent of their UUID, defaulting to their linked character profile name when first created but overridable. The alias must be unique across the entity table.

## Background
Currently `Entity` has no `name` field — only a UUID `id` and an optional `character_profile_id`. In the new UI, users see entities as named chat partners. Without a display name, the UX falls back to showing UUIDs which is unacceptable.

## Files to Create
- `src/database/migrations/000018_add_entity_alias.ts`

## Files to Modify
- `src/database/models.ts` — add `alias` field to `Entity` interface
- `src/database/repositories/entities.ts` — update all CRUD to include alias; add alias uniqueness check; add `getEntityByAlias()`

---

## Implementation Steps

### Step 1: Create migration file

**File:** `src/database/migrations/000018_add_entity_alias.ts`

```typescript
export const migration_000018 = `
  ALTER TABLE entities ADD COLUMN alias TEXT;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_alias_unique
    ON entities (alias)
    WHERE alias IS NOT NULL AND deleted_at IS NULL;
`;

export const rollback_000018 = `
  DROP INDEX IF EXISTS idx_entities_alias_unique;
`;
```

> **Note on SQLite unique index:** SQLite supports partial indexes (WHERE clause), which ensures uniqueness only among non-deleted, non-null aliases. This handles soft-delete correctly.

Register this migration in `src/database/migrations.ts` (the existing migration runner) by adding `migration_000018` to the migrations array.

### Step 2: Update `Entity` interface in models

**File:** `src/database/models.ts`

```typescript
export interface Entity {
  id: string;
  alias: string | null;        // ADD THIS — human-readable display name
  character_profile_id: string | null;
  lifecycle_config: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
```

### Step 3: Update entities repository

**File:** `src/database/repositories/entities.ts`

Changes needed:

1. **`createEntity()`** — include `alias` in INSERT:
   ```typescript
   await tx.executeSql(
     `INSERT INTO entities (id, alias, character_profile_id, lifecycle_config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
     [entity.id, entity.alias ?? null, entity.character_profile_id, entity.lifecycle_config ?? null, now, now]
   );
   ```

2. **`getEntity()`** — include `alias` in SELECT (if using `SELECT *` this is automatic; verify):
   ```typescript
   return {
     id: row.id,
     alias: row.alias ?? null,   // ADD THIS
     character_profile_id: row.character_profile_id,
     lifecycle_config: row.lifecycle_config ?? null,
     created_at: new Date(row.created_at),
     updated_at: new Date(row.updated_at),
     deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
   };
   ```

3. **`getAllEntities()`** — ensure `alias` is mapped in results (same as above)

4. **Add `updateEntityAlias(id: string, alias: string): Promise<void>`:**
   ```typescript
   export async function updateEntityAlias(id: string, alias: string): Promise<void> {
     const db = getDatabase();
     // Check uniqueness first
     const [existing] = await db.executeSql(
       `SELECT id FROM entities WHERE alias = ? AND id != ? AND deleted_at IS NULL`,
       [alias, id]
     );
     if (existing.rows.length > 0) {
       throw new Error(`Entity alias "${alias}" is already in use.`);
     }
     const now = new Date().toISOString();
     await db.executeSql(
       `UPDATE entities SET alias = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
       [alias, now, id]
     );
   }
   ```

5. **Add `getEntityByAlias(alias: string): Promise<Entity | null>`:**
   ```typescript
   export async function getEntityByAlias(alias: string): Promise<Entity | null> {
     const db = getDatabase();
     const [results] = await db.executeSql(
       `SELECT * FROM entities WHERE alias = ? AND deleted_at IS NULL`,
       [alias]
     );
     if (results.rows.length === 0) return null;
     const row = results.rows.item(0);
     return mapRowToEntity(row); // extract mapping to shared helper
   }
   ```

### Step 4: Alias assignment logic (UI rule)

When creating an entity (via `CreateAIScreen` or `EntityConfigEditScreen`):
- If user provides a name → use as alias (validate uniqueness before save)
- If user doesn't provide a name but selects a character profile → use `profile.name` as alias
- If no profile selected → leave alias as null (entity appears as truncated UUID in lists)

This logic lives in the UI screen, not the repository.

---

## Progress Checklist

- [ ] Create `src/database/migrations/000018_add_entity_alias.ts`
- [ ] Register migration in `src/database/migrations.ts`
- [ ] Update `Entity` interface in `src/database/models.ts`
- [ ] Update `createEntity()` in `src/database/repositories/entities.ts`
- [ ] Update `getEntity()` row mapping to include `alias`
- [ ] Update `getAllEntities()` row mapping to include `alias`
- [ ] Add `updateEntityAlias()` to `src/database/repositories/entities.ts`
- [ ] Add `getEntityByAlias()` to `src/database/repositories/entities.ts`

# Phase 16: Client — Send Pipeline Integration

## Objective

Wire the emoji action system into the message sending pipeline:
1. When the user sends a message, resolve all emoji actions via `EntityEmojiActionService.resolveMessageActions()`
2. Replace the raw message text (with emojis) with the substituted text (with RP actions)
3. Attach `additional_effects` to the utterance payload sent to the backend
4. Seed default emoji actions when an entity starts its first chat session

This is the critical integration phase that connects all the pieces together.

## Codebase References

- [`src/screens/ChatDetailScreen.tsx`](../../src/screens/ChatDetailScreen.tsx) — `handleSendText()` (lines 411-430), `handleConfirmAndSendMessage()` (lines 468-520)
- [`src/services/EntitySessionService.ts`](../../src/services/EntitySessionService.ts) — `sendTextMessage()` (lines 428-474), `sendUtterance()` (lines 572-581)
- [`src/services/EntityEmojiActionService.ts`](../../src/services/EntityEmojiActionService.ts) — `resolveMessageActions()`, `seedDefaults()` (Phase 11)
- [`src/types/emoji.ts`](../../src/types/emoji.ts) — `AdditionalEffects`, `ResolvedMessageActions` (Phase 10)
- [`events/events.go`](../../../harmony-link-private/events/events.go) — backend `Utterance` struct with `AdditionalEffects` field (Phase 12)

---

## Task 1 — Modify EntitySessionService.sendTextMessage() to accept additional effects

**File:** `src/services/EntitySessionService.ts`

Add an optional `additionalEffects` parameter to `sendTextMessage()`:

```typescript
/**
 * Send text message to partner entity
 * @param partnerEntityId The entity to send to
 * @param text The message text (already substitution-resolved if emoji actions apply)
 * @param additionalEffects Optional pre-aggregated emoji action effects
 */
async sendTextMessage(
  partnerEntityId: string,
  text: string,
  additionalEffects?: any | null,  // AdditionalEffects type from emoji.ts
): Promise<void> {
  const dualSession = this.sessions.get(partnerEntityId);
  if (!dualSession || dualSession.partnerSession.status !== 'active') {
    throw new Error(`No active session for entity ${partnerEntityId}`);
  }

  // Generate UUID v7 for message ID (domain layer)
  const messageId = uuidv7();

  // Store message locally first (optimistic UI pattern)
  // Note: content stored is the SUBSTITUTED text (with RP actions replacing emojis)
  const message = {
    id: messageId,
    entity_id: dualSession.partnerEntityId,
    sender_entity_id: dualSession.impersonatedEntityId,
    session_id: dualSession.partnerSession.sessionId,
    content: text,
    audio_duration: null,
    message_type: 'text' as 'text',
    audio_data: null,
    audio_mime_type: null,
    image_data: null,
    image_mime_type: null,
    vl_model: null,
    vl_model_interpretation: null,
    emotional_state_bits: 0,
    memory_id: null,
    is_recon_followup: false,
    is_edited: false
  };

  await createConversationMessage(message);
  log.info(`Stored text message ${messageId} locally`);

  // Send to partner entity with message_id and optional effects
  const utterance: any = {
    message_id: messageId,
    entity_id: dualSession.impersonatedEntityId,
    content: text,
    type: 'UTTERANCE_COMBINED',
  };

  // Attach additional effects if present
  if (additionalEffects && (
    (additionalEffects.emotionEffects && additionalEffects.emotionEffects.length > 0)
  )) {
    utterance.additional_effects = additionalEffects;
    log.info(`Sending message ${messageId} with ${additionalEffects.emotionEffects.length} additional emotion effects`);
  }

  await this.sendUtterance(dualSession.partnerSession.connectionId, utterance);
  dualSession.partnerSession.lastActivity = Date.now();
}
```

**Key change:** The `content` field already contains the substituted text (resolved by ChatDetailScreen before calling this method). The `additional_effects` field carries the structured emotion data for the backend.

---

## Task 2 — Modify ChatDetailScreen.handleSendText() to resolve actions

**File:** `src/screens/ChatDetailScreen.tsx`

```typescript
// New import
import EntityEmojiActionService from '../services/EntityEmojiActionService';

// Updated handleSendText:
const handleSendText = useCallback(
  async (text: string) => {
    if (!text.trim() || !isDualSessionActive(partnerEntityId)) {
      log.warn('Cannot send message: session not active');
      return;
    }

    try {
      // Resolve emoji actions: substitute emojis with RP text + collect effects
      let sendText = text.trim();
      let additionalEffects = null;

      const resolved = await EntityEmojiActionService.resolveMessageActions(
        partnerEntityId,
        sendText,
      );

      if (resolved.hasActions) {
        sendText = resolved.substitutedText;
        additionalEffects = resolved.effects;
        log.info(`Resolved emoji actions: substituted ${text.trim().length} → ${sendText.length} chars, ${resolved.effects.emotionEffects.length} effects`);
      }

      await EntitySessionService.sendTextMessage(
        partnerEntityId,
        sendText,
        additionalEffects,
      );

      // Optimistically reload from database
      const updatedMessages = await getRecentConversationMessages(
        impersonatedEntityId,
        partnerEntityId,
        50,
      );
      // Always scroll to the message the user just sent
      pendingOwnMessageScroll.current = true;
      setMessages(updatedMessages);
    } catch (error: any) {
      // ... existing error handling (unchanged) ...
    }
  },
  [partnerEntityId, impersonatedEntityId, isDualSessionActive],
);
```

---

## Task 3 — Seed defaults on first entity session

**File:** `src/screens/ChatDetailScreen.tsx`

In the `useEffect` that handles session start, seed emoji action defaults for the entity if they haven't been seeded yet:

```typescript
// Add inside the session start useEffect (or a new useEffect):
useEffect(() => {
  if (partnerEntityId && isDualSessionActive(partnerEntityId)) {
    // Seed emoji action defaults for this entity (idempotent — skips if already seeded)
    EntityEmojiActionService.seedDefaults(partnerEntityId).catch(err => {
      log.warn('Failed to seed emoji action defaults:', err);
    });
  }
}, [partnerEntityId, isDualSessionActive]);
```

The `seedDefaults()` method is idempotent — it checks if actions already exist and skips if so. Only runs meaningfully on the first session for a new entity.

---

## Task 4 — Update EmojiPickerModal and ChatInput wiring in ChatDetailScreen

**File:** `src/screens/ChatDetailScreen.tsx`

Pass the necessary props to the emoji picker and chat input:

```typescript
// In the render, update EmojiPickerModal:
<EmojiPickerModal
  visible={showEmojiPicker}
  onClose={() => setShowEmojiPicker(false)}
  onEmojiSelected={handleEmojiSelected}
  entityId={partnerEntityId}
  onOpenActionEditor={() => {
    setShowEmojiPicker(false);
    navigation.navigate('EmojiActionEditor', {
      entityId: partnerEntityId,
      entityName: entityName, // or however the entity name is accessed
    });
  }}
/>

// In the render, update ChatInput:
<ChatInput
  onSendText={handleSendText}
  onSendAudio={handleSendAudio}
  onSendImage={handleSendImage}
  onTypingStart={handleTypingStart}
  disabled={!isDualSessionActive(partnerEntityId)}
  theme={theme}
  entityId={partnerEntityId}
/>
```

---

## Task 5 — Also handle emoji actions in audio message confirmation

**File:** `src/screens/ChatDetailScreen.tsx`

The `handleConfirmAndSendMessage()` method (lines 468-520) sends combined audio+text messages. It also builds an utterance. Apply the same action resolution:

```typescript
const handleConfirmAndSendMessage = useCallback(
  async (messageId: string, finalText: string) => {
    if (!isDualSessionActive(partnerEntityId)) {
      log.warn('Cannot send message: session not active');
      return;
    }

    try {
      const message = await getConversationMessage(messageId);
      if (!message || !message.audio_data) {
        throw new Error('Message not found or has no audio');
      }

      // Resolve emoji actions in the text
      let sendText = finalText;
      let additionalEffects = null;

      const resolved = await EntityEmojiActionService.resolveMessageActions(
        partnerEntityId,
        sendText,
      );

      if (resolved.hasActions) {
        sendText = resolved.substitutedText;
        additionalEffects = resolved.effects;
      }

      // Update message with final (substituted) text and change type to 'combined'
      const updates: any = { message_type: 'combined' };
      if (sendText !== message.content) {
        updates.content = sendText;
      }
      await updateConversationMessage(messageId, updates);

      const dualSession = EntitySessionService.getSession(partnerEntityId);
      if (dualSession) {
        const utterance: any = {
          entity_id: dualSession.impersonatedEntityId,
          content: sendText,
          type: 'UTTERANCE_COMBINED',
          audio: message.audio_data,
          audio_type: message.audio_mime_type || 'audio/wav',
          audio_duration: message.audio_duration || 0,
          message_id: messageId,
        };

        if (additionalEffects) {
          utterance.additional_effects = additionalEffects;
        }

        await EntitySessionService.sendUtterance(
          dualSession.partnerSession.connectionId,
          utterance,
        );

        // ... rest of existing code (unchanged) ...
      }
    } catch (error: any) {
      // ... existing error handling (unchanged) ...
    }
  },
  [partnerEntityId, isDualSessionActive],
);
```

---

## Progress Checklist

- [ ] `EntitySessionService.sendTextMessage()` accepts optional `additionalEffects` parameter
- [ ] Utterance payload includes `additional_effects` field when effects are present
- [ ] `ChatDetailScreen.handleSendText()` resolves emoji actions before sending
- [ ] Substituted text stored in conversation message (not raw emoji)
- [ ] Additional effects logged when attached to utterance
- [ ] Default actions seeded on first entity session (idempotent)
- [ ] `ChatInput` receives `entityId` prop
- [ ] `EmojiPickerModal` receives `entityId` and `onOpenActionEditor` props
- [ ] Audio message confirmation also resolves emoji actions
- [ ] Messages without emoji actions work exactly as before (no regression)
- [ ] End-to-end test: send 🍔 → backend receives "*eats a burger hungrily*" + effects
- [ ] End-to-end test: send regular text → no substitution, no effects
- [ ] TypeScript compiles without errors

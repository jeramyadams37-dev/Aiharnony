# Impersonation-First Chat View — Implementation Plan

## Overview

Redesign the chat impersonation flow so users select **who they are chatting as** (their entity/persona) at the top of the Chat List screen, rather than being interrupted by a modal each time they tap a chat partner.

**New UX:**
- A persistent **"Chatting as: [Persona]"** banner below the Appbar header shows the current entity
- Tapping the banner opens an `ImpersonationSelectorModal` to switch persona globally
- Chat list last-message previews reflect the currently selected persona's conversation history
- Tapping a chat navigates **directly** to `ChatDetailScreen` — no blocking modal

**Codebase mapping reference:** [`.planning/codebase/CONVENTIONS.md`](../../.planning/codebase/CONVENTIONS.md) | [`.planning/codebase/ARCHITECTURE.md`](../../.planning/codebase/ARCHITECTURE.md)

---

## Implementation Status

- [ ] **Phase 1: Service + Modal** ([1-ServiceAndModal.md](1-ServiceAndModal.md))
  - Extend `ChatPreferencesService` with global entity preference methods
  - Refactor `EntitySelectionModal` → `ImpersonationSelectorModal`
- [ ] **Phase 2: ChatListScreen Refactor** ([2-ChatListScreenRefactor.md](2-ChatListScreenRefactor.md))
  - Add global impersonated entity state + loading
  - Add `ImpersonationSelectorBanner` inline component
  - Refactor `loadChatList`, `handleChatPress`, `handleImpersonationSelect`
  - Remove old per-partner modal state/handlers
  - Update `InfoModal` text
- [ ] **Phase 3: Verification** ([3-Verification.md](3-Verification.md))
  - Confirm `ChatDetailScreen` and `AppNavigator` need no changes

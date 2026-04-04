# Phase 3: Verification

## Objective

Confirm that `ChatDetailScreen` and `AppNavigator` require **no code changes** and work correctly with the new impersonation-first flow.

## Codebase References
- [`src/screens/ChatDetailScreen.tsx`](../../src/screens/ChatDetailScreen.tsx)
- [`src/navigation/AppNavigator.tsx`](../../src/navigation/AppNavigator.tsx)

---

## `ChatDetailScreen` — No changes required

`ChatDetailScreen` already receives `impersonatedEntityId` as a route parameter and uses it throughout:

- Route params destructuring: `const { partnerEntityId, partnerCharacterId, impersonatedEntityId } = route.params;`
- Session lifecycle: `startDualSession(partnerEntityId, impersonatedEntityId)`
- Message loading: `getRecentConversationMessages(impersonatedEntityId, partnerEntityId, 50)`
- Message ownership: `item.sender_entity_id === impersonatedEntityId`
- All send/edit/delete/regenerate handlers close over `impersonatedEntityId`

The only thing that changes is **how** `impersonatedEntityId` is determined before navigation — that is now done in `ChatListScreen` using the global preference, rather than via the `EntitySelectionModal`. `ChatDetailScreen` is unaffected.

## `AppNavigator` — No changes required

The `ChatDetail` route param type already includes `impersonatedEntityId`:

```typescript
ChatDetail: { partnerEntityId: string; partnerCharacterId?: string; impersonatedEntityId: string };
```

No type changes or new routes are needed.

---

## Verification Checklist

- [ ] Read through `ChatDetailScreen` to confirm all `impersonatedEntityId` usages are route-param driven (not locally resolved)
- [ ] Confirm `AppNavigator` `ChatDetail` param type already satisfies `impersonatedEntityId: string`
- [ ] Confirm no other screen or component imports `EntitySelectionModal` directly (search codebase for `EntitySelectionModal` after Phase 1 rename — only `ChatListScreen` should reference it, now updated)
- [ ] Manual smoke test: open Chat List → banner shows entity → tap banner → select different entity → list refreshes → tap chat → ChatDetail opens with correct persona

# Service Actions Menu Design

**Date:** 2026-02-22
**Status:** Approved

## Background

The service detail page (`/dashboard/[serviceId]`) currently has a `DeleteServiceButton` component using a `MoreVertical` icon that directly opens a delete confirmation dialog. The icon is semantically misleading (implies "more options" but only does delete) and provides poor discoverability. There is also no way to rename a connected service after it has been created.

## Goal

Replace the existing `DeleteServiceButton` with a `ServiceActionsMenu` — a dropdown menu triggered by the `MoreVertical` icon — containing two actions:

1. **Rename** — edit the service's display label
2. **Delete service** — remove the service and all associated data

## Approach

**Method:** Approach A — Add a reusable `DropdownMenu` UI component using the already-installed `radix-ui` package, then build `ServiceActionsMenu` on top of it.

## Data Layer

### `PATCH /api/services/[id]`

Added to the existing `src/app/api/services/[id]/route.ts`.

- **Request body:** `{ "label": "new name" }`
- **Validation:** `label` must be a non-empty string, max 100 characters
- **Auth:** verifies `user_id = auth.uid()` to prevent cross-user edits
- **Success:** `200 { id, label }`
- **Errors:** `400` (empty label) · `401` (unauthenticated) · `500` (DB error)

Existing `DELETE` handler is unchanged.

## UI Components

### `src/components/ui/dropdown-menu.tsx` (new)

Built following the same pattern as `dialog.tsx` — thin wrappers around Radix UI primitives imported from the `radix-ui` unified package. Exports:

- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`
- `DropdownMenuItem`, `DropdownMenuSeparator`

### `src/app/(app)/dashboard/[serviceId]/service-actions-menu.tsx` (replaces `delete-service-button.tsx`)

Props: `serviceId: string`, `currentLabel: string`

```
[ MoreVertical button ]
        ↓ click
┌─────────────────┐
│ ✏️  Rename        │
│ ─────────────── │
│ 🗑️  Delete service │  ← red text
└─────────────────┘
```

- **Rename** → opens a Dialog with an Input pre-filled with `currentLabel`; on submit calls `PATCH /api/services/{id}`; on success calls `router.refresh()`
- **Delete service** → opens existing delete confirmation Dialog; on confirm calls `DELETE /api/services/{id}`; on success calls `router.push('/dashboard')`

### `page.tsx` change

Replace:
```tsx
<DeleteServiceButton serviceId={serviceId} />
```
With:
```tsx
<ServiceActionsMenu serviceId={serviceId} currentLabel={serviceName} />
```

## Testing

### `__tests__/service-actions-menu.test.tsx` (replaces `delete-service-button.test.tsx`)

- Renders the MoreVertical trigger button
- Opens dropdown showing "Rename" and "Delete service" items
- Clicking "Rename" opens rename Dialog with input pre-filled with `currentLabel`
- Submitting rename calls `PATCH /api/services/{id}`, success triggers `router.refresh()`
- Clicking "Delete service" opens delete confirmation Dialog
- Confirming delete calls `DELETE /api/services/{id}`, success triggers `router.push('/dashboard')`

### `src/app/api/services/[id]/__tests__/route.test.ts` (new)

- `PATCH` with valid label → 200 with updated label
- `PATCH` with empty label → 400
- `PATCH` unauthenticated → 401
- `DELETE` success → 204 (coverage for existing logic)

## Files Changed

| File | Action |
|------|--------|
| `src/components/ui/dropdown-menu.tsx` | Create |
| `src/app/(app)/dashboard/[serviceId]/service-actions-menu.tsx` | Create (replaces delete-service-button.tsx) |
| `src/app/(app)/dashboard/[serviceId]/__tests__/service-actions-menu.test.tsx` | Create (replaces delete-service-button.test.tsx) |
| `src/app/(app)/dashboard/[serviceId]/delete-service-button.tsx` | Delete |
| `src/app/(app)/dashboard/[serviceId]/__tests__/delete-service-button.test.tsx` | Delete |
| `src/app/(app)/dashboard/[serviceId]/page.tsx` | Update import + usage |
| `src/app/api/services/[id]/route.ts` | Add PATCH handler |
| `src/app/api/services/[id]/__tests__/route.test.ts` | Create |

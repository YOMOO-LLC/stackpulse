# Service Actions Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `DeleteServiceButton` with a `ServiceActionsMenu` dropdown that offers Rename and Delete actions on the service detail page.

**Architecture:** Add `PATCH /api/services/[id]` for renaming; create a reusable `DropdownMenu` UI component following the existing `dialog.tsx` pattern (thin Radix UI wrappers from the already-installed `radix-ui` package); replace `delete-service-button.tsx` with `service-actions-menu.tsx` containing the dropdown trigger + two Dialogs (one for rename, one for delete confirmation).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Vitest + @testing-library/react, `radix-ui` v1.4.3 (already installed), Tailwind CSS v4, Supabase

---

### Task 1: Add PointerEvent polyfill to test setup

Radix UI's `DropdownMenu` primitive listens to `pointerdown` events, which jsdom doesn't fully implement. This one-time polyfill lets the existing test environment work with DropdownMenu without any other changes.

**Files:**
- Modify: `src/test/setup.ts`

**Step 1: Append the polyfill to `src/test/setup.ts`**

The final file should look like:

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// Polyfill for Radix UI DropdownMenu in jsdom
class MockPointerEvent extends MouseEvent {
  pointerId: number
  pointerType: string
  constructor(type: string, init?: MouseEventInit & { pointerId?: number; pointerType?: string }) {
    super(type, init)
    this.pointerId = init?.pointerId ?? 0
    this.pointerType = init?.pointerType ?? 'mouse'
  }
}
// @ts-expect-error jsdom override
window.PointerEvent = MockPointerEvent
Object.assign(window.HTMLElement.prototype, {
  hasPointerCapture: vi.fn(),
  setPointerCapture: vi.fn(),
  releasePointerCapture: vi.fn(),
})
```

Note: `vi` is globally available — no import needed because `globals: true` is set in `vitest.config.ts`.

**Step 2: Run full test suite to confirm no regressions**

```bash
npx vitest run
```
Expected: all existing tests PASS.

**Step 3: Commit**

```bash
git add src/test/setup.ts
git commit -m "test: add PointerEvent polyfill for Radix UI DropdownMenu in jsdom"
```

---

### Task 2: Add PATCH endpoint to `/api/services/[id]/route.ts`

**Files:**
- Modify: `src/app/api/services/[id]/route.ts`
- Create: `src/app/api/services/[id]/__tests__/route.test.ts`

**Step 1: Write the failing tests**

Create `src/app/api/services/[id]/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/qstash', () => ({
  unregisterServiceSchedule: vi.fn().mockResolvedValue(undefined),
}))

import { createClient } from '@/lib/supabase/server'
import { PATCH, DELETE } from '../route'

const MOCK_USER = { id: 'user-1' }

function makeParams(id: string) {
  return Promise.resolve({ id })
}

function makePatchClient(result: { data: unknown; error: null | { message: string } }) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  }
}

function makeDeleteClient() {
  const selectResult = { data: { qstash_schedule_id: null }, error: null }
  const deleteResult = { error: null }
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(selectResult),
  }
  const deleteChain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (v: typeof deleteResult) => void) => resolve(deleteResult)),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn()
      .mockReturnValueOnce(selectChain)   // first call: select qstash_schedule_id
      .mockReturnValueOnce(deleteChain),  // second call: delete
  }
}

function makePatchReq(body: object) {
  return new Request('http://localhost/api/services/svc-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/services/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    const client = makePatchClient({ data: null, error: null })
    client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(client as never)
    const res = await PATCH(makePatchReq({ label: 'New Name' }) as never, { params: makeParams('svc-1') })
    expect(res.status).toBe(401)
  })

  it('returns 400 when label is empty string', async () => {
    vi.mocked(createClient).mockResolvedValue(makePatchClient({ data: null, error: null }) as never)
    const res = await PATCH(makePatchReq({ label: '   ' }) as never, { params: makeParams('svc-1') })
    expect(res.status).toBe(400)
  })

  it('returns 400 when label is missing', async () => {
    vi.mocked(createClient).mockResolvedValue(makePatchClient({ data: null, error: null }) as never)
    const res = await PATCH(makePatchReq({}) as never, { params: makeParams('svc-1') })
    expect(res.status).toBe(400)
  })

  it('returns 200 with updated service on success', async () => {
    const updated = { id: 'svc-1', label: 'New Name' }
    vi.mocked(createClient).mockResolvedValue(makePatchClient({ data: updated, error: null }) as never)
    const res = await PATCH(makePatchReq({ label: 'New Name' }) as never, { params: makeParams('svc-1') })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.label).toBe('New Name')
  })
})

describe('DELETE /api/services/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    const client = makeDeleteClient()
    client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(client as never)
    const res = await DELETE(
      new Request('http://localhost/api/services/svc-1') as never,
      { params: makeParams('svc-1') }
    )
    expect(res.status).toBe(401)
  })

  it('returns 204 on successful delete', async () => {
    vi.mocked(createClient).mockResolvedValue(makeDeleteClient() as never)
    const res = await DELETE(
      new Request('http://localhost/api/services/svc-1') as never,
      { params: makeParams('svc-1') }
    )
    expect(res.status).toBe(204)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/services/\\[id\\]/__tests__/route.test.ts
```
Expected: FAIL — `PATCH is not a function` (handler doesn't exist yet).

**Step 3: Add PATCH handler to `src/app/api/services/[id]/route.ts`**

Append this function to the existing file (after the existing imports, before or after the `DELETE` function):

```ts
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  if (!label) {
    return NextResponse.json({ error: 'label required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('connected_services')
    .update({ label })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, label')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/services/\\[id\\]/__tests__/route.test.ts
```
Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add src/app/api/services/\\[id\\]/route.ts \
        src/app/api/services/\\[id\\]/__tests__/route.test.ts
git commit -m "feat(api): add PATCH /api/services/[id] for label rename"
```

---

### Task 3: Create `DropdownMenu` UI component

This is a thin Radix UI wrapper — no business logic to test. Correctness is exercised through `ServiceActionsMenu` tests in Task 4.

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`

**Step 1: Create the file**

```tsx
"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md",
          "bg-card text-foreground",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "focus:bg-muted focus:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[variant=destructive]:text-red-500 data-[variant=destructive]:focus:bg-red-500/10",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
```

**Step 2: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "feat(ui): add DropdownMenu component (Radix UI wrapper)"
```

---

### Task 4: Create `ServiceActionsMenu` (replaces `delete-service-button.tsx`)

**Files:**
- Create: `src/app/(app)/dashboard/[serviceId]/service-actions-menu.tsx`
- Create: `src/app/(app)/dashboard/[serviceId]/__tests__/service-actions-menu.test.tsx`

**Step 1: Write the failing tests**

Create `src/app/(app)/dashboard/[serviceId]/__tests__/service-actions-menu.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ServiceActionsMenu } from '../service-actions-menu'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

global.fetch = vi.fn()

describe('ServiceActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the trigger button', () => {
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('opens dropdown with Rename and Delete service items on trigger click', async () => {
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    const trigger = screen.getByRole('button')
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => {
      expect(screen.getByText('Rename')).toBeTruthy()
      expect(screen.getByText('Delete service')).toBeTruthy()
    })
  })

  it('opens rename dialog pre-filled with currentLabel', async () => {
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Rename'))
    fireEvent.click(screen.getByText('Rename'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
      const input = screen.getByRole('textbox')
      expect((input as HTMLInputElement).value).toBe('My Service')
    })
  })

  it('calls PATCH on rename submit and refreshes router', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'svc-1', label: 'New Name' }),
    } as Response)
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Rename'))
    fireEvent.click(screen.getByText('Rename'))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/services/svc-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'New Name' }),
      })
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('opens delete confirmation dialog on Delete service click', async () => {
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Delete service'))
    fireEvent.click(screen.getByText('Delete service'))
    await waitFor(() => {
      expect(screen.getByText('Delete service?')).toBeTruthy()
    })
  })

  it('calls DELETE and navigates to /dashboard on delete confirm', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true } as Response)
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Delete service'))
    fireEvent.click(screen.getByText('Delete service'))
    await waitFor(() => screen.getByText('Delete service?'))
    fireEvent.click(screen.getByRole('button', { name: /delete service/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/services/svc-1', { method: 'DELETE' })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run "src/app/\(app\)/dashboard/\[serviceId\]/__tests__/service-actions-menu.test.tsx"
```
Expected: FAIL — `Cannot find module '../service-actions-menu'`.

**Step 3: Create `service-actions-menu.tsx`**

Create `src/app/(app)/dashboard/[serviceId]/service-actions-menu.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ServiceActionsMenuProps {
  serviceId: string
  currentLabel: string
}

export function ServiceActionsMenu({ serviceId, currentLabel }: ServiceActionsMenuProps) {
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(currentLabel)
  const [renameLoading, setRenameLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleRename() {
    setRenameLoading(true)
    await fetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: renameValue }),
    })
    setRenameLoading(false)
    setRenameOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    setDeleteLoading(true)
    await fetch(`/api/services/${serviceId}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setRenameValue(currentLabel)
              setRenameOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete service
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename service</DialogTitle>
            <DialogDescription>
              Enter a new display name for this service.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="service-label">Name</Label>
            <Input
              id="service-label"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !renameLoading && renameValue.trim()) {
                  handleRename()
                }
              }}
              disabled={renameLoading}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renameLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={renameLoading || !renameValue.trim()}
            >
              {renameLoading ? 'Saving\u2026' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete service?</DialogTitle>
            <DialogDescription>
              This will remove the service and all its metrics history and alert rules. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting\u2026' : 'Delete service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run "src/app/\(app\)/dashboard/\[serviceId\]/__tests__/service-actions-menu.test.tsx"
```
Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/[serviceId]/service-actions-menu.tsx" \
        "src/app/(app)/dashboard/[serviceId]/__tests__/service-actions-menu.test.tsx"
git commit -m "feat(dashboard): add ServiceActionsMenu with rename and delete dropdown"
```

---

### Task 5: Wire up in `page.tsx` and remove old files

**Files:**
- Modify: `src/app/(app)/dashboard/[serviceId]/page.tsx`
- Delete: `src/app/(app)/dashboard/[serviceId]/delete-service-button.tsx`
- Delete: `src/app/(app)/dashboard/[serviceId]/__tests__/delete-service-button.test.tsx`

**Step 1: Update import in `page.tsx`**

In `src/app/(app)/dashboard/[serviceId]/page.tsx`, replace:

```tsx
import { DeleteServiceButton } from './delete-service-button'
```

With:

```tsx
import { ServiceActionsMenu } from './service-actions-menu'
```

**Step 2: Update usage in `page.tsx`**

Replace:

```tsx
<DeleteServiceButton serviceId={serviceId} />
```

With:

```tsx
<ServiceActionsMenu serviceId={serviceId} currentLabel={serviceName} />
```

**Step 3: Delete old files**

```bash
rm "src/app/(app)/dashboard/[serviceId]/delete-service-button.tsx"
rm "src/app/(app)/dashboard/[serviceId]/__tests__/delete-service-button.test.tsx"
```

**Step 4: Run full test suite**

```bash
npx vitest run
```
Expected: all tests PASS (no references to deleted files remain).

**Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/[serviceId]/page.tsx"
git rm "src/app/(app)/dashboard/[serviceId]/delete-service-button.tsx"
git rm "src/app/(app)/dashboard/[serviceId]/__tests__/delete-service-button.test.tsx"
git commit -m "feat(dashboard): wire up ServiceActionsMenu, remove DeleteServiceButton"
```

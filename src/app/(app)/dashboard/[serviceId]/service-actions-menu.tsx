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
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleRename() {
    setRenameLoading(true)
    setRenameError(null)
    try {
      const res = await fetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: renameValue }),
      })
      if (!res.ok) throw new Error('Failed to rename')
      setRenameOpen(false)
      router.refresh()
    } catch {
      setRenameError('Something went wrong. Please try again.')
    } finally {
      setRenameLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/services/${serviceId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      router.push('/dashboard')
    } catch {
      setDeleteError('Something went wrong. Please try again.')
      setDeleteLoading(false)
    }
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
      <Dialog open={renameOpen} onOpenChange={(open) => { setRenameOpen(open); if (!open) setRenameError(null) }}>
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
          {renameError && (
            <p className="text-xs text-red-500 mt-1">{renameError}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteError(null) }}>
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
          {deleteError && (
            <p className="text-xs text-red-500 mt-1">{deleteError}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Format service usage as "count/max" or just "count" if unlimited */
export function formatUsage(count: number, max: number): string {
  if (!isFinite(max)) return `${count}`
  return `${count}/${max}`
}

/** Check if the user is at or over their service limit */
export function isAtLimit(count: number, max: number): boolean {
  if (!isFinite(max)) return false
  return count >= max
}

/** Determine the label, href, and style for the "Add Service" button */
export function getAddServiceAction(
  count: number,
  max: number,
): { label: string; href: string; isUpgrade: boolean } {
  if (isAtLimit(count, max)) {
    return { label: 'Upgrade to Add More', href: '/dashboard/billing', isUpgrade: true }
  }
  return { label: 'Add Service', href: '/connect', isUpgrade: false }
}

import type { LucideIcon } from 'lucide-react'
import { Bell, BookCopy, FolderOpen, Palette, ScrollText, SquareTerminal } from 'lucide-react'

export type ManageSection =
  | 'repos'
  | 'profiles'
  | 'mandates'
  | 'playbooks'
  | 'notifications'
  | 'appearance'

export const MANAGE_SECTIONS: Array<{
  id: ManageSection
  label: string
  icon: LucideIcon
}> = [
  { id: 'repos', label: 'repos', icon: FolderOpen },
  { id: 'profiles', label: 'profiles', icon: SquareTerminal },
  { id: 'mandates', label: 'mandates', icon: ScrollText },
  { id: 'playbooks', label: 'playbooks', icon: BookCopy },
  { id: 'notifications', label: 'notifications', icon: Bell },
  { id: 'appearance', label: 'appearance', icon: Palette },
]

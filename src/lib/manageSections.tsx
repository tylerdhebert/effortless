import type { LucideIcon } from 'lucide-react'
import { Bell, FolderOpen, Palette, ScrollText, SquareTerminal } from 'lucide-react'

export type ManageSection =
  | 'repos'
  | 'profiles'
  | 'instructions'
  | 'notifications'
  | 'appearance'

export const MANAGE_SECTIONS: Array<{
  id: ManageSection
  label: string
  icon: LucideIcon
}> = [
  { id: 'repos', label: 'repos', icon: FolderOpen },
  { id: 'profiles', label: 'profiles', icon: SquareTerminal },
  { id: 'instructions', label: 'instructions', icon: ScrollText },
  { id: 'notifications', label: 'notifications', icon: Bell },
  { id: 'appearance', label: 'appearance', icon: Palette },
]

export type ThemeId = 'dark' | 'light'

export type ThemePalette = Record<string, string>

export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  // pure dark
  dark: {
    '--body-bg': '#0a0a0a',
    '--body-text': '#e8e8e8',
    '--main': '#0d0d0d',
    '--sidebar': '#080808',
    '--surface': '#141414',
    '--panel': '#1a1a1a',
    '--field': '#0a0a0a',
    '--button': '#171717',
    '--line': '#2a2a2a',
    '--line-strong': '#3a3a3a',
    '--text': '#d0d0d0',
    '--text-strong': '#f0f0f0',
    '--muted': '#808080',
    '--accent': '#a0a0a0',
    '--live': '#77d89c',
    '--ok': '#6bc48a',
    '--danger': '#f38a8a',
    '--placeholder': '#505050',
    '--focus-shadow': 'rgba(160, 160, 160, 0.18)',
    '--diff-insert-bg': 'rgba(46, 160, 67, 0.2)',
    '--diff-delete-bg': 'rgba(248, 81, 73, 0.2)',
    '--diff-gutter-insert-bg': 'rgba(46, 160, 67, 0.7)',
    '--diff-gutter-delete-bg': 'rgba(248, 81, 73, 0.7)',
    '--diff-text-color': '#d0d0d0',
    '--diff-gutter-insert-bg-solid': '#1a3a22',
    '--diff-gutter-insert-text': '#77d89c',
    '--diff-gutter-delete-bg-solid': '#3a1a1a',
    '--diff-gutter-delete-text': '#f38a8a',
    '--diff-code-insert-bg': '#122210',
    '--diff-code-delete-bg': '#221010',
    '--diff-code-insert-edit-bg': '#1e4a24',
    '--diff-code-delete-edit-bg': '#4a1e1e',
    '--diff-code-selected-bg': 'rgba(160, 160, 160, 0.12)',
    '--diff-omit-gutter-line': '#606060',
  },

  // light
  light: {
    '--body-bg': '#edf1f6',
    '--body-text': '#172033',
    '--main': '#e3e8f0',
    '--sidebar': '#dce2eb',
    '--surface': '#f0f3f7',
    '--panel': '#ffffff',
    '--field': '#ffffff',
    '--button': '#e8ecf2',
    '--line': '#c8d0db',
    '--line-strong': '#9aa8b8',
    '--text': '#172033',
    '--text-strong': '#0d1117',
    '--muted': '#5c6e86',
    '--accent': '#6366f1',
    '--live': '#2f8f5b',
    '--ok': '#267a4d',
    '--danger': '#c85b61',
    '--placeholder': '#91a0b6',
    '--focus-shadow': 'rgba(99, 102, 241, 0.18)',
    '--diff-insert-bg': 'rgba(47, 143, 91, 0.13)',
    '--diff-delete-bg': 'rgba(200, 91, 97, 0.14)',
    '--diff-gutter-insert-bg': 'rgba(47, 143, 91, 0.6)',
    '--diff-gutter-delete-bg': 'rgba(200, 91, 97, 0.6)',
    '--diff-text-color': '#334155',
    '--diff-gutter-insert-bg-solid': '#d1f0e0',
    '--diff-gutter-insert-text': '#2f8f5b',
    '--diff-gutter-delete-bg-solid': '#f0d1d3',
    '--diff-gutter-delete-text': '#c85b61',
    '--diff-code-insert-bg': '#e8f5ee',
    '--diff-code-delete-bg': '#f5e8e9',
    '--diff-code-insert-edit-bg': '#c8e8d6',
    '--diff-code-delete-edit-bg': '#e8c8cb',
    '--diff-code-selected-bg': 'rgba(99, 102, 241, 0.08)',
    '--diff-omit-gutter-line': '#7a8ca6',
  },
}

export function applyTheme(id: ThemeId): void {
  const palette = THEME_PALETTES[id]
  const root = document.documentElement
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value)
  }
}

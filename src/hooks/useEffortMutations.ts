import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EffortTemplate } from '../../core/types'

export function useEffortMutations(selectedEffortId: number | null) {
  const queryClient = useQueryClient()

  const createEffort = useMutation({
    mutationFn: (input: { title: string; description: string; template: EffortTemplate }) =>
      window.effortless.createEffort(input),
    onSuccess: async (effort) => {
      await queryClient.invalidateQueries({ queryKey: ['efforts'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks', effort.id] })
    },
  })

  const deleteEffort = useMutation({
    mutationFn: (effortId: number) => window.effortless.deleteEffort(effortId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['efforts'] }),
        queryClient.invalidateQueries({ queryKey: ['all-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])

      if (selectedEffortId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['tasks', selectedEffortId] }),
          queryClient.invalidateQueries({ queryKey: ['plans', selectedEffortId] }),
          queryClient.invalidateQueries({ queryKey: ['inputs', selectedEffortId] }),
          queryClient.invalidateQueries({ queryKey: ['attention'] }),
        ])
      }
    },
  })

  return { createEffort, deleteEffort }
}

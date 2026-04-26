import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EffortTemplate } from '../../core/types'

export function useEffortMutations() {
  const queryClient = useQueryClient()

  const createEffort = useMutation({
    mutationFn: (input: { title: string; description: string; template: EffortTemplate }) =>
      window.effortless.createEffort(input),
    onSuccess: async (effort) => {
      await queryClient.invalidateQueries({ queryKey: ['efforts'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks', effort.id] })
    },
  })

  return { createEffort }
}
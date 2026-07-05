import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SetInstructionsInput } from '../../core/types'

export function useInstructionsMutations() {
  const queryClient = useQueryClient()

  const setInstructions = useMutation({
    mutationFn: (input: SetInstructionsInput) => window.effortless.setInstructions(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['instructions'] })
    },
  })

  const deleteInstructions = useMutation({
    mutationFn: (id: number) => window.effortless.deleteInstructions(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['instructions'] })
    },
  })

  return { setInstructions, deleteInstructions }
}

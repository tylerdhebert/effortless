import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useDiscussionMutations(selectedEffortId: number | null) {
  const queryClient = useQueryClient()

  const createDiscussionMessage = useMutation({
    mutationFn: (input: { effortId: number; author: 'user' | 'agent'; body: string }) =>
      window.effortless.createDiscussionMessage(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['discussion', selectedEffortId] })
      await queryClient.invalidateQueries({ queryKey: ['efforts'] })
    },
  })

  return { createDiscussionMessage }
}
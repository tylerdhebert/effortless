import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCacheInvalidation } from './cache'

export function useInputMutations(selectedEffortId: number | null) {
  const queryClient = useQueryClient()
  const { invalidateTask } = useCacheInvalidation()

  const answerInput = useMutation({
    mutationFn: (input: { inputRequestId: number; answer: string }) =>
      window.effortless.answerInputRequest(input),
    onSuccess: async (inputRequest) => {
      await queryClient.invalidateQueries({ queryKey: ['inputs', selectedEffortId] })
      await queryClient.invalidateQueries({ queryKey: ['efforts'] })
      if (inputRequest.taskId && selectedEffortId) {
        await invalidateTask(inputRequest.taskId, selectedEffortId)
      }
    },
  })

  return { answerInput }
}

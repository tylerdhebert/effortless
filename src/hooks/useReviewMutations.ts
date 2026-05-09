import { useMutation } from '@tanstack/react-query'
import { useCacheInvalidation } from './cache'

export function useReviewMutations(selectedEffortId: number | null) {
  const { invalidateTask } = useCacheInvalidation()

  const submitReview = useMutation({
    mutationFn: (input: { taskId: number; verdict: 'approve' | 'request-changes'; body: string }) =>
      window.effortless.submitReview(input),
    onSuccess: async (review) => {
      if (selectedEffortId) {
        await invalidateTask(review.taskId, selectedEffortId)
      }
    },
  })

  const applyReview = useMutation({
    mutationFn: (input: { reviewId: number }) => window.effortless.applyReview(input),
    onSuccess: async (review) => {
      if (selectedEffortId) {
        await invalidateTask(review.taskId, selectedEffortId)
      }
    },
  })

  const requestReviewChanges = useMutation({
    mutationFn: (input: { reviewId: number; body: string }) =>
      window.effortless.requestReviewChanges(input),
    onSuccess: async (review) => {
      if (selectedEffortId) {
        await invalidateTask(review.taskId, selectedEffortId)
      }
    },
  })

  return { submitReview, applyReview, requestReviewChanges }
}

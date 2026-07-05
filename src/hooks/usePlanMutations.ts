import { useMutation, useQueryClient } from '@tanstack/react-query'

export function usePlanMutations(selectedEffortId: number | null, selectedPlanId: number | null, onPlanDraftCleared?: () => void, onPlanFeedbackCleared?: (planId: number) => void) {
  const queryClient = useQueryClient()

  const createPlan = useMutation({
    mutationFn: (input: { effortId: number; body: string }) =>
      window.effortless.createPlan(input),
    onSuccess: async () => {
      onPlanDraftCleared?.()
      await queryClient.invalidateQueries({ queryKey: ['plans', selectedEffortId] })
      await queryClient.invalidateQueries({ queryKey: ['efforts'] })
    },
  })

  const acceptPlan = useMutation({
    mutationFn: (planId: number) => window.effortless.acceptPlan(planId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plans', selectedEffortId] })
      await queryClient.invalidateQueries({ queryKey: ['plan-comments', selectedPlanId] })
      await queryClient.invalidateQueries({ queryKey: ['efforts'] })
    },
  })

  const requestPlanChanges = useMutation({
    mutationFn: (input: { planId: number; body: string }) =>
      window.effortless.requestPlanChanges(input),
    onSuccess: async (plan) => {
      onPlanFeedbackCleared?.(plan.id)
      await queryClient.invalidateQueries({ queryKey: ['plans', plan.effortId] })
      await queryClient.invalidateQueries({ queryKey: ['plan-comments', plan.id] })
      await queryClient.invalidateQueries({ queryKey: ['efforts'] })
    },
  })

  return { createPlan, acceptPlan, requestPlanChanges }
}

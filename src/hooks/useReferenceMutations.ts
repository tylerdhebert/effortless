import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useReferenceMutations(selectedEffortId: number | null) {
  const queryClient = useQueryClient()

  const createReference = useMutation({
    mutationFn: (input: { ownerType: 'effort' | 'plan' | 'task' | 'review'; ownerId: number; targetType: 'effort' | 'plan' | 'task' | 'review' | 'file'; targetId?: number | null; filePath?: string | null; label?: string | null }) =>
      window.effortless.createReference(input),
    onSuccess: async () => {
      if (selectedEffortId) {
        await queryClient.invalidateQueries({ queryKey: ['references', 'effort', selectedEffortId] })
      }
    },
  })

  const deleteReference = useMutation({
    mutationFn: (refId: number) => window.effortless.deleteReference(refId),
    onSuccess: async () => {
      if (selectedEffortId) {
        await queryClient.invalidateQueries({ queryKey: ['references', 'effort', selectedEffortId] })
      }
    },
  })

  return { createReference, deleteReference }
}
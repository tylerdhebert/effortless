import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useMandateMutations() {
  const queryClient = useQueryClient()

  const createMandate = useMutation({
    mutationFn: (input: { workSurface: 'effort' | 'plan' | 'task' | 'review' | 'discussion'; repoId: number | null; sourceType: 'body' | 'file'; body: string | null; filePath: string | null }) =>
      window.effortless.createMandate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mandates'] })
    },
  })

  const updateMandate = useMutation({
    mutationFn: (input: { mandateId: number; workSurface: 'effort' | 'plan' | 'task' | 'review' | 'discussion'; repoId: number | null; sourceType: 'body' | 'file'; body: string | null; filePath: string | null }) =>
      window.effortless.updateMandate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mandates'] })
    },
  })

  const deleteMandate = useMutation({
    mutationFn: (mandateId: number) => window.effortless.deleteMandate(mandateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mandates'] })
    },
  })

  return { createMandate, updateMandate, deleteMandate }
}
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRepoMutations(selectedEffortId: number | null) {
  const queryClient = useQueryClient()

  const createRepo = useMutation({
    mutationFn: (input: { name: string; path: string; baseBranch: string; buildCommand: string | null }) =>
      window.effortless.createRepo(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['repos'] })
    },
  })

  const deleteRepo = useMutation({
    mutationFn: (repoId: number) => window.effortless.deleteRepo(repoId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['repos'] })
      if (selectedEffortId) {
        await queryClient.invalidateQueries({ queryKey: ['tasks', selectedEffortId] })
      }
    },
  })

  const updateRepo = useMutation({
    mutationFn: (input: { repoId: number; name: string; path: string; baseBranch: string; buildCommand: string | null }) =>
      window.effortless.updateRepo(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['repos'] })
      if (selectedEffortId) {
        await queryClient.invalidateQueries({ queryKey: ['tasks', selectedEffortId] })
      }
    },
  })

  return { createRepo, deleteRepo, updateRepo }
}
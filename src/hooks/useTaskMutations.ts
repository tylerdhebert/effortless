import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCacheInvalidation } from './cache'

export function useTaskMutations(selectedEffortId: number | null) {
  const queryClient = useQueryClient()
  const { invalidateTask } = useCacheInvalidation()

  const readyTask = useMutation({
    mutationFn: (taskId: number) => window.effortless.markTaskReady(taskId),
    onSuccess: async (task) => {
      if (selectedEffortId) {
        await invalidateTask(task.id, selectedEffortId)
      }
    },
  })

  const updateTaskDetails = useMutation({
    mutationFn: (input: { taskId: number; repoId?: number | null; branchName?: string | null; baseBranch?: string | null; handoffSummary?: string | null; artifact?: string | null }) =>
      window.effortless.updateTaskDetails(input),
    onSuccess: async (task) => {
      if (selectedEffortId) {
        await invalidateTask(task.id, selectedEffortId)
      }
    },
  })

  const ensureTaskWorktree = useMutation({
    mutationFn: (taskId: number) => window.effortless.ensureTaskWorktree(taskId),
    onSuccess: async (task) => {
      if (selectedEffortId) {
        await invalidateTask(task.id, selectedEffortId)
      }
    },
  })

  const runBuild = useMutation({
    mutationFn: (taskId: number) => window.effortless.runTaskBuild(taskId),
    onSuccess: async (build) => {
      await queryClient.invalidateQueries({ queryKey: ['task-build', build.taskId] })
      if (selectedEffortId) {
        await invalidateTask(build.taskId, selectedEffortId)
      }
    },
  })

  const updateTaskRequiresReview = useMutation({
    mutationFn: ({ taskId, requiresReview }: { taskId: number; requiresReview: boolean }) =>
      window.effortless.updateTaskRequiresReview(taskId, requiresReview),
    onSuccess: async (task) => {
      if (selectedEffortId) {
        await invalidateTask(task.id, selectedEffortId)
      }
    },
  })

  const updateTaskReviewRequiresReview = useMutation({
    mutationFn: ({ taskId, reviewRequiresReview }: { taskId: number; reviewRequiresReview: boolean }) =>
      window.effortless.updateTaskReviewRequiresReview(taskId, reviewRequiresReview),
    onSuccess: async (task) => {
      if (selectedEffortId) {
        await invalidateTask(task.id, selectedEffortId)
      }
    },
  })

  return { readyTask, updateTaskDetails, ensureTaskWorktree, runBuild, updateTaskRequiresReview, updateTaskReviewRequiresReview }
}
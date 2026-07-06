import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCacheInvalidation } from './cache'

export function useTaskMutations(selectedEffortId: number | null) {
  const queryClient = useQueryClient()
  const { invalidateTask } = useCacheInvalidation()

  const createTask = useMutation({
    mutationFn: (input: {
      effortId: number
      title: string
      description: string
      repoId?: number | null
      branchName?: string | null
      baseBranch?: string | null
    }) => window.effortless.createTask(input),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks', task.effortId] })
      await queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['app-state'] })
      await queryClient.invalidateQueries({ queryKey: ['attention'] })
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

  const mergeTask = useMutation({
    mutationFn: (taskId: number) => window.effortless.mergeTask(taskId),
    onSuccess: async (task) => {
      if (selectedEffortId) {
        await invalidateTask(task.id, selectedEffortId)
        await queryClient.invalidateQueries({ queryKey: ['tasks', selectedEffortId] })
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

  const stopAgentRun = useMutation({
    mutationFn: (runId: number) => window.effortless.stopAgentRun(runId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['app-state'] })
      await queryClient.invalidateQueries({ queryKey: ['attention'] })
    },
  })

  return { createTask, updateTaskDetails, mergeTask, runBuild, stopAgentRun }
}

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
    },
  })

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

  const prepareTaskRun = useMutation({
    mutationFn: (input: { taskId: number; profileId?: number | null; label?: string }) =>
      window.effortless.prepareTaskRun(input),
    onSuccess: async (prepared) => {
      await queryClient.invalidateQueries({ queryKey: ['task-runs', prepared.task.id] })
      await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['app-state'] })
      if (selectedEffortId) {
        await invalidateTask(prepared.task.id, selectedEffortId)
      }
    },
  })

  const startTaskRun = useMutation({
    mutationFn: async (input: { taskId: number; profileId?: number | null; purpose?: 'main' | 'side-investigation' | 'implementation' | 'review'; label?: string }) => {
      const prepared = await window.effortless.prepareTaskRun(input)
      await window.effortless.startAgentRun(prepared.run.id, { cols: 100, rows: 24 })
      return prepared
    },
    onSuccess: async (prepared) => {
      await queryClient.invalidateQueries({ queryKey: ['task-runs', prepared.task.id] })
      await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['app-state'] })
      if (selectedEffortId) {
        await invalidateTask(prepared.task.id, selectedEffortId)
      }
    },
  })

  const stopAgentRun = useMutation({
    mutationFn: (runId: number) => window.effortless.stopAgentRun(runId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['task-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['app-state'] })
    },
  })

  return { createTask, readyTask, updateTaskDetails, ensureTaskWorktree, mergeTask, runBuild, prepareTaskRun, startTaskRun, stopAgentRun }
}

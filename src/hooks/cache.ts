import { useQueryClient } from '@tanstack/react-query'

export function useCacheInvalidation() {
  const queryClient = useQueryClient()

  async function invalidateTask(taskId: number, effortId: number) {
    await queryClient.invalidateQueries({ queryKey: ['tasks', effortId] })
    await queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] })
    await queryClient.invalidateQueries({ queryKey: ['reviews', taskId] })
    await queryClient.invalidateQueries({ queryKey: ['task-build', taskId] })
    await queryClient.invalidateQueries({ queryKey: ['efforts'] })
  }

  return { invalidateTask }
}
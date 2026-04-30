import { useQuery } from '@tanstack/react-query'

export function useNotifications() {
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => window.effortless.listPendingNotifications(),
    refetchInterval: 2000,
  })

  const countQuery = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => window.effortless.countPendingNotifications(),
    refetchInterval: 2000,
  })

  return {
    notifications: notificationsQuery.data ?? [],
    count: countQuery.data ?? 0,
    isLoading: notificationsQuery.isLoading || countQuery.isLoading,
  }
}

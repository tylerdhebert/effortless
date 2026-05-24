import { useQuery } from '@tanstack/react-query'
import type { PendingNotification } from '../../core/notifications'

export function useNotifications(): {
  notifications: PendingNotification[]
  count: number
  isLoading: boolean
} {
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

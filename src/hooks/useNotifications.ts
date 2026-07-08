import { useQuery } from '@tanstack/react-query'
import type { PendingNotification } from '../../core/notifications'

export function useNotifications(): {
  notifications: PendingNotification[]
  isLoading: boolean
} {
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => window.effortless.listPendingNotifications(),
    refetchInterval: 2000,
  })

  return {
    notifications: notificationsQuery.data ?? [],
    isLoading: notificationsQuery.isLoading,
  }
}

import { useAppStore } from '@/stores/app-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck } from 'lucide-react';

export default function AgentNotifications() {
  const { notifications, markAllNotificationsRead } = useAppStore();

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </h2>
        {notifications.some((n) => !n.read) && (
          <Button variant="outline" size="sm" onClick={markAllNotificationsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
          <p className="text-muted-foreground">You're all caught up!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card key={notif.id} className={`p-4 ${!notif.read ? 'border-primary/50 bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {!notif.read && <Badge className="h-2 w-2 p-0 rounded-full" />}
                  <span className={!notif.read ? 'font-medium' : ''}>{notif.message}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(notif.createdAt).toLocaleString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

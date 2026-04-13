import { useMemo } from 'react';
import { parseISO, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/stores/app-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { pageShellClassName } from '@/lib/page-animation';
import { Bell, CheckCheck } from 'lucide-react';

type Notif = { id: string; message: string; read: boolean; createdAt: string };

function groupNotifications(notifications: Notif[]) {
  const today: Notif[] = [];
  const yesterday: Notif[] = [];
  const older: Notif[] = [];
  for (const n of notifications) {
    const d = parseISO(n.createdAt);
    if (isToday(d)) today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else older.push(n);
  }
  return { today, yesterday, older };
}

function NotificationRow({ notif }: { notif: Notif }) {
  const created = parseISO(notif.createdAt);
  const relative = formatDistanceToNow(created, { addSuffix: true });
  const absolute = new Date(notif.createdAt).toLocaleString();

  return (
    <Card className={`p-4 transition-colors ${!notif.read ? 'border-primary/40 bg-primary/5' : ''}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {!notif.read && (
            <span
              className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5"
              aria-label="Unread"
            />
          )}
          <span className={!notif.read ? 'font-medium' : ''}>{notif.message}</span>
        </div>
        <div className="text-xs text-muted-foreground shrink-0 sm:text-right space-y-0.5">
          <div title={absolute}>{relative}</div>
          <div className="hidden sm:block text-[11px] opacity-80">{absolute}</div>
        </div>
      </div>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: Notif[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby={`notif-section-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <h3
        id={`notif-section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className="text-sm font-medium text-muted-foreground"
      >
        {title}
      </h3>
      <div className="space-y-3">
        {items.map((notif) => (
          <NotificationRow key={notif.id} notif={notif} />
        ))}
      </div>
    </section>
  );
}

export default function AgentNotifications() {
  const { notifications, markAllNotificationsRead } = useAppStore();

  const grouped = useMemo(() => groupNotifications(notifications), [notifications]);

  return (
    <div className={pageShellClassName()}>
      <PageHeader
        title="Notifications"
        description="Updates about coaching tips and team activity."
        actions={
          notifications.some((n) => !n.read) ? (
            <Button variant="outline" size="sm" onClick={markAllNotificationsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You're all caught up—we'll surface new coaching updates here."
        />
      ) : (
        <div className="space-y-8">
          <Section title="Today" items={grouped.today} />
          <Section title="Yesterday" items={grouped.yesterday} />
          <Section title="Earlier" items={grouped.older} />
        </div>
      )}
    </div>
  );
}

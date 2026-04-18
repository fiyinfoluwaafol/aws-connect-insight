import { useAppStore } from '@/stores/app-store';

export function sendEmailMock(to: string, subject: string, body: string) {
  useAppStore.getState().addSentEmail({ to, subject, body });
  return { success: true, message: `Email queued to ${to}` };
}

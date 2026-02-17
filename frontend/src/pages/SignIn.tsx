import { useNavigate } from 'react-router-dom';
import { useAuthStore, MOCK_USERS, User } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User as UserIcon, Shield, Headphones } from 'lucide-react';

export default function SignIn() {
  const navigate = useNavigate();
  const { signIn } = useAuthStore();

  const supervisors = MOCK_USERS.filter((u) => u.role === 'supervisor');
  const agents = MOCK_USERS.filter((u) => u.role === 'agent');

  const handleSignIn = (user: User) => {
    signIn(user);
    navigate(user.role === 'supervisor' ? '/supervisor' : '/agent');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Amazon Connect Insights
          </h1>
          <p className="text-muted-foreground">
            Sign in to access the supervisor dashboard or agent helper
          </p>
        </div>

        <Card className="p-6">
          <Tabs defaultValue="supervisor" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="supervisor" className="gap-2">
                <Shield className="h-4 w-4" />
                Supervisor
              </TabsTrigger>
              <TabsTrigger value="agent" className="gap-2">
                <Headphones className="h-4 w-4" />
                Agent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="supervisor" className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Select a supervisor account to sign in:
              </p>
              {supervisors.map((user) => (
                <Button
                  key={user.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                  onClick={() => handleSignIn(user)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant="secondary">Team {user.team}</Badge>
                  </div>
                </Button>
              ))}
            </TabsContent>

            <TabsContent value="agent" className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Select an agent account to sign in:
              </p>
              {agents.map((user) => (
                <Button
                  key={user.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                  onClick={() => handleSignIn(user)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Headphones className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground text-center">
              This is a demo application. All data is mocked and stored locally.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

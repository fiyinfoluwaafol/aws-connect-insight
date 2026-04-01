import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Loader2, AlertCircle, Phone, Users } from 'lucide-react';

export default function SignUp() {
  const navigate = useNavigate();
  const signIn = useAuthStore((state) => state.signIn);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'agent' as 'agent' | 'supervisor',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await authApi.register({
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
      });

      await signIn(formData.email, formData.password);

      const user = useAuthStore.getState().user;
      navigate(user?.role === 'supervisor' ? '/supervisor' : '/agent', {
        replace: true,
      });
    } catch (err) {
      const defaultMessage =
        'Account created, but automatic sign in failed. Please sign in manually.';
      setError(err instanceof Error ? err.message : defaultMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4 h-10 w-10" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Create Account
          </h1>
          <p className="text-muted-foreground">Sign up for Amazon Connect Insights</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">I am a...</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, role: 'agent' }))}
                  disabled={isLoading}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    formData.role === 'agent'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Phone className={`h-6 w-6 ${formData.role === 'agent' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-center">
                    <p className={`font-semibold ${formData.role === 'agent' ? 'text-primary' : 'text-foreground'}`}>
                      Agent
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Handle customer calls
                    </p>
                  </div>
                  {formData.role === 'agent' && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, role: 'supervisor' }))}
                  disabled={isLoading}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    formData.role === 'supervisor'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-border hover:border-amber-500/50'
                  }`}
                >
                  <Users className={`h-6 w-6 ${formData.role === 'supervisor' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <div className="text-center">
                    <p className={`font-semibold ${formData.role === 'supervisor' ? 'text-amber-600' : 'text-foreground'}`}>
                      Supervisor
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Manage a team
                    </p>
                  </div>
                  {formData.role === 'supervisor' && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating your account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/signin" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const hash = location.hash || window.location.hash;
    const search = location.search || window.location.search;
    
    let params: URLSearchParams;
    if (hash && hash.includes('access_token')) {
      params = new URLSearchParams(hash.substring(1));
    } else if (search && search.includes('access_token')) {
      params = new URLSearchParams(search);
    } else {
      setError('Invalid or missing reset link. Please request a new one.');
      return;
    }
    
    const token = params.get('access_token');

    if (token) {
      setAccessToken(token);
    } else {
      setError('Invalid or missing reset link. Please request a new one.');
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!accessToken) {
      setError('Invalid or missing reset token');
      return;
    }

    setIsLoading(true);

    try {
      await authApi.resetPassword({ token: accessToken, new_password: newPassword });
      setIsSuccess(true);
      setTimeout(() => navigate('/signin'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
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
            Set New Password
          </h1>
          <p className="text-muted-foreground">
            {isSuccess ? 'Your password has been reset' : 'Enter your new password below'}
          </p>
        </div>

        <Card className="p-6">
          {isSuccess ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 rounded-md">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Password reset successfully! Redirecting to sign in...</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>

              <div className="text-center">
                <Link
                  to="/signin"
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

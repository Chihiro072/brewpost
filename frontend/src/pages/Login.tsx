import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await authAPI.login(formData.email, formData.password);
      await checkAuth(); // Update auth context
      navigate('/app'); // Redirect to main app
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Login failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-primary/8 to-accent/14">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-snow opacity-90"
            style={{
              left: `${Math.random() * 100}%`,
              width: `${3 + Math.random() * 5}px`,
              height: `${3 + Math.random() * 5}px`,
              background: `hsl(var(--primary))`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${5 + Math.random() * 15}s`,
              filter: 'blur(0.3px)',
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-conic from-primary/25 via-accent/14 to-primary/25 animate-pulse" />
        <div className="absolute top-1/4 left-1/4 w-[540px] h-[540px] bg-gradient-to-r from-primary/35 to-accent/35 rounded-full blur-2xl animate-float opacity-80" />
        <div className="absolute bottom-1/4 right-1/4 w-[520px] h-[520px] bg-gradient-to-l from-accent/35 to-primary/35 rounded-full blur-2xl animate-float-delayed opacity-80" />
        
      </div>

      <div className="relative z-10 min-h-screen px-6 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 space-y-6 bg-card/60 backdrop-blur-xl border border-primary/30 shadow-[0_0_40px_hsl(var(--primary)/.35)] rounded-2xl">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-4 relative">
              <img src="/logo.svg" alt="BrewPost" className="w-10 h-10" />
              <h1 className="text-2xl font-extrabold bg-gradient-primary bg-clip-text text-transparent drop-shadow-[0_0_18px_hsl(var(--primary)/.35)]">
                BrewPost
              </h1>
            </div>
            <h2 className="text-xl font-semibold">Welcome Back</h2>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="glow-focus border-primary/20 focus:border-primary/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="glow-focus border-primary/20 focus:border-primary/40"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => navigate('/register')}
              >
                Sign up
              </Button>
            </p>
            <Button
              variant="link"
              className="p-0 h-auto font-normal text-sm"
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPasswordMismatch(false);
    setFieldErrors({});

    try {
      if (isSignUp) {
        // Validate all fields
        const errors: {[key: string]: string} = {};
        
        if (!firstName.trim()) {
          errors.firstName = 'First name should be filled';
        }
        
        if (!email.trim()) {
          errors.email = 'Email should be filled';
        }
        
        if (!password.trim()) {
          errors.password = 'Password should be filled';
        }
        
        if (!confirmPassword.trim()) {
          errors.confirmPassword = 'Confirm password should be filled';
        }
        
        if (password !== confirmPassword && password.trim() && confirmPassword.trim()) {
          setPasswordMismatch(true);
        }
        
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setLoading(false);
          return;
        }
        
        if (password !== confirmPassword) {
          setPasswordMismatch(true);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: firstName
            }
          }
        });
        if (error) throw error;
        
        setError('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-md w-full p-8">
        <div 
          className="rounded-2xl shadow-sm p-8"
          style={{ 
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)'
          }}
        >
          <h1 
            className="text-3xl font-light text-center mb-8"
            style={{ color: 'var(--foreground)' }}
          >
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          
          <form onSubmit={handleAuth} className="space-y-6">
            {isSignUp && (
              <div>
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full p-4 rounded-lg border-none outline-none text-lg"
                  style={{ 
                    backgroundColor: 'var(--input)',
                    color: 'var(--foreground)',
                    fontFamily: 'var(--font-sans)'
                  }}
                />
                {fieldErrors.firstName && (
                  <p 
                    className="text-sm mt-2 ml-1"
                    style={{ color: 'var(--destructive)' }}
                  >
                    {fieldErrors.firstName}
                  </p>
                )}
              </div>
            )}
            
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-lg border-none outline-none text-lg"
                style={{ 
                  backgroundColor: 'var(--input)',
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)'
                }}
              />
              {fieldErrors.email && (
                <p 
                  className="text-sm mt-2 ml-1"
                  style={{ color: 'var(--destructive)' }}
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>
            
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 pr-12 rounded-lg border-none outline-none text-lg"
                style={{ 
                  backgroundColor: 'var(--input)',
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p 
                className="text-sm mt-2 ml-1"
                style={{ color: 'var(--destructive)' }}
              >
                {fieldErrors.password}
              </p>
            )}
            
            {isSignUp && password && (
              <div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-4 pr-12 rounded-lg border-none outline-none text-lg"
                    style={{ 
                      backgroundColor: 'var(--input)',
                      color: 'var(--foreground)',
                      fontFamily: 'var(--font-sans)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p 
                    className="text-sm mt-2 ml-1"
                    style={{ color: 'var(--destructive)' }}
                  >
                    {fieldErrors.confirmPassword}
                  </p>
                )}
                {passwordMismatch && (
                  <p 
                    className="text-sm mt-2 ml-1"
                    style={{ color: 'var(--destructive)' }}
                  >
                    Passwords do not match
                  </p>
                )}
              </div>
            )}
            
            {error && (
              <p 
                className="text-center text-sm"
                style={{ color: 'var(--destructive)' }}
              >
                {error}
              </p>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full p-4 rounded-lg text-lg font-medium transition-colors"
              style={{ 
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)'
              }}
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
          </form>
          
          <div className="text-center mt-6">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

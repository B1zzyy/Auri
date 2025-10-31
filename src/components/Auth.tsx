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
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');

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
        
        // Show verification popup instead of error message
        setSignupEmail(email);
        setShowVerificationPopup(true);
        // Clear form
        setFirstName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
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
                className="w-full p-4 pr-10 sm:pr-12 rounded-lg border-none outline-none text-lg"
                style={{ 
                  backgroundColor: 'var(--input)',
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 flex items-center justify-center"
                style={{ 
                  color: 'var(--muted-foreground)'
                }}
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
                    className="w-full p-4 pr-10 sm:pr-12 rounded-lg border-none outline-none text-lg"
                    style={{ 
                      backgroundColor: 'var(--input)',
                      color: 'var(--foreground)',
                      fontFamily: 'var(--font-sans)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 flex items-center justify-center"
                    style={{ 
                      color: 'var(--muted-foreground)'
                    }}
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
            
            {error && !showVerificationPopup && (
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

      {/* Email Verification Popup */}
      {showVerificationPopup && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowVerificationPopup(false)}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        >
          <div 
            className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4"
            style={{ 
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-2xl)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="mb-4 flex justify-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <h2 
                className="text-2xl font-semibold mb-3"
                style={{ color: 'var(--foreground)' }}
              >
                Check Your Email
              </h2>
              <p 
                className="text-base mb-2"
                style={{ color: 'var(--muted-foreground)' }}
              >
                We've sent a verification link to
              </p>
              <p 
                className="text-base font-medium mb-4"
                style={{ color: 'var(--foreground)' }}
              >
                {signupEmail}
              </p>
              <p 
                className="text-sm mb-6"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Please click the link in the email to verify your account and complete the sign-up process.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  // Get email provider and redirect to their mail website
                  const emailDomain = signupEmail.split('@')[1]?.toLowerCase() || '';
                  let mailUrl = '';
                  
                  if (emailDomain.includes('gmail')) {
                    mailUrl = 'https://mail.google.com';
                  } else if (emailDomain.includes('yahoo')) {
                    mailUrl = 'https://mail.yahoo.com';
                  } else if (emailDomain.includes('outlook') || emailDomain.includes('hotmail') || emailDomain.includes('live') || emailDomain.includes('msn')) {
                    mailUrl = 'https://outlook.live.com';
                  } else if (emailDomain.includes('icloud') || emailDomain.includes('me.com')) {
                    mailUrl = 'https://www.icloud.com/mail';
                  } else if (emailDomain.includes('protonmail') || emailDomain.includes('proton')) {
                    mailUrl = 'https://mail.proton.me';
                  } else {
                    // Default to generic mail link or show a message
                    mailUrl = `https://${emailDomain}`;
                  }
                  
                  window.open(mailUrl, '_blank');
                }}
                className="w-full p-4 rounded-lg text-base font-medium transition-all hover:scale-105 cursor-pointer"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)'
                }}
              >
                Open Mail App
              </button>
              
              <button
                onClick={() => {
                  setShowVerificationPopup(false);
                  setIsSignUp(false);
                  setError('');
                }}
                className="w-full p-4 rounded-lg text-base font-medium transition-all hover:bg-opacity-90 cursor-pointer"
                style={{ 
                  backgroundColor: 'var(--muted)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)'
                }}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

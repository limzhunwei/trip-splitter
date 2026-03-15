import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plane, Mail, Lock, Eye, EyeOff, AlertCircle, User, Globe } from 'lucide-react'
import { NATIONALITIES } from '../lib/currencies'
import { Spinner } from '../components/ui'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nationality, setNationality] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!isLogin && !displayName.trim()) {
      setError('Please enter your display name'); return
    }
    if (!isLogin && !nationality) {
      setError('Please select your nationality'); return
    }
    setLoading(true)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName.trim(), nationality } }
        })
        if (error) throw error
        if (data.user && !data.session) {
          setInfo('Check your email for a confirmation link, then sign in.')
          setIsLogin(true)
        } else if (data.user && data.session) {
          // Update Profiles with nationality right after signup
          await supabase.from('Profiles')
            .upsert({ user_id: data.user.id, display_name: displayName.trim(), nationality }, { onConflict: 'user_id' })
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 via-brand-500 to-violet-600 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative w-full max-w-md page-enter">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <Plane size={30} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-3xl text-white">Trip Splitter</h1>
          <p className="text-white/60 mt-1 text-sm">Split expenses with your crew</p>
        </div>

        <div className="card p-8 shadow-2xl">
          <h2 className="font-display font-bold text-xl text-slate-800 mb-1">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            {isLogin ? 'Sign in to your account to continue' : 'Get started for free today'}
          </p>

          {info && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-emerald-700 text-sm flex items-start gap-2">
              <span className="mt-0.5">✓</span> {info}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display name — signup only */}
            {!isLogin && (
              <div>
                <label className="label">Your Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" required value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="input pl-10"
                    placeholder="e.g. Ahmad, Sarah..."
                  />
                </div>
                <p className="text-slate-400 text-xs mt-1">This name will appear in trips you join</p>
              </div>
            )}

            {/* Nationality — signup only */}
            {!isLogin && (
              <div>
                <label className="label">Nationality</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select value={nationality} onChange={e => setNationality(e.target.value)}
                    className="input pl-10 appearance-none">
                    <option value="">Select your country...</option>
                    {NATIONALITIES.map(n => (
                      <option key={n.country} value={n.country}>{n.country}</option>
                    ))}
                  </select>
                </div>
                <p className="text-slate-400 text-xs mt-1">Sets your default currency for new trips</p>
              </div>
            )}

            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pl-10" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={showPass ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-10 pr-10" minLength={6}
                  placeholder="Min. 6 characters" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? <Spinner size={18} /> : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); setInfo('') }}
              className="text-brand-500 hover:text-brand-700 text-sm font-medium transition">
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

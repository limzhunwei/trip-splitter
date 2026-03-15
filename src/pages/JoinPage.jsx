import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { acceptInvite } from '../lib/db'
import { Plane, Mail, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, User, Globe } from 'lucide-react'
import { NATIONALITIES } from '../lib/currencies'
import { Spinner } from '../components/ui'

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const inviteId = searchParams.get('invite')

  // phases: loading | auth | joining | success | error
  const [phase, setPhase] = useState('loading')
  const [inviteInfo, setInviteInfo] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [displayName, setDisplayName] = useState('')
  const [nationality, setNationality] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!inviteId) { setPhase('error'); setError('No invite ID found in this link.'); return }
    checkInvite()
  }, [inviteId])

  async function checkInvite() {
    const { data: invite, error: invErr } = await supabase
      .from('TripInvites')
      .select('*, Trips(id, name, start_date, end_date)')
      .eq('id', inviteId)
      .maybeSingle()

    if (invErr || !invite) { setPhase('error'); setError('This invite link is invalid or has expired.'); return }
    if (invite.status !== 'pending') { setPhase('error'); setError('This invite has already been used or was cancelled.'); return }

    setInviteInfo(invite)
    setEmail(invite.invited_email)

    // Check if already logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Already logged in — check if it's the right email
      if (user.email.toLowerCase() !== invite.invited_email.toLowerCase()) {
        setPhase('error')
        setError(`This invite was sent to ${invite.invited_email}. You're signed in as ${user.email}. Please sign out first and sign in with the correct account.`)
        return
      }
      tryAccept()
    } else {
      setPhase('auth')
    }
  }

  async function tryAccept() {
    setPhase('joining')
    try {
      const tripId = await acceptInvite(inviteId)
      setPhase('success')
      setTimeout(() => navigate(`/trips/${tripId}`), 1800)
    } catch (err) {
      setPhase('error')
      setError(err.message)
    }
  }

  async function handleAuth(e) {
    e.preventDefault()
    if (authMode === 'signup' && !displayName.trim()) { setError('Please enter your name'); return }
    if (authMode === 'signup' && !nationality) { setError('Please select your nationality'); return }
    setAuthLoading(true)
    setError('')
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // Verify correct email after login
        const { data: { user } } = await supabase.auth.getUser()
        if (user.email.toLowerCase() !== inviteInfo.invited_email.toLowerCase()) {
          await supabase.auth.signOut()
          throw new Error(`This invite was sent to ${inviteInfo.invited_email}. Please sign in with that email.`)
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim(), nationality } }
        })
        if (error) throw error
        if (data.user && !data.session) {
          setError('Please check your email to confirm your account first, then come back to this link.')
          setAuthLoading(false)
          return
        } else if (data.user && data.session) {
          await supabase.from('Profiles')
            .upsert({ user_id: data.user.id, display_name: displayName.trim(), nationality }, { onConflict: 'user_id' })
        }
      }
      await tryAccept()
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 via-brand-500 to-violet-600 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative w-full max-w-md page-enter">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur rounded-2xl mb-3">
            <Plane size={26} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl text-white">Trip Splitter</h1>
        </div>

        <div className="card p-7 shadow-2xl">

          {/* Loading */}
          {(phase === 'loading' || phase === 'joining') && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Spinner size={32} />
              <p className="text-slate-500 text-sm">
                {phase === 'joining' ? 'Joining trip...' : 'Loading invite...'}
              </p>
            </div>
          )}

          {/* Success */}
          {phase === 'success' && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <div>
                <p className="font-display font-bold text-xl text-slate-800">You're in! 🎉</p>
                <p className="text-slate-400 text-sm mt-1">Redirecting to the trip...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <div>
                <p className="font-display font-bold text-xl text-slate-800">Something went wrong</p>
                <p className="text-slate-500 text-sm mt-2">{error}</p>
              </div>
              <button onClick={() => navigate('/')} className="btn-secondary text-sm">Go to Home</button>
            </div>
          )}

          {/* Auth form */}
          {phase === 'auth' && inviteInfo && (
            <>
              {/* Trip banner */}
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-5">
                <p className="text-brand-600 text-xs font-medium mb-1">✈️ You've been invited to join</p>
                <p className="font-display font-bold text-lg text-slate-800">{inviteInfo.Trips?.name}</p>
              </div>

              {/* Mode tabs */}
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-5">
                <button onClick={() => { setAuthMode('login'); setError('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition
                    ${authMode === 'login' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Sign In
                </button>
                <button onClick={() => { setAuthMode('signup'); setError('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition
                    ${authMode === 'signup' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Create Account
                </button>
              </div>

              <p className="text-slate-400 text-xs mb-4 text-center">
                This invite was sent to <span className="font-semibold text-slate-600">{inviteInfo.invited_email}</span>
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
                  <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label className="label">Your Name</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" required value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="input pl-10" placeholder="e.g. Ahmad, Sarah..." />
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input pl-10" />
                  </div>
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type={showPass ? 'text' : 'password'} required
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="input pl-10 pr-10" minLength={6} placeholder="Min. 6 characters" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={authLoading} className="btn-primary w-full py-3">
                  {authLoading ? <Spinner size={18} />
                    : authMode === 'login' ? 'Sign In & Join Trip' : 'Create Account & Join Trip'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

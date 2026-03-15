import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Spinner } from './components/ui'

import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import CreateTripPage from './pages/CreateTripPage'
import TripDetailPage from './pages/TripDetailPage'
import AddExpensePage from './pages/AddExpensePage'
import ExpenseDetailPage from './pages/ExpenseDetailPage'
import TripSummaryPage from './pages/TripSummaryPage'
import JoinPage from './pages/JoinPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Spinner size={32} />
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Spinner size={32} />
    </div>
  )

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/join" element={<JoinPage />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/create-trip" element={<ProtectedRoute><CreateTripPage /></ProtectedRoute>} />
      <Route path="/trips/:tripId" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
      <Route path="/trips/:tripId/summary" element={<ProtectedRoute><TripSummaryPage /></ProtectedRoute>} />
      <Route path="/trips/:tripId/add-expense" element={<ProtectedRoute><AddExpensePage /></ProtectedRoute>} />
      <Route path="/trips/:tripId/expenses/:expenseId" element={<ProtectedRoute><ExpenseDetailPage /></ProtectedRoute>} />
      <Route path="/trips/:tripId/expenses/:expenseId/edit" element={<ProtectedRoute><AddExpensePage editMode /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

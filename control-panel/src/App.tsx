import { Routes, Route, Navigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Terminal from './pages/Terminal'

export default function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />} />
      <Route path="/terminal" element={isAuthenticated ? <Terminal /> : <Navigate to="/" />} />
    </Routes>
  )
}

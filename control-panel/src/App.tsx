import { Routes, Route, Navigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import Login from './pages/Login'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import Terminal from './pages/Terminal'
import Join from './pages/Join'
import MobileAgent from './pages/MobileAgent'

export default function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/hub" element={isAuthenticated ? <Navigate to="/dashboard" /> : <AdminLogin />} />
      <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/hub" />} />
      <Route path="/terminal" element={isAuthenticated ? <Terminal /> : <Navigate to="/hub" />} />
      <Route path="/join" element={<Join />} />
      <Route path="/m" element={<MobileAgent />} />
    </Routes>
  )
}

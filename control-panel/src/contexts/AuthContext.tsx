import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface User {
  username: string
  role: 'admin' | 'operator' | 'viewer'
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// Demo credentials that will be randomly generated on each session
const DEMO_CREDENTIALS = {
  username: 'admin',
  password: Math.random().toString(36).substring(2, 10).toUpperCase(),
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = useCallback((username: string, password: string): boolean => {
    if (username === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password) {
      setUser({ username: 'admin', role: 'admin' })
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export { DEMO_CREDENTIALS }

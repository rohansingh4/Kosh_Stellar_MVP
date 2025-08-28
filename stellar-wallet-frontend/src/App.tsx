import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LoginPage } from "@/pages/LoginPage"
import { WalletPage } from "@/pages/WalletPage"
import { useAuth } from "@/hooks/useAuth"
import { Toaster } from "@/components/ui/toaster"

const queryClient = new QueryClient()

const AppContent = () => {
  const { isAuthenticated, loading, login, error: authError } = useAuth()
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Handle errors from auth
  useEffect(() => {
    if (authError) {
      setErrorMessage(authError.toString())
      setShowError(true)
      // Auto-hide error after 5 seconds
      const timer = setTimeout(() => setShowError(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [authError])

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading wallet...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={login} loading={loading} />
        {showError && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-sm">
            <p className="font-semibold">Authentication Error</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}
      </>
    )
  }

  // Show wallet page if authenticated
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WalletPage />} />
        <Route path="*" element={<WalletPage />} />
      </Routes>
    </BrowserRouter>
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
    <Toaster />
  </QueryClientProvider>
)

export default App
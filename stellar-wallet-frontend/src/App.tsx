import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LoginPage } from "@/pages/LoginPage"
import { WalletPage } from "@/pages/WalletPage"
import { useAuth } from "@/hooks/useAuth"
import { Toaster } from "@/components/ui/toaster"

const queryClient = new QueryClient()

const AppContent = () => {
  const { isAuthenticated, loading, login } = useAuth()

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

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} loading={loading} />
  }

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
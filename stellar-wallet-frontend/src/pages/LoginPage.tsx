import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Loader2, Chrome } from "lucide-react"
import { useState } from "react"

interface LoginPageProps {
  onLogin: (method?: string) => void
  loading?: boolean
}

export const LoginPage = ({ onLogin, loading = false }: LoginPageProps) => {
  const [useII2, setUseII2] = useState(
    localStorage.getItem('FORCE_II_2_0') === 'true'
  )

  const toggleII2 = () => {
    const newValue = !useII2
    setUseII2(newValue)
    localStorage.setItem('FORCE_II_2_0', newValue.toString())
  }

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card border border-border/30 backdrop-blur-sm shadow-[var(--shadow-card)]">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/20 p-6 rounded-2xl border border-primary/30 shadow-[var(--shadow-crypto)]">
              <Wallet className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Kosh Stellar Wallet
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            Connect with Internet Identity to access your Stellar wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-card/30 border border-border/20 rounded-lg transition-smooth">
            <span className="text-sm text-foreground font-medium">Use Internet Identity 2.0</span>
            <button
              onClick={toggleII2}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                useII2 ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  useII2 ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <Button
            onClick={() => onLogin('passkey')}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[var(--shadow-crypto)] transition-smooth"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="h-5 w-5 mr-2" />
                Connect with Internet Identity
              </>
            )}
          </Button>

          {useII2 && (
            <Button
              onClick={() => onLogin('google')}
              disabled={loading}
              variant="outline"
              className="w-full bg-card/50 hover:bg-card/70 text-foreground border-border/50 hover:border-primary/50 transition-smooth"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Chrome className="h-5 w-5 mr-2" />
                  Sign in with Google
                </>
              )}
            </Button>
          )}
          
          <div className="text-center space-y-2">
            <p className="text-sm text-primary font-medium">
              {useII2 ? 'Internet Identity 2.0 with Google integration' : 'Internet Identity 1.0'}
            </p>
            <p className="text-xs text-muted-foreground">
              Powered by Internet Computer & Stellar Network
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
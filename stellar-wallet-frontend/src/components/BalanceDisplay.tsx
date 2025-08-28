import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Eye, EyeOff, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BalanceDisplayProps {
  stellarAddress: { stellar_address: string } | null
  getAccountBalance: () => Promise<string>
  network: string
}

export const BalanceDisplay = ({ stellarAddress, getAccountBalance, network }: BalanceDisplayProps) => {
  const [balance, setBalance] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [showBalance, setShowBalance] = useState(true)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    if (!stellarAddress?.stellar_address) return
    
    try {
      await navigator.clipboard.writeText(stellarAddress.stellar_address)
      setCopied(true)
      toast({
        title: "Address copied!",
        description: "Stellar address copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
      toast({
        title: "Failed to copy",
        description: "Could not copy address to clipboard",
        variant: "destructive",
      })
    }
  }

  const fetchBalance = async () => {
    if (!stellarAddress) return
    
    try {
      setLoading(true)
      const balanceResult = await getAccountBalance()
      
      setBalance(balanceResult)
    } catch (error) {
      console.error("Failed to fetch balance:", error)
      setBalance("Please Fund you Account.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
  }, [stellarAddress, network])

  return (
    <Card className="bg-gradient-card border border-border/30 backdrop-blur-sm shadow-[var(--shadow-card)] transition-smooth hover:shadow-[var(--glow-primary)]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Balance
          </CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowBalance(!showBalance)}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-smooth"
            >
              {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              onClick={fetchBalance}
              variant="ghost"
              size="sm"
              disabled={loading}
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-smooth"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            {showBalance && balance === "Account needs funding" ? (
              <div className="text-center space-y-3">
                <p className="text-lg font-semibold text-muted-foreground">
                  🪙 Account Needs Funding
                </p>
                <p className="text-sm text-muted-foreground">
                  Send XLM to your address to activate your account
                </p>
                <Button
                  onClick={() => window.open(network === "testnet" ? "https://friendbot.stellar.org" : "https://stellar.org", "_blank")}
                  variant="outline"
                  size="sm"
                  className="text-primary border-primary/30 hover:bg-primary/10"
                >
                  {network === "testnet" ? "Get Test XLM" : "Learn More"}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-foreground mb-2">
                  {showBalance ? (loading ? "Loading..." : balance) : "••••••"}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${network === "stellar-testnet" ? "bg-orange-400" : "bg-green-400"}`}></div>
                  Network: {network === "stellar-testnet" ? "Testnet" : "Mainnet"}
                </p>
              </>
            )}
          </div>
          
          {/* {stellarAddress && (
            <div className="p-4 rounded-lg bg-card/30 border border-border/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Stellar Address
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="h-6 w-6 hover:bg-primary/10"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-sm font-mono text-foreground/90 break-all leading-relaxed">
                {stellarAddress.stellar_address}
              </p>
            </div>
          )} */}
        </div>
      </CardContent>
    </Card>
  )
}
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, ExternalLink } from "lucide-react"

interface SendTransactionProps {
  buildAndSubmitTransaction: (destination: string, amount: string) => Promise<any>
  network: string
}

export const SendTransaction = ({ buildAndSubmitTransaction }: SendTransactionProps) => {
  const [destinationAddress, setDestinationAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!destinationAddress || !amount) {
      alert("Please fill in all fields")
      return
    }

    try {
      setLoading(true)
      setResult(null)
      
      const response = await buildAndSubmitTransaction(destinationAddress, amount)
      setResult(response)
      
      if (response.success) {
        // Clear form on success
        setDestinationAddress("")
        setAmount("")
      }
    } catch (error) {
      console.error("Transaction failed:", error)
      setResult({
        success: false,
        message: `Transaction failed: ${error}`
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-gradient-card border border-border/30 backdrop-blur-sm shadow-[var(--shadow-card)] transition-smooth hover:shadow-[var(--glow-primary)]">
      <CardHeader>
        <CardTitle className="text-foreground text-xl font-bold flex items-center gap-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
            <Send className="h-5 w-5 text-primary" />
          </div>
          Send XLM
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Destination Address
            </label>
            <Input
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="bg-card/50 border-border/50 text-foreground placeholder:text-muted-foreground transition-smooth focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Amount (XLM)
            </label>
            <Input
              type="number"
              step="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1.0"
              className="bg-card/50 border-border/50 text-foreground placeholder:text-muted-foreground transition-smooth focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>
          
          <Button
            type="submit"
            disabled={loading || !destinationAddress || !amount}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[var(--shadow-crypto)] transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending Transaction...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Transaction
              </>
            )}
          </Button>
        </form>

        {result && (
          <div className={`mt-6 p-4 rounded-lg border transition-smooth ${
            result.success 
              ? "bg-success/10 border-success/30" 
              : "bg-destructive/10 border-destructive/30"
          }`}>
            <p className={`text-sm font-semibold flex items-center gap-2 ${
              result.success ? "text-success" : "text-destructive"
            }`}>
              {result.success ? "✅ Success" : "❌ Error"}
            </p>
            <p className="text-foreground/90 text-sm mt-2 leading-relaxed">
              {result.message}
            </p>
            
            {result.success && result.explorer_url && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-success hover:text-success/80 hover:bg-success/10 transition-smooth"
                onClick={() => window.open(result.explorer_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Stellar Explorer
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
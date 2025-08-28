import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Copy, Check, Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface AddressDisplayProps {
  stellarAddress?: any
  walletLoading?: boolean
  onRetryAddress?: () => Promise<any>
}

const AddressDisplay = ({ stellarAddress, walletLoading, onRetryAddress }: AddressDisplayProps) => {
  const [copied, setCopied] = useState(false)
  const [showAddress, setShowAddress] = useState(true)
  const { toast } = useToast()
  const hasError = !stellarAddress?.stellar_address && !walletLoading

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

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/30">
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Your Stellar Address:</h3>
        
        {walletLoading ? (
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Generating address...</span>
          </div>
        ) : hasError ? (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">
              Failed to generate address: Error while making call: Server returned an error: Code: 400 (Bad Request) Body: Canister bkyz2-fmaaa-aaaaa-qaaaq-cai does not belong to any subnet.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryAddress}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="p-3 bg-card/30 border border-border/20 rounded-lg flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-primary font-mono text-sm break-all">
                {showAddress 
                  ? stellarAddress?.stellar_address 
                  : '•'.repeat(stellarAddress?.stellar_address?.length || 0).replace(/(.{4})(?=.)/g, '$1 ')
                }
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAddress(!showAddress)}
                className="shrink-0 h-6 w-6 hover:bg-primary/10 text-muted-foreground hover:text-foreground"
                title={showAddress ? 'Hide address' : 'Show address'}
              >
                {showAddress ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="shrink-0 h-6 w-6 hover:bg-primary/10 text-muted-foreground hover:text-foreground"
                title="Copy address"
                disabled={!showAddress}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default AddressDisplay
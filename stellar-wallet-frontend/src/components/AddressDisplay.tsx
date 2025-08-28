import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface AddressDisplayProps {
  stellarAddress?: any
  walletLoading?: boolean
  onRetryAddress?: () => Promise<any>
}

const AddressDisplay = ({ stellarAddress, walletLoading, onRetryAddress }: AddressDisplayProps) => {
  const hasError = !stellarAddress?.stellar_address && !walletLoading

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
          <div className="p-3 bg-card/30 border border-border/20 rounded-lg">
            <p className="text-primary font-mono text-sm break-all">
              {stellarAddress?.stellar_address}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

export default AddressDisplay
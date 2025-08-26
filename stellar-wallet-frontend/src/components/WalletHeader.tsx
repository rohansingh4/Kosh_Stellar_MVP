import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"

interface WalletHeaderProps {
  principal: string
  onLogout: () => void
  network: string
  onNetworkChange: (network: string) => void
}

export const WalletHeader = ({ principal, onLogout, network, onNetworkChange }: WalletHeaderProps) => {
  return (
    <div className="flex items-center justify-between p-6 border-b border-border/30 bg-gradient-card backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="bg-primary/20 p-3 rounded-xl border border-primary/30 shadow-[var(--shadow-crypto)]">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Kosh Stellar Wallet
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            {principal.slice(0, 15)}...{principal.slice(-8)}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <select
          value={network}
          onChange={(e) => onNetworkChange(e.target.value)}
          className="bg-card/50 text-foreground text-sm px-4 py-2 rounded-lg border border-border/30 backdrop-blur-sm transition-smooth hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20"
        >
          <option value="stellar-testnet">Testnet</option>
          <option value="stellar-mainnet">Mainnet</option>
        </select>
        
        <Button
          onClick={onLogout}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-smooth"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  )
}
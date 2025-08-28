import { WalletHeader } from "@/components/WalletHeader"
import { BalanceDisplay } from "@/components/BalanceDisplay"
import AddressDisplay from "@/components/AddressDisplay"
import AIStakingCard from "@/components/AIStakingCard"
import ActionButtons from "@/components/ActionButtons"
import { useAuth } from "@/hooks/useAuth"
import { Loader2 } from "lucide-react"
import { useState } from "react"

export const WalletPage = () => {
  const {
    isAuthenticated,
    principal,
    actor,
    loading,
    walletLoading,
    stellarAddress,
    logout,
    generateStellarAddress,
    buildAndSubmitTransaction,
    getAccountBalance,
  } = useAuth()

  const [selectedNetwork, setSelectedNetwork] = useState("stellar-testnet")

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading wallet...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !principal) {
    return null // Will be handled by App.tsx
  }

  const handleNetworkChange = (network: string) => {
    setSelectedNetwork(network)
    console.log('Network switched to:', network)
  }

  // Convert network names to backend format
  const getNetworkType = (network: string) => {
    return network === "stellar-mainnet" ? "mainnet" : "testnet"
  }

  // Wrapped functions that include network parameter
  const buildAndSubmitTransactionWithNetwork = (destination: string, amount: string) => {
    return buildAndSubmitTransaction(destination, amount, getNetworkType(selectedNetwork))
  }

  const getAccountBalanceWithNetwork = () => {
    return getAccountBalance(getNetworkType(selectedNetwork))
  }

  return (
    <div className="min-h-screen bg-gradient-main relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-primary/10 opacity-20"></div>
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      {/* Main content */}
      <div className="relative z-10 max-w-md mx-auto">
        <WalletHeader
          principal={principal.toString()}
          onLogout={logout}
          network={selectedNetwork}
          onNetworkChange={handleNetworkChange}
        />
        
        <div className="px-6 space-y-6">
          <AddressDisplay 
            stellarAddress={stellarAddress}
            walletLoading={walletLoading}
            onRetryAddress={generateStellarAddress}
          />
          
          <BalanceDisplay
            stellarAddress={stellarAddress}
            getAccountBalance={getAccountBalanceWithNetwork}
            network={selectedNetwork}
          />
          
          <AIStakingCard />
          
          <ActionButtons 
            stellarAddress={stellarAddress}
            onSendTransaction={buildAndSubmitTransactionWithNetwork}
            onRefreshBalance={getAccountBalanceWithNetwork}
            actor={actor}
            selectedNetwork={selectedNetwork}
          />
          
          {/* Footer */}
          <div className="text-center py-6 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-xs text-primary font-semibold">⚡ Threshold Cryptography Powered</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Truly decentralized wallet powered by Threshold cryptography
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
import { WalletHeader } from "@/components/WalletHeader"
import { BalanceDisplay } from "@/components/BalanceDisplay"
import { SendTransaction } from "@/components/SendTransaction"
import { useAuth } from "@/hooks/useAuth"
import { Loader2 } from "lucide-react"
import { useState } from "react"

export const WalletPage = () => {
  const {
    isAuthenticated,
    principal,
    loading,
    walletLoading,
    stellarAddress,
    logout,
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
    <div className="min-h-screen bg-gradient-main">
      <WalletHeader
        principal={principal.toString()}
        onLogout={logout}
        network={selectedNetwork}
        onNetworkChange={handleNetworkChange}
      />
      
      <div className="container mx-auto p-4 space-y-6 max-w-4xl">
        {walletLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
            <p className="text-white">Setting up your wallet...</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <BalanceDisplay
              stellarAddress={stellarAddress}
              getAccountBalance={getAccountBalanceWithNetwork}
              network={selectedNetwork}
            />
            
            <SendTransaction
              buildAndSubmitTransaction={buildAndSubmitTransactionWithNetwork}
              network={selectedNetwork}
            />
          </div>
        )}
      </div>
    </div>
  )
}
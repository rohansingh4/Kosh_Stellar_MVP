import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from './useAuth';
import { fetchXLMPrice, formatUsdValue, formatPercentChange } from './priceApi';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";

const queryClient = new QueryClient();

const AuthenticatedApp = () => {
  const { 
    isAuthenticated, 
    principal, 
    actor, 
    loading, 
    walletLoading,
    stellarAddress,
    login, 
    logout, 
    getStellarAddress,
    buildAndSubmitTransaction,
    getAccountBalance,
  } = useAuth();

  // Global state for price data
  const [priceData, setPriceData] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  
  // Network switching state
  const [selectedNetwork, setSelectedNetwork] = useState("stellar-testnet");

  useEffect(() => {
    fetchPriceData();
  }, []);

  const fetchPriceData = async () => {
    try {
      setPriceLoading(true);
      const data = await fetchXLMPrice();
      setPriceData(data);
    } catch (error) {
      console.error('Error fetching price data:', error);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleNetworkChange = (network: string) => {
    setSelectedNetwork(network);
    console.log('Network switched to:', network);
  };

  // Convert network names to backend format
  const getNetworkType = (network: string) => {
    if (network === "stellar-mainnet") return "mainnet";
    if (network === "base-mainnet") return "base";
    return "testnet";
  };

  // Wrapped functions that include network parameter
  const buildAndSubmitTransactionWithNetwork = (destination: string, amount: string) => {
    return buildAndSubmitTransaction(destination, amount, getNetworkType(selectedNetwork));
  };

  const getAccountBalanceWithNetwork = (address?: string) => {
    return getAccountBalance(getNetworkType(selectedNetwork));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-white">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <Index 
            authData={{
              principal,
              actor,
              walletLoading,
              stellarAddress,
              logout,
              getStellarAddress,
              buildAndSubmitTransaction: buildAndSubmitTransactionWithNetwork,
              getAccountBalance: getAccountBalanceWithNetwork,
              selectedNetwork,
              onNetworkChange: handleNetworkChange,
            }}
            priceData={{
              data: priceData,
              loading: priceLoading,
              refresh: fetchPriceData,
              formatUsdValue,
              formatPercentChange
            }}
          />
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthenticatedApp />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

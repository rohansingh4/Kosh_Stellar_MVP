import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import TrustlineManager from "./TrustlineManager";

interface BalanceDisplayProps {
  stellarAddress?: any;
  actor?: any;
  onGetBalance?: (address?: string) => Promise<string>;
  priceData?: any;
  priceLoading?: boolean;
  formatUsdValue?: (price: number, amount: number) => string;
  formatPercentChange?: (change: number) => string;
  selectedNetwork?: string;
  onTrustlineChange?: () => void;
  onBalanceUpdate?: (balance: string) => void; // Add balance update callback
}

const BalanceDisplay = ({ 
  stellarAddress, 
  actor,
  onGetBalance, 
  priceData, 
  priceLoading,
  formatUsdValue,
  formatPercentChange,
  selectedNetwork,
  onTrustlineChange,
  onBalanceUpdate
}: BalanceDisplayProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const { toast } = useToast();

  const handleRefreshBalance = async () => {
    if (!onGetBalance || !stellarAddress?.stellar_address) {
      toast({
        title: "Cannot refresh balance",
        description: "No Stellar address available",
        variant: "destructive",
      });
      return;
    }

    setBalanceLoading(true);
    try {
      const result = await onGetBalance(stellarAddress.stellar_address);
      setBalance(result);
      
      // Notify parent component of balance update
      if (onBalanceUpdate) {
        onBalanceUpdate(result);
      }
      
      // Check if account needs funding - don't show success toast in this case
      if (result !== "Account needs funding") {
        toast({
          title: "Balance updated",
          description: "Your balance has been refreshed",
        });
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
      toast({
        title: "Failed to refresh balance",
        description: "Could not fetch the latest balance",
        variant: "destructive",
      });
    } finally {
      setBalanceLoading(false);
    }
  };

  // Auto-fetch balance when address becomes available or network changes
  useEffect(() => {
    if (stellarAddress?.stellar_address && isVisible) {
      handleRefreshBalance();
    }
  }, [stellarAddress?.stellar_address, isVisible, selectedNetwork]);

  // Auto-refresh removed as requested by user

  const formatBalance = (bal: string | null) => {
    if (!bal) return '0.00';
    const balanceString = bal.replace(' XLM', '') || '0';
    const numBalance = parseFloat(balanceString);
    
    // Handle NaN case
    if (isNaN(numBalance)) return '0.00';
    
    // Always show exact balance with up to 7 decimal places but minimum 2
    // Remove trailing zeros after decimal point, but keep at least 2 decimal places
    return numBalance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7,
      useGrouping: true
    });
  };

  const getUsdValue = () => {
    if (!balance || !priceData || !formatUsdValue) return '$0.00';
    const numBalance = parseFloat(balance.replace(' XLM', '') || '0');
    if (isNaN(numBalance)) return '$0.00';
    return '$' + formatUsdValue(priceData.price, numBalance);
  };

  const getPriceChange = () => {
    if (!priceData || !formatPercentChange) return '+0.00%';
    return formatPercentChange(priceData.percent_change_24h);
  };

  const isPositiveChange = priceData?.percent_change_24h >= 0;

  return (
    <Card className="p-6 sm:p-8 bg-gradient-card backdrop-blur-md border-border/20 shadow-crypto relative overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-glow opacity-30 animate-pulse-glow"></div>
      
      <div className="relative z-10 text-center space-y-4">
        {/* Balance Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-center flex-wrap gap-2 min-h-[3.5rem]">
            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-crypto-blue bg-clip-text text-transparent break-all text-center max-w-full">
              {balanceLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : balance === "Account needs funding" ? (
                <div className="space-y-4">
                  <div className="text-xl sm:text-2xl text-amber-600 dark:text-amber-400">
                    Account Needs Funding
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Your account needs to be funded with XLM to become active
                    </p>
                    {selectedNetwork === 'testnet' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('https://stellar.org/friendbot', '_blank')}
                        className="text-xs"
                      >
                        Get Test XLM
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('https://stellar.org/learn/fundamentals/stellar-data-structures/accounts#account-creation', '_blank')}
                        className="text-xs"
                      >
                        Learn More
                      </Button>
                    )}
                  </div>
                </div>
              ) : isVisible ? (
                <div className="flex items-center justify-center flex-wrap gap-1">
                  <span className="break-all">{formatBalance(balance)}</span>
                  <span className="text-lg sm:text-xl lg:text-2xl text-crypto-teal">XLM</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <span>••••••</span>
                  <span className="text-lg sm:text-xl lg:text-2xl text-crypto-teal">XLM</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsVisible(!isVisible)}
              className="hover:bg-card/50 transition-smooth"
            >
              {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshBalance}
              disabled={balanceLoading || !stellarAddress?.stellar_address}
              className="hover:bg-card/50 transition-smooth"
            >
              <RefreshCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : 'hover:animate-spin'}`} />
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-card/50 transition-smooth"
                  disabled={!stellarAddress?.stellar_address}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Manage Trustlines</DialogTitle>
                  <DialogDescription>
                    Add or remove trustlines to receive different Stellar tokens
                  </DialogDescription>
                </DialogHeader>
                <TrustlineManager
                  actor={actor}
                  stellarAddress={stellarAddress}
                  selectedNetwork={selectedNetwork}
                  onTrustlineChange={() => {
                    handleRefreshBalance();
                    if (onTrustlineChange) {
                      onTrustlineChange();
                    }
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-lg sm:text-xl text-muted-foreground break-all text-center max-w-full">
            {priceLoading ? (
              'Loading price...'
            ) : (
              `≈ ${isVisible ? getUsdValue() : '••••••'} USD`
            )}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge className={`${
              isPositiveChange 
                ? 'bg-success/20 text-success border-success/30' 
                : 'bg-destructive/20 text-destructive border-destructive/30'
            } animate-float`}>
              {getPriceChange()} (24h)
            </Badge>
          </div>
          {priceData?.source && (
            <p className="text-xs text-muted-foreground">
              Powered by {priceData.source}
            </p>
          )}
        </div>
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/40 rounded-full animate-particle-float"
            style={{
              left: `${20 + i * 15}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${4 + i * 0.5}s`
            }}
          />
        ))}
      </div>
    </Card>
  );
};

export default BalanceDisplay;
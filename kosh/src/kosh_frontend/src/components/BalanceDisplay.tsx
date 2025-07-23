import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface BalanceDisplayProps {
  stellarAddress?: any;
  onGetBalance?: (address?: string) => Promise<string>;
  priceData?: any;
  priceLoading?: boolean;
  formatUsdValue?: (price: number, amount: number) => string;
  formatPercentChange?: (change: number) => string;
}

const BalanceDisplay = ({ 
  stellarAddress, 
  onGetBalance, 
  priceData, 
  priceLoading,
  formatUsdValue,
  formatPercentChange 
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
      toast({
        title: "Balance updated",
        description: "Your balance has been refreshed",
      });
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

  // Auto-fetch balance when address becomes available
  useEffect(() => {
    if (stellarAddress?.stellar_address && isVisible && !balance) {
      handleRefreshBalance();
    }
  }, [stellarAddress?.stellar_address, isVisible]);

  const formatBalance = (bal: string | null) => {
    if (!bal) return '0.00';
    const numBalance = parseFloat(bal.replace(' XLM', '') || '0');
    return numBalance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7
    });
  };

  const getUsdValue = () => {
    if (!balance || !priceData || !formatUsdValue) return '$0.00';
    const numBalance = parseFloat(balance.replace(' XLM', '') || '0');
    return '$' + formatUsdValue(priceData.price, numBalance);
  };

  const getPriceChange = () => {
    if (!priceData || !formatPercentChange) return '+0.00%';
    return formatPercentChange(priceData.percent_change_24h);
  };

  const isPositiveChange = priceData?.percent_change_24h >= 0;

  return (
    <Card className="p-8 bg-gradient-card backdrop-blur-md border-border/20 shadow-crypto relative overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-glow opacity-30 animate-pulse-glow"></div>
      
      <div className="relative z-10 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="text-5xl font-bold bg-gradient-to-r from-primary to-crypto-blue bg-clip-text text-transparent">
            {balanceLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : isVisible ? (
              <>
                {formatBalance(balance)}
                <span className="text-2xl ml-2 text-crypto-teal">XLM</span>
              </>
            ) : (
              <>
                ••••••
                <span className="text-2xl ml-2 text-crypto-teal">XLM</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVisible(!isVisible)}
            className="hover:bg-card/50 transition-smooth"
          >
            {isVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshBalance}
            disabled={balanceLoading || !stellarAddress?.stellar_address}
            className="hover:bg-card/50 transition-smooth"
          >
            <RefreshCw className={`w-5 h-5 ${balanceLoading ? 'animate-spin' : 'hover:animate-spin'}`} />
          </Button>
        </div>
        
        <div className="space-y-2">
          <p className="text-xl text-muted-foreground">
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
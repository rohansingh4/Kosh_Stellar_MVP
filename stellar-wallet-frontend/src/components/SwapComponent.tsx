import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, RefreshCw, AlertTriangle, Plus, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Popular Stellar assets for swapping
const STELLAR_ASSETS = [
  {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    name: 'USD Coin',
    icon: '💵'
  },
  {
    code: 'USDT',
    issuer: 'GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTG6V',
    name: 'Tether USD',
    icon: '💰'
  },
  {
    code: 'AQUA',
    issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
    name: 'Aquarius',
    icon: '🌊'
  },
  {
    code: 'yXLM',
    issuer: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW67G2P2OBKQP5PMPOUF2FIKW7SSP',
    name: 'yXLM',
    icon: '⭐'
  },
  {
    code: 'SRT',
    issuer: 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B',
    name: 'SmartLands',
    icon: '🏢'
  },
];

interface SwapComponentProps {
  actor?: any;
  stellarAddress?: any;
  selectedNetwork?: string;
  onSwapComplete?: () => void;
}

const SwapComponent = ({ actor, stellarAddress, selectedNetwork, onSwapComplete }: SwapComponentProps) => {
  const [fromAmount, setFromAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [trustlineStatus, setTrustlineStatus] = useState<{checking: boolean, exists: boolean | null}>({
    checking: false, 
    exists: null
  });
  const { toast } = useToast();

  const getNetworkType = (network: string) => {
    return network === "stellar-mainnet" ? "mainnet" : "testnet";
  };

  const checkTrustline = async (assetCode: string, assetIssuer: string) => {
    if (!actor || !stellarAddress?.stellar_address) return;

    setTrustlineStatus({ checking: true, exists: null });
    
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      const result = await actor.check_trustline(assetCode, assetIssuer, [networkType]);

      if (result.Ok) {
        const trustlineData = JSON.parse(result.Ok);
        if (trustlineData.success) {
          setTrustlineStatus({ checking: false, exists: trustlineData.exists });
          
          if (!trustlineData.exists) {
            toast({
              title: "Trustline Required",
              description: `You need a trustline for ${assetCode} to receive this token`,
              variant: "destructive",
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking trustline:', error);
      setTrustlineStatus({ checking: false, exists: null });
    }
  };

  const createTrustline = async (assetCode: string, assetIssuer: string) => {
    if (!actor) return;

    setTrustlineStatus({ checking: true, exists: null });

    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      const result = await actor.create_trustline(assetCode, assetIssuer, [], [networkType]);

      if (result.Ok) {
        const trustlineData = JSON.parse(result.Ok);
        if (trustlineData.success) {
          toast({
            title: "Trustline Created! ✅",
            description: trustlineData.message || `Trustline created for ${assetCode}`,
          });
          
          // Update UI to show trustline exists
          setTrustlineStatus({ checking: false, exists: true });
        } else {
          throw new Error(trustlineData.error || "Trustline creation failed");
        }
      } else {
        throw new Error(result.Err || "Trustline creation failed");
      }
    } catch (error) {
      console.error('Error creating trustline:', error);
      setTrustlineStatus({ checking: false, exists: false });
      toast({
        title: "Trustline Creation Failed",
        description: `${error}`,
        variant: "destructive",
      });
    }
  };

  const getQuote = async () => {
    if (!fromAmount || !selectedAsset || !actor) {
      toast({
        title: "Missing Information",
        description: "Please enter amount and select an asset",
        variant: "destructive",
      });
      return;
    }

    const asset = STELLAR_ASSETS.find(a => a.code === selectedAsset);
    if (!asset) return;

    setQuoteLoading(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      const result = await actor.get_swap_quote(
        asset.code,
        asset.issuer,
        fromAmount,
        [networkType]
      );

      console.log('Quote result:', result);

      if (result.Ok) {
        const quoteData = JSON.parse(result.Ok);
        if (quoteData.success) {
          setQuote(quoteData);
          toast({
            title: "Quote Updated",
            description: `You will receive approximately ${quoteData.receive_amount}`,
          });
        } else {
          throw new Error(quoteData.error || "Failed to get quote");
        }
      } else {
        throw new Error(result.Err || "Failed to get quote");
      }
    } catch (error) {
      console.error('Error getting quote:', error);
      toast({
        title: "Quote Failed",
        description: `${error}`,
        variant: "destructive",
      });
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!quote || !stellarAddress?.stellar_address || !actor) {
      toast({
        title: "Cannot Execute Swap",
        description: "Missing quote or wallet address",
        variant: "destructive",
      });
      return;
    }

    const asset = STELLAR_ASSETS.find(a => a.code === selectedAsset);
    if (!asset) return;

    // Calculate minimum amount with slippage
    const minAmount = (parseFloat(quote.destination_amount) * (1 - parseFloat(slippage) / 100)).toFixed(7);
    const sendAmountU64 = BigInt(Math.floor(parseFloat(fromAmount) * 10_000_000)); // Convert to stroops

    setLoading(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      const result = await actor.execute_token_swap(
        stellarAddress.stellar_address, // destination address (same as source for self-swap)
        asset.code,
        asset.issuer,
        sendAmountU64,
        minAmount,
        [networkType]
      );

      console.log('Raw swap result from backend:', result);

      if (result.Ok) {
        const swapData = JSON.parse(result.Ok);
        if (swapData.success) {
          // Show detailed success notification with transaction hash
          const hashDisplay = swapData.hash ? `${swapData.hash.substring(0, 12)}...` : 'N/A';
          toast({
            title: "Swap Successful! ✅",
            description: (
              <div className="space-y-1">
                <p>{swapData.message || `Swapped ${fromAmount} XLM to ${asset.code}`}</p>
                <p className="text-xs font-mono">Hash: {hashDisplay}</p>
                {swapData.explorer_url && (
                  <p className="text-xs text-blue-400 cursor-pointer" 
                     onClick={() => window.open(swapData.explorer_url, '_blank')}>
                    View on Explorer →
                  </p>
                )}
              </div>
            ),
            duration: 8000, // Show longer for transaction details
          });
          
          // Clear form
          setFromAmount("");
          setSelectedAsset("");
          setQuote(null);
          
          // Notify parent component
          if (onSwapComplete) {
            onSwapComplete();
          }
        } else {
          // Show detailed error information
          const errorTitle = swapData.title || "Swap Failed";
          const errorDetail = swapData.detail || swapData.error || "Unknown error";
          const errorCodes = swapData.error_codes ? ` (${swapData.error_codes.join(", ")})` : "";
          
          console.error('Detailed swap error:', swapData);
          throw new Error(`${errorTitle}: ${errorDetail}${errorCodes}`);
        }
      } else {
        throw new Error(result.Err || "Swap failed");
      }
    } catch (error) {
      console.error('Error executing swap:', error);
      toast({
        title: "Swap Failed",
        description: `${error}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-primary">
          Token Swap
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Swap XLM to other Stellar tokens
        </p>
      </div>

      {/* From Section */}
      <div className="space-y-2">
        <Label htmlFor="from-amount" className="text-sm font-medium">From</Label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              id="from-amount"
              type="number"
              placeholder="0.00"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="bg-card/50 border-border/20"
              step="0.0000001"
              min="0"
            />
          </div>
          <div className="flex items-center px-3 py-2 bg-card/50 border border-border/20 rounded-md min-w-[80px]">
            <span className="text-sm font-medium">⭐ XLM</span>
          </div>
        </div>
      </div>

      {/* Swap Arrow */}
      <div className="flex justify-center">
        <div className="p-2 rounded-full bg-card/50 border border-border/20">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* To Section */}
      <div className="space-y-2">
        <Label htmlFor="to-asset" className="text-sm font-medium">To</Label>
        <Select 
          value={selectedAsset} 
          onValueChange={(value) => {
            setSelectedAsset(value);
            setQuote(null);
            setTrustlineStatus({ checking: false, exists: null });
            
            // Check trustline for selected asset
            const asset = STELLAR_ASSETS.find(a => a.code === value);
            if (asset) {
              checkTrustline(asset.code, asset.issuer);
            }
          }}
        >
          <SelectTrigger className="bg-card/50 border-border/20">
            <SelectValue placeholder="Select token to receive" />
          </SelectTrigger>
          <SelectContent>
            {STELLAR_ASSETS.map((asset) => (
              <SelectItem key={asset.code} value={asset.code}>
                <div className="flex items-center gap-2">
                  <span>{asset.icon}</span>
                  <span>{asset.code}</span>
                  <span className="text-xs text-muted-foreground">({asset.name})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Trustline Status */}
        {selectedAsset && (
          <div className="mt-2">
            {trustlineStatus.checking ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Checking trustline...</span>
              </div>
            ) : trustlineStatus.exists === false ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Trustline required for {selectedAsset}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const asset = STELLAR_ASSETS.find(a => a.code === selectedAsset);
                    if (asset) {
                      createTrustline(asset.code, asset.issuer);
                    }
                  }}
                  disabled={trustlineStatus.checking}
                  className="w-full"
                >
                  {trustlineStatus.checking ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      Create Trustline
                    </>
                  )}
                </Button>
              </div>
            ) : trustlineStatus.exists === true ? (
              <div className="flex items-center gap-2 text-sm text-green-500">
                <CheckCircle className="w-3 h-3" />
                <span>Trustline exists ✓</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Slippage Settings */}
      <div className="space-y-2">
        <Label htmlFor="slippage" className="text-sm font-medium">Slippage Tolerance (%)</Label>
        <div className="flex gap-2">
          {["0.1", "0.5", "1.0"].map((value) => (
            <Button
              key={value}
              variant={slippage === value ? "default" : "outline"}
              size="sm"
              onClick={() => setSlippage(value)}
              className="flex-1"
            >
              {value}%
            </Button>
          ))}
          <Input
            id="slippage"
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="w-20 bg-card/50 border-border/20"
            step="0.1"
            min="0.1"
            max="50"
          />
        </div>
      </div>

      {/* Get Quote Button */}
      <Button
        onClick={getQuote}
        disabled={!fromAmount || !selectedAsset || quoteLoading}
        className="w-full"
        variant="outline"
      >
        {quoteLoading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Getting Quote...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Get Quote
          </>
        )}
      </Button>

      {/* Quote Display */}
      {quote && (
        <div className="p-4 bg-card/30 border border-border/20 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">You will receive:</span>
            <span className="font-medium">{quote.receive_amount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Exchange rate:</span>
            <span className="text-sm">{quote.rate} {selectedAsset}/XLM</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Minimum received:</span>
            <span className="text-sm">
              {(parseFloat(quote.destination_amount) * (1 - parseFloat(slippage) / 100)).toFixed(7)} {selectedAsset}
            </span>
          </div>
          {quote.path && quote.path.length > 0 && (
            <div className="pt-2">
              <Badge variant="outline" className="text-xs">
                Path: {quote.path.length + 1} hops
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Status Info */}
      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-200">
          <p className="font-medium">Debug Mode: Simple Payment Test 🔧</p>
          <p>Currently testing with basic XLM payment transactions to debug the transaction flow. This will send XLM to your address instead of token swapping while we troubleshoot.</p>
        </div>
      </div>

      {/* Execute Swap Button */}
      <Button
        onClick={executeSwap}
        disabled={!quote || loading || !stellarAddress?.stellar_address}
        className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/80 hover:to-blue-600/80 transition-all duration-300"
        size="lg"
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Executing Swap...
          </>
        ) : (
          `Swap ${fromAmount || '0'} XLM to ${selectedAsset || 'Token'}`
        )}
      </Button>

      {/* Network Info */}
      <div className="text-center">
        <Badge variant="outline" className="text-xs">
          {selectedNetwork === "stellar-mainnet" ? "Mainnet" : "Testnet"}
        </Badge>
      </div>
    </div>
  );
};

export default SwapComponent;
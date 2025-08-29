import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, RefreshCw, AlertTriangle, Plus, CheckCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { stellarTokens } from "../data/stellarTokens";
import { StellarToken } from "../types/stellar";
import { getSimpleSwapQuote } from "../lib/stellarPathPayments";
import { checkTrustline } from "../lib/stellarApi";
import { createTrustlineTransaction, submitTrustlineTransaction, checkAccountTrustline } from "../lib/stellarTrustlines";
import { createAndSubmitTrustline, signAndSubmitTransaction } from "../lib/walletIntegration";
import { isFreighterAvailable, createTrustlineWithFreighter } from "../lib/freighterIntegration";

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
    if (network === "stellar-mainnet") return "mainnet";
    if (network === "base-mainnet") return "base";
    return "testnet";
  };

  const checkTrustlineStatus = async (token: StellarToken) => {
    if (!stellarAddress?.stellar_address) return;

    setTrustlineStatus({ checking: true, exists: null });
    
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      const result = await checkAccountTrustline(
        stellarAddress.stellar_address,
        token,
        networkType
      );

      setTrustlineStatus({ checking: false, exists: result.exists });
      
      if (!result.exists) {
        toast({
          title: "Trustline Required",
          description: `You need a trustline for ${token.symbol} to receive this token`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error checking trustline:', error);
      setTrustlineStatus({ checking: false, exists: null });
    }
  };

  const createTrustline = async (token: StellarToken) => {
    if (!stellarAddress?.stellar_address) return;

    setTrustlineStatus({ checking: true, exists: null });

    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      
      // Create the trustline transaction XDR
      const { xdr } = await createTrustlineTransaction(
        stellarAddress.stellar_address,
        token,
        undefined, // Use max limit
        networkType
      );

      // Check if Freighter wallet is available
      if (isFreighterAvailable()) {
        console.log('Freighter detected, attempting to sign transaction...');
        
        const freighterResult = await createTrustlineWithFreighter(xdr, networkType);
        
        if (freighterResult.success) {
          setTrustlineStatus({ checking: false, exists: true });
          toast({
            title: "Trustline Created! ✅",
            description: (
              <div className="space-y-1">
                <p>Successfully created trustline for {token.symbol}</p>
                {freighterResult.hash && (
                  <p className="text-xs font-mono">Hash: {freighterResult.hash.substring(0, 12)}...</p>
                )}
                {freighterResult.explorer_url && (
                  <p className="text-xs text-blue-400 cursor-pointer" 
                     onClick={() => window.open(freighterResult.explorer_url, '_blank')}>
                    View on Explorer →
                  </p>
                )}
              </div>
            ),
            duration: 8000,
          });
          return;
        } else {
          console.error('Freighter signing failed:', freighterResult.error);
        }
      }

      // Fallback: Show XDR for manual signing
      console.log('Trustline Transaction XDR:', xdr);
      
      toast({
        title: "Trustline Transaction Ready",
        description: (
          <div className="space-y-2">
            <p>Transaction XDR created for {token.symbol}</p>
            {!isFreighterAvailable() && (
              <p className="text-xs text-amber-400">Install Freighter wallet for automatic signing</p>
            )}
            <p className="text-xs">Check console for XDR to sign manually</p>
            <p className="text-xs font-mono break-all">{xdr.substring(0, 50)}...</p>
          </div>
        ),
        duration: 10000,
      });

      // For demo purposes, simulate the trustline creation after showing XDR
      setTimeout(() => {
        setTrustlineStatus({ checking: false, exists: true });
        toast({
          title: "Trustline Status Updated",
          description: `Marked ${token.symbol} trustline as available for demo purposes`,
        });
      }, 3000);

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
    if (!fromAmount || !selectedAsset) {
      toast({
        title: "Missing Information",
        description: "Please enter amount and select an asset",
        variant: "destructive",
      });
      return;
    }

    const token = stellarTokens.find(t => t.symbol === selectedAsset);
    if (!token) return;

    setQuoteLoading(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      
      // Use frontend path finding instead of backend
      const pathQuote = await getSimpleSwapQuote(token, fromAmount, networkType);
      
      if (pathQuote && pathQuote.success) {
        const quoteData = {
          success: true,
          receive_amount: `${pathQuote.destination_amount} ${token.symbol}`,
          rate: parseFloat(pathQuote.destination_amount) / parseFloat(fromAmount),
          destination_amount: pathQuote.destination_amount,
          path: pathQuote.path || []
        };
        
        setQuote(quoteData);
        toast({
          title: "Quote Updated",
          description: `You will receive approximately ${pathQuote.destination_amount} ${token.symbol}`,
        });
      } else {
        throw new Error("No swap path available for this asset pair");
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

    const token = stellarTokens.find(t => t.symbol === selectedAsset);
    if (!token) return;

    // Calculate minimum amount with slippage
    const minAmount = (parseFloat(quote.destination_amount) * (1 - parseFloat(slippage) / 100)).toFixed(7);
    const sendAmountU64 = BigInt(Math.floor(parseFloat(fromAmount) * 10_000_000)); // Convert to stroops

    setLoading(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      const result = await actor.execute_token_swap(
        stellarAddress.stellar_address, // destination address (same as source for self-swap)
        token.symbol,
        token.issuer,
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
                <p>{swapData.message || `Swapped ${fromAmount} XLM to ${token.symbol}`}</p>
                <p className="text-xs font-mono">Hash: {hashDisplay}</p>
                {swapData.explorer_url && (
                  <p className="text-xs text-blue-400 cursor-pointer" 
                     onClick={() => window.open(swapData.explorer_url, '_blank')}>
                    View on Explorer →
                  </p>
                )}
              </div>
            ),
            duration: 8000,
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
          throw new Error(swapData.error || "Swap failed");
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

  // Check trustline when asset is selected
  useEffect(() => {
    if (selectedAsset) {
      const token = stellarTokens.find(t => t.symbol === selectedAsset);
      if (token) {
        checkTrustlineStatus(token);
      }
    }
  }, [selectedAsset, stellarAddress?.stellar_address, selectedNetwork]);

  return (
    <Card className="p-6 bg-gradient-card backdrop-blur-md border-border/20 shadow-crypto">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-crypto-teal bg-clip-text text-transparent">
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
                className="bg-card/50 border-border/20 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&]:[-moz-appearance:textfield]"
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
            }}
          >
            <SelectTrigger className="bg-card/50 border-border/20">
              <SelectValue placeholder="Select token to receive" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {stellarTokens.map((token) => (
                <SelectItem key={`${token.symbol}-${token.issuer}`} value={token.symbol}>
                  <div className="flex items-center gap-2">
                    {token.logoURI ? (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-4 h-4 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span>🪙</span>
                    )}
                    <span>{token.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {token.name}
                    </span>
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
                      const token = stellarTokens.find(t => t.symbol === selectedAsset);
                      if (token) {
                        createTrustline(token);
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
                <div className="flex items-center gap-2 text-sm text-success">
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
              className="w-20 bg-card/50 border-border/20 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&]:[-moz-appearance:textfield]"
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
              <Search className="w-4 h-4 mr-2" />
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
              <span className="text-sm">{quote.rate.toFixed(6)} {selectedAsset}/XLM</span>
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

        {/* Execute Swap Button */}
        <Button
          onClick={executeSwap}
          disabled={!quote || loading || !stellarAddress?.stellar_address || trustlineStatus.exists === false}
          className="w-full bg-gradient-to-r from-primary to-crypto-teal hover:from-primary/80 hover:to-crypto-teal/80 transition-all duration-300"
          size="lg"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Executing Swap...
            </>
          ) : trustlineStatus.exists === false ? (
            "Create Trustline First"
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
    </Card>
  );
};

export default SwapComponent;

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
import { executeSwapWithFreighter, createSwapXdrForSigning, createPathPaymentTransaction } from "../lib/stellarSwap";

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
  // Reset trustline status - don't trust localStorage for now
  const [trustlineStatus, setTrustlineStatus] = useState<{[key: string]: {checking: boolean, exists: boolean | null}}>({});
  const { toast } = useToast();

  const getNetworkType = (network: string) => {
    if (network === "stellar-mainnet" || network === "mainnet") return "mainnet";
    return "testnet";
  };

  const checkTrustlineStatus = async (token: StellarToken) => {
    if (!stellarAddress?.stellar_address) return;

    const tokenKey = `${token.symbol}:${token.issuer}`;
    setTrustlineStatus(prev => ({
      ...prev,
      [tokenKey]: { checking: true, exists: null }
    }));
    
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-mainnet");
      console.log(`🔍 Checking trustline for ${token.symbol} on ${networkType}`);
      console.log(`Token issuer: ${token.issuer}`);
      console.log(`Account: ${stellarAddress.stellar_address}`);
      
      const result = await checkAccountTrustline(
        stellarAddress.stellar_address,
        token,
        networkType
      );

      console.log(`Trustline check result for ${token.symbol}:`, result);

      const newStatus = { checking: false, exists: result.exists };
      setTrustlineStatus(prev => ({
        ...prev,
        [tokenKey]: newStatus
      }));
      
      // Update localStorage with fresh data
      const updatedStatus = {
        ...trustlineStatus,
        [tokenKey]: newStatus
      };
      localStorage.setItem('kosh_trustline_status', JSON.stringify(updatedStatus));
      
      if (!result.exists) {
        console.log(`❌ No trustline found for ${token.symbol}`);
        toast({
          title: "Trustline Required",
          description: `You need a trustline for ${token.symbol} to receive this token`,
          variant: "destructive",
        });
      } else {
        console.log(`✅ Trustline exists for ${token.symbol}`);
      }
    } catch (error) {
      console.error('Error checking trustline:', error);
      setTrustlineStatus(prev => ({
        ...prev,
        [tokenKey]: { checking: false, exists: null }
      }));
    }
  };

  const createTrustline = async (token: StellarToken) => {
    if (!stellarAddress?.stellar_address || !actor) return;

    const tokenKey = `${token.symbol}:${token.issuer}`;
    setTrustlineStatus(prev => ({
      ...prev,
      [tokenKey]: { checking: true, exists: null }
    }));

    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-mainnet");
      
      console.log(`🔧 Creating trustline for ${token.symbol} using backend signer`);
      console.log(`Token issuer: ${token.issuer}`);
      console.log(`Network: ${networkType}`);
      
      // Use your existing backend create_trustline method (like your working transfer)
      const result = await actor.create_trustline(
        token.symbol,
        token.issuer,
        [networkType],
        ["922337203685.4775807"] // Max limit
      );
      
      console.log('Trustline creation result:', result);
      
      if (result.Ok) {
        const trustlineData = JSON.parse(result.Ok);
        
        if (trustlineData.success) {
          setTrustlineStatus(prev => ({
            ...prev,
            [tokenKey]: { checking: false, exists: true }
          }));
          
          // Update localStorage
          const updatedStatus = {
            ...trustlineStatus,
            [tokenKey]: { checking: false, exists: true }
          };
          localStorage.setItem('kosh_trustline_status', JSON.stringify(updatedStatus));
          
          toast({
            title: "Trustline Created! ✅",
            description: (
              <div className="space-y-1">
                <p>Successfully created trustline for {token.symbol}</p>
                {trustlineData.hash && (
                  <p className="text-xs font-mono">Hash: {trustlineData.hash.substring(0, 12)}...</p>
                )}
                {trustlineData.explorer_url && (
                  <p className="text-xs text-blue-400 cursor-pointer" 
                     onClick={() => window.open(trustlineData.explorer_url, '_blank')}>
                    View on Explorer →
                  </p>
                )}
              </div>
            ),
            duration: 8000,
          });
          return;
        } else {
          throw new Error(trustlineData.error || "Trustline creation failed");
        }
      } else {
        throw new Error(result.Err || "Backend call failed");
      }

    } catch (error) {
      console.error('Error creating trustline:', error);
      setTrustlineStatus(prev => ({
        ...prev,
        [tokenKey]: { checking: false, exists: null }
      }));
      
      let errorMessage = `${error}`;
      if (errorMessage.includes('op_no_destination')) {
        errorMessage = 'Account needs funding first. Send some XLM to this account.';
      } else if (errorMessage.includes('op_low_reserve')) {
        errorMessage = 'Insufficient XLM balance. Need at least 0.5 XLM for trustline.';
      }
      
      toast({
        title: "Trustline Creation Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
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
      const networkType = getNetworkType(selectedNetwork || "stellar-mainnet");
      
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
        description: "Missing quote, wallet address, or actor",
        variant: "destructive",
      });
      return;
    }

    const token = stellarTokens.find(t => t.symbol === selectedAsset);
    if (!token) return;

    setLoading(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-mainnet");
      
      console.log(`🚀 Using existing execute_token_swap with minimal destMin`);
      
      // Use your existing execute_token_swap function - it already has the signing infrastructure
      const sendAmountU64 = BigInt(Math.floor(parseFloat(fromAmount) * 10_000_000));
      const result = await actor.execute_token_swap(
        stellarAddress.stellar_address,
        token.symbol,
        token.issuer,
        sendAmountU64,
        "0.0000001", // Minimal amount to satisfy Stellar requirements
        [networkType]
      );

      console.log('Raw swap result from backend:', result);
      
      if (result.Ok) {
        // Your sign_transaction_stellar returns JSON string directly
        const swapData = JSON.parse(result.Ok);
        
        if (swapData.success) {
          const hashDisplay = swapData.hash ? `${swapData.hash.substring(0, 12)}...` : 'N/A';
          toast({
            title: "Swap Successful! ✅",
            description: (
              <div className="space-y-1">
                <p>Successfully swapped {fromAmount} XLM to {token.symbol}</p>
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
          
          setFromAmount("");
          setSelectedAsset("");
          setQuote(null);
          
          if (onSwapComplete) {
            onSwapComplete();
          }
        } else {
          // Handle error from your submit_transaction function
          let errorMsg = swapData.error || "Swap failed";
          if (swapData.stellar_error_code) {
            errorMsg = `${errorMsg} (${swapData.stellar_error_code})`;
          }
          throw new Error(errorMsg);
        }
      } else {
        throw new Error(result.Err || "Backend call failed");
      }
    } catch (error) {
      console.error('Error executing swap:', error);
      
      // Parse Stellar error details
      let errorDescription = `${error}`;
      if (errorDescription.includes('op_no_trust')) {
        errorDescription = 'Trustline does not exist for this asset. Create a trustline first.';
      } else if (errorDescription.includes('op_too_few_offers')) {
        errorDescription = 'Not enough liquidity on the DEX. Try a smaller amount.';
      } else if (errorDescription.includes('op_under_dest_min')) {
        errorDescription = 'Insufficient liquidity to meet minimum requirements.';
      } else if (errorDescription.includes('Transaction Failed')) {
        // Keep the detailed error from backend
        errorDescription = `${error}`;
      }
      
      toast({
        title: "Swap Failed",
        description: errorDescription,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Save trustline status to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('kosh_trustline_status', JSON.stringify(trustlineStatus));
    } catch (error) {
      console.error('Failed to save trustline status:', error);
    }
  }, [trustlineStatus]);

  // Check trustline when asset is selected
  useEffect(() => {
    if (selectedAsset) {
      const token = stellarTokens.find(t => t.symbol === selectedAsset);
      if (token) {
        const tokenKey = `${token.symbol}:${token.issuer}`;
        // Only check if we don't have cached status
        if (!trustlineStatus[tokenKey]) {
          checkTrustlineStatus(token);
        }
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
              // Don't reset trustline status when changing assets - keep the cache
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
          {selectedAsset && (() => {
            const token = stellarTokens.find(t => t.symbol === selectedAsset);
            if (!token) return null;
            
            const tokenKey = `${token.symbol}:${token.issuer}`;
            const status = trustlineStatus[tokenKey] || { checking: false, exists: null };
            
            return (
              <div className="mt-2">
                {status.checking ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Checking trustline...</span>
                  </div>
                ) : status.exists === false ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Trustline required for {selectedAsset}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createTrustline(token)}
                      disabled={status.checking}
                      className="w-full"
                    >
                      {status.checking ? (
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
                ) : status.exists === true ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle className="w-3 h-3" />
                      <span>Trustline exists ✓</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => checkTrustlineStatus(token)}
                      className="text-xs h-6"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Trustline status unknown</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => checkTrustlineStatus(token)}
                      className="text-xs h-6"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
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
          disabled={!fromAmount || !selectedAsset || quoteLoading || selectedNetwork !== "stellar-mainnet"}
          className="w-full"
          variant="outline"
        >
          {selectedNetwork !== "stellar-mainnet" ? (
            "Swap Only Available on Mainnet"
          ) : quoteLoading ? (
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
              <span className="text-sm text-green-400">
                0.0000001 {selectedAsset} (minimal)
              </span>
            </div>
            {quote.path && Array.isArray(quote.path) && quote.path.length > 0 && (
              <div className="pt-2">
                <Badge variant="outline" className="text-xs">
                  Path: {quote.path.length} intermediate assets
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Execute Swap Button */}
        <Button
          onClick={executeSwap}
          disabled={
            selectedNetwork !== "stellar-mainnet" || 
            !quote || 
            loading || 
            !stellarAddress?.stellar_address || 
            (() => {
              const token = stellarTokens.find(t => t.symbol === selectedAsset);
              if (!token) return true;
              const tokenKey = `${token.symbol}:${token.issuer}`;
              const status = trustlineStatus[tokenKey];
              return status?.exists === false;
            })()
          }
          className="w-full bg-gradient-to-r from-primary to-crypto-teal hover:from-primary/80 hover:to-crypto-teal/80 transition-all duration-300"
          size="lg"
        >
          {selectedNetwork !== "stellar-mainnet" ? (
            "Mainnet Required for Swaps"
          ) : loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Executing Swap...
            </>
          ) : (() => {
            const token = stellarTokens.find(t => t.symbol === selectedAsset);
            if (!token) return false;
            const tokenKey = `${token.symbol}:${token.issuer}`;
            const status = trustlineStatus[tokenKey];
            return status?.exists === false;
          })() ? (
            "Create Trustline First"
          ) : (
            `Swap ${fromAmount || '0'} XLM to ${selectedAsset || 'Token'}`
          )}
        </Button>

        {/* Network Info & Suggestions */}
        <div className="space-y-2">
          <div className="text-center">
            <Badge variant="outline" className="text-xs">
              {selectedNetwork === "stellar-mainnet" ? "Mainnet" : "Testnet"}
            </Badge>
          </div>
          
          {selectedNetwork === "stellar-mainnet" ? (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-green-200">
                <p className="font-medium mb-1">Mainnet Active</p>
                <p>You're trading on Stellar mainnet with real assets and excellent liquidity.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-200">
                <p className="font-medium mb-1">Testnet Mode</p>
                <p>Token swaps are only available on Stellar mainnet. Switch to mainnet to enable swapping.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SwapComponent;

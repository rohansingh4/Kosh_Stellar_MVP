import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Trash2, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  ExternalLink,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { stellarTokens, findToken } from "../data/stellarTokens";
import { StellarToken, TrustlineInfo } from "../types/stellar";
import { checkTrustline } from "../lib/stellarApi";

interface TrustlineManagerProps {
  actor?: any;
  stellarAddress?: any;
  selectedNetwork?: string;
  onTrustlineChange?: () => void;
}

const TrustlineManager = ({ actor, stellarAddress, selectedNetwork, onTrustlineChange }: TrustlineManagerProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedToken, setSelectedToken] = useState<StellarToken | null>(null);
  const [customAssetCode, setCustomAssetCode] = useState("");
  const [customAssetIssuer, setCustomAssetIssuer] = useState("");
  const [trustlineLimit, setTrustlineLimit] = useState("");
  const [existingTrustlines, setExistingTrustlines] = useState<TrustlineInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingTrustlines, setLoadingTrustlines] = useState(false);
  const { toast } = useToast();

  const getNetworkType = (network: string) => {
    if (network === "stellar-mainnet") return "mainnet";
    return "testnet";
  };

  // Filter tokens based on search
  const filteredTokens = stellarTokens.filter(token =>
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.issuer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load existing trustlines
  const loadTrustlines = async () => {
    if (!stellarAddress?.stellar_address) return;

    setLoadingTrustlines(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      
      // Get account assets from Stellar API
      const assetsResult = await checkTrustline(
        stellarAddress.stellar_address,
        "", // Empty to get all assets
        "",
        networkType
      );

      if (assetsResult.success) {
        // This would need to be modified to return all trustlines, not just check one
        // For now, we'll simulate getting trustlines
        setExistingTrustlines([]);
      }
    } catch (error) {
      console.error('Error loading trustlines:', error);
    } finally {
      setLoadingTrustlines(false);
    }
  };

  useEffect(() => {
    loadTrustlines();
  }, [stellarAddress, selectedNetwork]);

  // Create trustline
  const createTrustline = async (assetCode: string, assetIssuer: string, limit?: string) => {
    if (!actor || !stellarAddress?.stellar_address) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      const limitArray = limit ? [limit] : [];
      
      const result = await actor.create_trustline(
        assetCode, 
        assetIssuer, 
        limitArray,
        [networkType]
      );

      if (result.Ok) {
        const trustlineData = JSON.parse(result.Ok);
        if (trustlineData.success) {
          toast({
            title: "Trustline Created! ✅",
            description: `Successfully created trustline for ${assetCode}`,
          });
          
          // Refresh trustlines and notify parent
          loadTrustlines();
          if (onTrustlineChange) {
            onTrustlineChange();
          }
          
          // Close dialog and reset form
          setDialogOpen(false);
          setSelectedToken(null);
          setCustomAssetCode("");
          setCustomAssetIssuer("");
          setTrustlineLimit("");
        } else {
          throw new Error(trustlineData.error || "Failed to create trustline");
        }
      } else {
        throw new Error(result.Err || "Failed to create trustline");
      }
    } catch (error) {
      console.error('Error creating trustline:', error);
      toast({
        title: "Failed to Create Trustline",
        description: `${error}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Remove trustline (set limit to 0)
  const removeTrustline = async (assetCode: string, assetIssuer: string) => {
    if (!actor || !stellarAddress?.stellar_address) return;

    setLoading(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      
      const result = await actor.create_trustline(
        assetCode, 
        assetIssuer, 
        ["0"], // Set limit to 0 to remove
        [networkType]
      );

      if (result.Ok) {
        const trustlineData = JSON.parse(result.Ok);
        if (trustlineData.success) {
          toast({
            title: "Trustline Removed ✅",
            description: `Successfully removed trustline for ${assetCode}`,
          });
          
          loadTrustlines();
          if (onTrustlineChange) {
            onTrustlineChange();
          }
        } else {
          throw new Error(trustlineData.error || "Failed to remove trustline");
        }
      } else {
        throw new Error(result.Err || "Failed to remove trustline");
      }
    } catch (error) {
      console.error('Error removing trustline:', error);
      toast({
        title: "Failed to Remove Trustline",
        description: `${error}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrustline = () => {
    if (selectedToken) {
      createTrustline(selectedToken.symbol, selectedToken.issuer, trustlineLimit || undefined);
    } else if (customAssetCode && customAssetIssuer) {
      createTrustline(customAssetCode, customAssetIssuer, trustlineLimit || undefined);
    } else {
      toast({
        title: "Missing Information",
        description: "Please select a token or enter custom asset details",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-gradient-card backdrop-blur-md border-border/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Trustline Manager</CardTitle>
            <CardDescription>
              Manage your Stellar asset trustlines to receive different tokens
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Trustline
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Add New Trustline</DialogTitle>
                <DialogDescription>
                  Create a trustline to receive a specific Stellar asset
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Popular Tokens */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Popular Tokens</Label>
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tokens..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* Token List */}
                  <ScrollArea className="h-64 border border-border/20 rounded-lg p-2">
                    <div className="space-y-2">
                      {filteredTokens.map((token) => (
                        <div
                          key={`${token.symbol}-${token.issuer}`}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedToken?.issuer === token.issuer
                              ? 'border-primary bg-primary/10'
                              : 'border-border/20 hover:border-border/40'
                          }`}
                          onClick={() => {
                            setSelectedToken(token);
                            setCustomAssetCode("");
                            setCustomAssetIssuer("");
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {token.logoURI && (
                              <img
                                src={token.logoURI}
                                alt={token.symbol}
                                className="w-8 h-8 rounded-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{token.symbol}</span>
                                <Badge variant="outline" className="text-xs">
                                  {token.name}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {token.issuer}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <Separator />

                {/* Custom Asset */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Custom Asset</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="asset-code" className="text-xs">Asset Code</Label>
                      <Input
                        id="asset-code"
                        placeholder="e.g., USDC"
                        value={customAssetCode}
                        onChange={(e) => {
                          setCustomAssetCode(e.target.value.toUpperCase());
                          setSelectedToken(null);
                        }}
                        maxLength={12}
                      />
                    </div>
                    <div>
                      <Label htmlFor="asset-issuer" className="text-xs">Asset Issuer</Label>
                      <Input
                        id="asset-issuer"
                        placeholder="G..."
                        value={customAssetIssuer}
                        onChange={(e) => {
                          setCustomAssetIssuer(e.target.value);
                          setSelectedToken(null);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Trustline Limit */}
                <div className="space-y-2">
                  <Label htmlFor="trustline-limit" className="text-sm font-medium">
                    Trustline Limit (Optional)
                  </Label>
                  <Input
                    id="trustline-limit"
                    type="number"
                    placeholder="Leave empty for maximum limit"
                    value={trustlineLimit}
                    onChange={(e) => setTrustlineLimit(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum amount of this asset you can hold. Leave empty for unlimited.
                  </p>
                </div>

                {/* Info */}
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-200">
                    <p className="font-medium mb-1">About Trustlines</p>
                    <p>
                      Trustlines allow you to hold non-native assets on Stellar. 
                      Creating a trustline means you trust the issuer to honor the asset.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleCreateTrustline}
                    disabled={loading || (!selectedToken && (!customAssetCode || !customAssetIssuer))}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Trustline
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {/* Existing Trustlines */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Your Trustlines</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadTrustlines}
              disabled={loadingTrustlines}
            >
              <RefreshCw className={`w-4 h-4 ${loadingTrustlines ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {loadingTrustlines ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading trustlines...</p>
            </div>
          ) : existingTrustlines.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border/40 rounded-lg">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No trustlines found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a trustline to start receiving tokens
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {existingTrustlines.map((trustline) => {
                const token = findToken(trustline.asset_code, trustline.asset_issuer);
                return (
                  <div
                    key={`${trustline.asset_code}-${trustline.asset_issuer}`}
                    className="flex items-center justify-between p-3 border border-border/20 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {token?.logoURI && (
                        <img
                          src={token.logoURI}
                          alt={trustline.asset_code}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{trustline.asset_code}</span>
                          {trustline.is_authorized ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Balance: {parseFloat(trustline.balance).toFixed(4)} / {trustline.limit}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(
                          `https://stellar.expert/explorer/${getNetworkType(selectedNetwork || "stellar-testnet")}/account/${trustline.asset_issuer}`,
                          '_blank'
                        )}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTrustline(trustline.asset_code, trustline.asset_issuer)}
                        disabled={loading || parseFloat(trustline.balance) > 0}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Network Info */}
        <div className="mt-6 pt-4 border-t border-border/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Network</span>
            <Badge variant="outline">
              {selectedNetwork === "stellar-mainnet" ? "Mainnet" : "Testnet"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrustlineManager;
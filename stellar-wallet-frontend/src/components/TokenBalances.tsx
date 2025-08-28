import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Eye, EyeOff, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Asset {
  asset_type: string;
  asset_code: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  is_authorized: boolean;
  is_authorized_to_maintain_liabilities: boolean;
  buying_liabilities: string;
  selling_liabilities: string;
}

interface TokenBalancesProps {
  actor?: any;
  selectedNetwork?: string;
  onAddTrustline?: () => void;
  stellarAddress?: any;
}

const TokenBalances = ({ actor, selectedNetwork, onAddTrustline, stellarAddress }: TokenBalancesProps) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { toast } = useToast();

  const getNetworkType = (network: string) => {
    return network === "stellar-mainnet" ? "mainnet" : "testnet";
  };

  const fetchAssets = async () => {
    if (!actor || !stellarAddress?.stellar_address) {
      return;
    }

    setLoading(true);
    try {
      const networkType = getNetworkType(selectedNetwork || "stellar-testnet");
      const result = await actor.get_account_assets([networkType]);

      console.log('Assets result:', result);

      if (result.Ok) {
        const assetsData = JSON.parse(result.Ok);
        if (assetsData.success) {
          setAssets(assetsData.assets || []);
        } else {
          console.error('Failed to fetch assets:', assetsData.error);
          toast({
            title: "Failed to fetch assets",
            description: assetsData.error || "Could not load token balances",
            variant: "destructive",
          });
        }
      } else {
        throw new Error(result.Err || "Failed to fetch assets");
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast({
        title: "Error loading assets",
        description: `${error}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [actor, stellarAddress, selectedNetwork]);

  const formatBalance = (balance: string, assetCode: string) => {
    if (!balance) return '0.00';
    const numBalance = parseFloat(balance);
    
    if (isNaN(numBalance)) return '0.00';
    
    return numBalance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7,
      useGrouping: true
    });
  };

  const formatIssuer = (issuer?: string) => {
    if (!issuer) return '';
    return `${issuer.substring(0, 8)}...${issuer.substring(issuer.length - 8)}`;
  };

  const getAssetIcon = (assetCode: string) => {
    const icons: Record<string, string> = {
      'XLM': '⭐',
      'USDC': '💵',
      'USDT': '💰',
      'AQUA': '🌊',
      'yXLM': '⭐',
      'SRT': '🏢',
      'BTC': '₿',
      'ETH': 'Ξ',
    };
    return icons[assetCode] || '🪙';
  };

  const getTrustlineStatus = (asset: Asset) => {
    if (asset.asset_type === 'native') return 'Native';
    if (!asset.is_authorized) return 'Unauthorized';
    if (!asset.is_authorized_to_maintain_liabilities) return 'Limited';
    return 'Active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Native': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Active': return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'Unauthorized': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'Limited': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  const nonZeroAssets = assets.filter(asset => parseFloat(asset.balance) > 0);
  const zeroAssets = assets.filter(asset => parseFloat(asset.balance) === 0);

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/30">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-primary">
                Token Balances
              </h3>
              <p className="text-sm text-muted-foreground">
                {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsVisible(!isVisible)}
              className="hover:bg-card/50"
            >
              {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchAssets}
              disabled={loading}
              className="hover:bg-card/50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Non-zero balances */}
            {nonZeroAssets.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Active Assets
                </h4>
                {nonZeroAssets.map((asset, index) => (
                  <div
                    key={`${asset.asset_code}-${asset.asset_issuer || 'native'}-${index}`}
                    className="p-4 bg-card/30 border border-border/20 rounded-lg hover:bg-card/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getAssetIcon(asset.asset_code)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{asset.asset_code}</span>
                            <Badge className={`text-xs ${getStatusColor(getTrustlineStatus(asset))}`}>
                              {getTrustlineStatus(asset)}
                            </Badge>
                          </div>
                          {asset.asset_issuer && (
                            <p className="text-xs text-muted-foreground">
                              {formatIssuer(asset.asset_issuer)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-semibold">
                          {isVisible ? formatBalance(asset.balance, asset.asset_code) : '••••••'}
                        </p>
                        {asset.limit && (
                          <p className="text-xs text-muted-foreground">
                            Limit: {isVisible ? formatBalance(asset.limit, asset.asset_code) : '••••••'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Zero balances (trustlines without balance) */}
            {zeroAssets.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Trustlines ({zeroAssets.length})
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {zeroAssets.map((asset, index) => (
                    <div
                      key={`${asset.asset_code}-${asset.asset_issuer || 'native'}-${index}`}
                      className="p-3 bg-card/20 border border-border/10 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{getAssetIcon(asset.asset_code)}</span>
                          <span className="text-sm font-medium">{asset.asset_code}</span>
                          <Badge className={`text-xs ${getStatusColor(getTrustlineStatus(asset))}`}>
                            {getTrustlineStatus(asset)}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">0.00</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Trustline Button */}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={onAddTrustline}
                disabled={!actor || !stellarAddress?.stellar_address}
                className="w-full border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Trustline
              </Button>
            </div>

            {/* Empty State */}
            {assets.length === 0 && !loading && (
              <div className="text-center py-8">
                <Coins className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No assets found</p>
                <p className="text-sm text-muted-foreground/70">
                  Add trustlines to hold different tokens
                </p>
              </div>
            )}
          </>
        )}

        {/* Network Info */}
        <div className="text-center pt-2">
          <Badge variant="outline" className="text-xs">
            {selectedNetwork === "stellar-mainnet" ? "Mainnet" : "Testnet"}
          </Badge>
        </div>
      </div>
    </Card>
  );
};

export default TokenBalances;
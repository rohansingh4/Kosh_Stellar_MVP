import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, Globe, Menu, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";
// Using the new KOSH logo from public directory

interface WalletHeaderProps {
  principal?: any;
  onLogout?: () => void;
  selectedNetwork?: string;
  onNetworkChange?: (network: string) => void;
}

const WalletHeader = ({ principal, onLogout, selectedNetwork = "stellar-testnet", onNetworkChange }: WalletHeaderProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyPrincipal = async () => {
    if (!principal) return;
    
    try {
      const success = await copyToClipboard(principal.toString());
      
      if (success) {
        setCopied(true);
        toast({
          title: "Principal copied!",
          description: "Internet Identity principal copied to clipboard",
        });
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('Copy operation failed');
      }
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy principal. Please copy manually from the settings.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Header Row */}
      <div className="flex items-center justify-between p-6 pb-2">
        {/* Left: RPC/Network Toggle */}
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="hover:bg-card/50 transition-smooth">
            <Globe className="w-6 h-6 text-primary" />
          </Button>
        </div>
        
        {/* Center: KOSH Brand */}
        <div className="flex items-center justify-center">
          <img 
            src="/PHOTO-2025-07-20-01-21-31.jpg" 
            alt="KOSH - The Keyless Holder Wallet" 
            className="h-10 w-auto animate-float shadow-glow"
            onError={(e) => {
              // Fallback to text if image fails to load
              const target = e.currentTarget as HTMLImageElement;
              const fallback = document.createElement('div');
              fallback.className = 'text-primary font-bold text-lg';
              fallback.textContent = 'KOSH';
              target.parentNode?.replaceChild(fallback, target);
            }}
          />
        </div>
        
        {/* Right: Settings */}
        <div className="flex items-center">
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-card/50 transition-smooth">
                <Menu className="w-6 h-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card/95 backdrop-blur-sm border-border/20">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Internet Identity Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Internet Identity</h4>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Your ICP Principal ID:</p>
                    <div className="flex items-center gap-2 p-3 bg-card/30 rounded-lg border border-border/10">
                      <div className="flex-1">
                        <p className="text-primary font-mono text-xs break-all">
                          {principal?.toString() || 'Not connected'}
                        </p>
                      </div>
                      {principal && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyPrincipal}
                          className="shrink-0 hover:bg-primary/10 transition-smooth h-8 w-8"
                        >
                          {copied ? (
                            <Check className="w-3 h-3 text-success" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Logout Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Account</h4>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Disconnect your wallet to return to the login screen
                    </p>
                    {onLogout && (
                      <Button 
                        onClick={() => {
                          onLogout();
                          setShowSettings(false);
                        }}
                        variant="destructive"
                        className="w-full"
                      >
                        Disconnect Wallet
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Network Selector Row */}
      <div className="px-6 pb-2">
        <Select value={selectedNetwork} onValueChange={onNetworkChange}>
          <SelectTrigger className="w-full bg-card/50 backdrop-blur-sm border-border/20 hover:bg-card/70 transition-smooth">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse-glow ${
                selectedNetwork === "stellar-mainnet" ? "bg-crypto-blue" : 
                selectedNetwork === "base-mainnet" ? "bg-blue-500" : "bg-success"
              }`}></span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-sm border-border/20">
            <SelectItem value="stellar-testnet">Stellar Testnet</SelectItem>
            <SelectItem value="stellar-mainnet">Stellar Mainnet</SelectItem>
            <SelectItem value="base-mainnet">Base Mainnet</SelectItem>
            <SelectItem value="ethereum" disabled>Ethereum (Coming Soon)</SelectItem>
            <SelectItem value="polygon" disabled>Polygon (Coming Soon)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default WalletHeader;
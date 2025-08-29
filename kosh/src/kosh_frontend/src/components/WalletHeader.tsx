import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Globe, Menu, Copy, Check, MessageSquare, Star, Info, HelpCircle, Network } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WalletHeaderProps {
  principal?: any;
  onLogout?: () => void;
  selectedNetwork?: string;
  onNetworkChange?: (network: string) => void;
}

const WalletHeader = ({ principal, onLogout, selectedNetwork = "stellar-mainnet", onNetworkChange }: WalletHeaderProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const result = document.execCommand('copy');
        textArea.remove();
        return result;
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  };

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
        
        {/* Center: KOSH Logo */}
        <div className="flex items-center justify-center">
          <img 
            src="/logo-rbg.png" 
            alt="Kosh Stellar Wallet"
            className="h-10 w-auto object-contain animate-float"
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

                {/* Additional Options */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">More</h4>
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm"
                      onClick={() => {
                        // Add about functionality
                        console.log('About clicked');
                        setShowSettings(false);
                      }}
                    >
                      <Info className="w-4 h-4" />
                      About
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm"
                      onClick={() => {
                        // Add help functionality
                        console.log('Help clicked');
                        setShowSettings(false);
                      }}
                    >
                      <HelpCircle className="w-4 h-4" />
                      Help
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm"
                      onClick={() => {
                        // Add network functionality
                        console.log('Network settings clicked');
                        setShowSettings(false);
                      }}
                    >
                      <Network className="w-4 h-4" />
                      Network Settings
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm"
                      onClick={() => window.open('https://mykosh.app/', '_blank', 'noopener,noreferrer')}
                    >
                      <Star className="w-4 h-4" />
                      What's New
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm"
                      onClick={() => {
                        window.location.href = 'mailto:support@mykosh.app?subject=Feedback%20on%20Kosh%20Stellar%20Wallet';
                        setShowSettings(false);
                      }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Leave Feedback
                    </Button>
                  </div>
                </div>

                {/* Logout Section */}
                <div className="space-y-3 pt-4 border-t border-border/10">
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
                selectedNetwork === "stellar-mainnet" ? "bg-crypto-blue" : "bg-success"
              }`}></span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-sm border-border/20">
            <SelectItem value="stellar-testnet">Stellar Testnet</SelectItem>
            <SelectItem value="stellar-mainnet">Stellar Mainnet</SelectItem>
            <SelectItem value="ethereum" disabled>Ethereum (Coming Soon)</SelectItem>
            <SelectItem value="polygon" disabled>Polygon (Coming Soon)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};


export default WalletHeader;
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";

interface AddressDisplayProps {
  stellarAddress?: any;
  walletLoading?: boolean;
  onRetryAddress?: () => Promise<any>;
}

const AddressDisplay = ({ stellarAddress, walletLoading, onRetryAddress }: AddressDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const address = stellarAddress?.stellar_address;
  
  const handleCopy = async () => {
    if (!address) return;
    
    try {
      const success = await copyToClipboard(address);
      
      if (success) {
        setCopied(true);
        toast({
          title: "Address copied!",
          description: "Stellar address copied to clipboard",
        });
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('Copy operation failed');
      }
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy address. Please copy manually from the address shown above.",
        variant: "destructive",
      });
    }
  };

  const handleRetry = async () => {
    if (onRetryAddress) {
      try {
        await onRetryAddress();
        toast({
          title: "Address generation started",
          description: "Please wait while we generate your address",
        });
      } catch (error) {
        toast({
          title: "Retry failed",
          description: "Could not retry address generation",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Card className="p-6 bg-gradient-card backdrop-blur-md border-border/20 shadow-card">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground font-medium">Your Stellar Address:</p>
        <div className="flex items-center gap-3 p-3 bg-card/30 rounded-lg border border-border/10">
          <div className="flex-1">
            {walletLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <p className="text-muted-foreground text-sm">Generating your address...</p>
              </div>
            ) : stellarAddress?.error ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-destructive text-sm font-semibold">{stellarAddress.error}</p>
                  {stellarAddress.details && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                      <p className="text-destructive/80 text-xs whitespace-pre-line">{stellarAddress.details}</p>
                    </div>
                  )}
                  {stellarAddress.suggestion && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                      <p className="text-blue-400 text-xs">💡 {stellarAddress.suggestion}</p>
                    </div>
                  )}
                </div>
                {!stellarAddress.details && (
                  <Button 
                    onClick={handleRetry}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            ) : address ? (
              <p className="text-primary font-mono text-sm break-all">{address}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Address not available</p>
                <Button 
                  onClick={handleRetry}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Generate Address
                </Button>
              </div>
            )}
          </div>
          {address && !walletLoading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="shrink-0 hover:bg-primary/10 transition-smooth"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default AddressDisplay;
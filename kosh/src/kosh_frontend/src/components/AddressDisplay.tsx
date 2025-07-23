import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: "Address copied!",
        description: "Stellar address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy address to clipboard",
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
              <div className="space-y-2">
                <p className="text-destructive text-sm">{stellarAddress.error}</p>
                <Button 
                  onClick={handleRetry}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
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
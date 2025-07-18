import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const AddressDisplay = () => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const address = "GAHN2GQV2HA3ZZ4KLUCGVZZT4RA76VD5WIVBDBWWUER5TIHKUJXY76NR";
  
  const handleCopy = async () => {
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

  return (
    <Card className="p-6 bg-gradient-card backdrop-blur-md border-border/20 shadow-card">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground font-medium">Your Stellar Address:</p>
        <div className="flex items-center gap-3 p-3 bg-card/30 rounded-lg border border-border/10">
          <div className="flex-1">
            <p className="text-primary font-mono text-sm break-all">{address}</p>
          </div>
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
        </div>
      </div>
    </Card>
  );
};

export default AddressDisplay;
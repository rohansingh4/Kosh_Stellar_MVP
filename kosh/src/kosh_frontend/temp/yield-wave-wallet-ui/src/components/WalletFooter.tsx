import { Badge } from "@/components/ui/badge";
import { Shield, Zap } from "lucide-react";

const WalletFooter = () => {
  return (
    <div className="mt-8 p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-crypto-teal animate-float" />
        <Badge variant="outline" className="bg-card/30 backdrop-blur-sm border-border/20 text-muted-foreground">
          <Zap className="w-3 h-3 mr-1 text-primary" />
          Threshold Cryptography Powered
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Truly decentralized wallet powered by Threshold cryptography
      </p>
    </div>
  );
};

export default WalletFooter;
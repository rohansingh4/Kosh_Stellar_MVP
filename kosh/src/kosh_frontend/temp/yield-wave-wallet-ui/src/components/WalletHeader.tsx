import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Menu, Wallet } from "lucide-react";

const WalletHeader = () => {
  return (
    <div className="flex items-center justify-between p-6">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="px-4 py-2 text-sm font-medium bg-card/50 backdrop-blur-sm border-border/20">
          <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse-glow"></span>
          Stellar Testnet
          <ChevronDown className="w-4 h-4 ml-2" />
        </Badge>
      </div>
      
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-crypto-blue bg-clip-text text-transparent">
          KOSH Wallet
        </h1>
        <div className="w-8 h-8 bg-gradient-yield rounded-full flex items-center justify-center animate-float">
          <Wallet className="w-5 h-5 text-background" />
        </div>
      </div>
      
      <Button variant="ghost" size="icon" className="hover:bg-card/50 transition-smooth">
        <Menu className="w-5 h-5" />
      </Button>
    </div>
  );
};

export default WalletHeader;
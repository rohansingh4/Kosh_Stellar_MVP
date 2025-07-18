import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const BalanceDisplay = () => {
  const [isVisible, setIsVisible] = useState(true);
  
  const balance = "10,000.00";
  const usdValue = "$1,200.00";
  const change = "+2.34%";
  const timeframe = "24h";

  return (
    <Card className="p-8 bg-gradient-card backdrop-blur-md border-border/20 shadow-crypto relative overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-glow opacity-30 animate-pulse-glow"></div>
      
      <div className="relative z-10 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="text-5xl font-bold bg-gradient-to-r from-primary to-crypto-blue bg-clip-text text-transparent">
            {isVisible ? balance : "••••••"}
            <span className="text-2xl ml-2 text-crypto-teal">XLM</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVisible(!isVisible)}
            className="hover:bg-card/50 transition-smooth"
          >
            {isVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-card/50 transition-smooth"
          >
            <RefreshCw className="w-5 h-5 hover:animate-spin" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <p className="text-xl text-muted-foreground">≈ {isVisible ? usdValue : "••••••"} USD</p>
          <div className="flex items-center justify-center gap-2">
            <Badge className="bg-success/20 text-success border-success/30 animate-float">
              {change} ({timeframe})
            </Badge>
            <p className="text-sm text-muted-foreground">Data from Mock Data</p>
          </div>
        </div>
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/40 rounded-full animate-particle-float"
            style={{
              left: `${20 + i * 15}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${4 + i * 0.5}s`
            }}
          />
        ))}
      </div>
    </Card>
  );
};

export default BalanceDisplay;
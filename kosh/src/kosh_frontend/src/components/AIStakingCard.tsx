import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bot, Zap, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";

const AIStakingCard = () => {
  const [progress, setProgress] = useState(18);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const newValue = prev + (Math.random() - 0.5) * 0.3;
        return Math.max(17.5, Math.min(18.5, newValue));
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="p-6 bg-gradient-card backdrop-blur-md border-border/20 shadow-card relative overflow-hidden">
      {/* Animated background patterns */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 left-4 w-20 h-20 border border-primary/30 rounded-full animate-spin-slow"></div>
        <div className="absolute bottom-4 right-4 w-16 h-16 border border-crypto-teal/30 rounded-full animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '12s' }}></div>
      </div>
      
      {/* Flowing yield particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-gradient-yield rounded-full animate-yield-flow opacity-60"
            style={{
              top: `${30 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${3 + (i % 2)}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-2 bg-primary/20 rounded-lg">
            <Bot className="w-5 h-5 text-primary animate-float" />
            <Zap className="w-4 h-4 text-crypto-teal animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI Auto-Staking</h3>
            <p className="text-sm text-muted-foreground">Automatic staking & yield optimization</p>
          </div>
        </div>

        {/* Animated progress section */}
        <div className="space-y-4">
          <div className="relative">
            <Progress 
              value={progress} 
              className="h-4 bg-card/50 overflow-hidden"
            />
            {/* Flowing gradient overlay */}
            <div className="absolute inset-0 h-4 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-yield animate-yield-flow opacity-80"
                style={{ 
                  width: `${progress}%`,
                  animationDuration: '2s',
                  animationIterationCount: 'infinite'
                }}
              />
            </div>
            
            {/* Glow effect */}
            <div className="absolute inset-0 h-4 rounded-full bg-gradient-yield opacity-20 animate-pulse-glow"></div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success animate-float" />
              <span className="text-2xl font-bold text-success">{progress.toFixed(1)}% APY</span>
            </div>
            <Badge className="bg-primary/20 text-primary border-primary/30 animate-pulse">
              Active
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/20">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Optimizations</p>
            <p className="text-lg font-semibold text-crypto-teal">247</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Yield Generated</p>
            <p className="text-lg font-semibold text-success">+184 XLM</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Efficiency</p>
            <p className="text-lg font-semibold text-primary">98.5%</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AIStakingCard;
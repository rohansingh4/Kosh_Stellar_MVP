import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  GitBranch,
  Send,
  ArrowDown,
  Repeat
} from "lucide-react";

const ActionButtons = () => {
  const actions = [
    {
      label: "Send",
      icon: Send,
      gradient: "from-crypto-blue to-primary",
      hoverGradient: "hover:from-crypto-blue/80 hover:to-primary/80"
    },
    {
      label: "Receive", 
      icon: ArrowDown,
      gradient: "from-success to-crypto-teal",
      hoverGradient: "hover:from-success/80 hover:to-crypto-teal/80"
    },
    {
      label: "Swap",
      icon: RefreshCw,
      gradient: "from-crypto-teal to-crypto-green",
      hoverGradient: "hover:from-crypto-teal/80 hover:to-crypto-green/80"
    },
    {
      label: "Bridge",
      icon: GitBranch,
      gradient: "from-primary to-crypto-purple",
      hoverGradient: "hover:from-primary/80 hover:to-crypto-purple/80"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action, index) => (
        <Card 
          key={action.label} 
          className="p-6 bg-gradient-card backdrop-blur-md border-border/20 shadow-card hover:shadow-crypto transition-all duration-300 cursor-pointer group relative overflow-hidden"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          {/* Hover glow effect */}
          <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
          
          <div className="relative z-10 flex flex-col items-center gap-3 text-center">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} ${action.hoverGradient} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow`}>
              <action.icon className="w-6 h-6 text-white group-hover:animate-float" />
            </div>
            <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-300">
              {action.label}
            </span>
          </div>
          
          {/* Animated border */}
          <div className="absolute inset-0 rounded-lg border border-transparent bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </Card>
      ))}
    </div>
  );
};

export default ActionButtons;
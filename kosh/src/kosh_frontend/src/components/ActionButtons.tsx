import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  GitBranch,
  Send,
  ArrowDown,
  Repeat,
  Copy,
  Check
} from "lucide-react";

interface ActionButtonsProps {
  stellarAddress?: any;
  onSendTransaction?: (destination: string, amount: string) => Promise<any>;
  onRefreshBalance?: (address?: string) => Promise<string>;
}

const ActionButtons = ({ stellarAddress, onSendTransaction, onRefreshBalance }: ActionButtonsProps) => {
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [sendForm, setSendForm] = useState({ destination: '', amount: '' });
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleSendTransaction = async () => {
    if (!sendForm.destination || !sendForm.amount) {
      toast({
        title: "Invalid input",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!onSendTransaction) {
      toast({
        title: "Transaction not available",
        description: "Send functionality is not connected",
        variant: "destructive",
      });
      return;
    }

    setTransactionLoading(true);
    try {
      const result = await onSendTransaction(sendForm.destination, sendForm.amount);
      
      if (result.success) {
        toast({
          title: "Transaction successful!",
          description: result.message,
        });
        setSendForm({ destination: '', amount: '' });
        setShowSendModal(false);
        
        // Refresh balance after successful transaction
        if (onRefreshBalance) {
          setTimeout(() => onRefreshBalance(), 2000);
        }
      } else {
        toast({
          title: "Transaction failed",
          description: result.message || "Transaction could not be completed",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Transaction error:', error);
      toast({
        title: "Transaction failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!stellarAddress?.stellar_address) return;
    
    try {
      await navigator.clipboard.writeText(stellarAddress.stellar_address);
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

  const showComingSoon = (feature: string) => {
    toast({
      title: "Coming Soon!",
      description: `${feature} functionality will be available soon`,
    });
  };

  const actions = [
    {
      label: "Send",
      icon: Send,
      gradient: "from-crypto-blue to-primary",
      hoverGradient: "hover:from-crypto-blue/80 hover:to-primary/80",
      onClick: () => setShowSendModal(true),
      disabled: !stellarAddress?.stellar_address
    },
    {
      label: "Receive", 
      icon: ArrowDown,
      gradient: "from-success to-crypto-teal",
      hoverGradient: "hover:from-success/80 hover:to-crypto-teal/80",
      onClick: () => setShowReceiveModal(true),
      disabled: !stellarAddress?.stellar_address
    },
    {
      label: "Swap",
      icon: RefreshCw,
      gradient: "from-crypto-teal to-crypto-green",
      hoverGradient: "hover:from-crypto-teal/80 hover:to-crypto-green/80",
      onClick: () => showComingSoon("Swap"),
      disabled: false
    },
    {
      label: "Bridge",
      icon: GitBranch,
      gradient: "from-primary to-crypto-purple",
      hoverGradient: "hover:from-primary/80 hover:to-crypto-purple/80",
      onClick: () => showComingSoon("Bridge"),
      disabled: false
    }
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <Card 
            key={action.label} 
            className={`p-6 bg-gradient-card backdrop-blur-md border-border/20 shadow-card hover:shadow-crypto transition-smooth cursor-pointer group relative overflow-hidden animate-scale-in hover-lift ${
              action.disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ animationDelay: `${index * 0.1}s` }}
            onClick={action.disabled ? undefined : action.onClick}
          >
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-30 transition-smooth animate-shimmer"></div>
            
            <div className="relative z-10 flex flex-col items-center gap-3 text-center">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} ${action.hoverGradient} flex items-center justify-center transition-bounce group-hover:scale-110 animate-pulse-glow`}>
                <action.icon className="w-6 h-6 text-white group-hover:animate-float transition-smooth" />
              </div>
              <span className="font-medium text-foreground group-hover:text-primary transition-smooth">
                {action.label}
              </span>
            </div>
            
            {/* Animated border */}
            <div className="absolute inset-0 rounded-lg border border-transparent bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-smooth"></div>
          </Card>
        ))}
      </div>

      {/* Send Modal */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent className="bg-card/95 backdrop-blur-sm border-border/20">
          <DialogHeader>
            <DialogTitle>Send XLM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="destination">Destination Address</Label>
              <Input
                id="destination"
                value={sendForm.destination}
                onChange={(e) => setSendForm({...sendForm, destination: e.target.value})}
                placeholder="Enter Stellar address"
                className="bg-card/50 border-border/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (XLM)</Label>
              <Input
                id="amount"
                type="number"
                value={sendForm.amount}
                onChange={(e) => setSendForm({...sendForm, amount: e.target.value})}
                placeholder="0.00"
                step="0.0000001"
                min="0"
                className="bg-card/50 border-border/20"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSendModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendTransaction}
                disabled={transactionLoading}
                className="flex-1"
              >
                {transactionLoading ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receive Modal */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className="bg-card/95 backdrop-blur-sm border-border/20">
          <DialogHeader>
            <DialogTitle>Receive XLM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">Share this address to receive XLM:</p>
            <div className="flex items-center gap-3 p-3 bg-card/30 rounded-lg border border-border/10">
              <div className="flex-1">
                <p className="text-primary font-mono text-sm break-all">
                  {stellarAddress?.stellar_address || 'Address not available'}
                </p>
              </div>
              {stellarAddress?.stellar_address && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyAddress}
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
            <Button 
              onClick={() => setShowReceiveModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ActionButtons;
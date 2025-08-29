import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  GitBranch,
  Send,
  ArrowDown,
  Repeat,
  Copy,
  Check,
  ExternalLink,
  CheckCircle,
  ArrowLeftRight
} from "lucide-react";
import SwapComponent from "./SwapComponent";
import TokenBalances from "./TokenBalances";
import TrustlineManager from "./TrustlineManager";

interface ActionButtonsProps {
  stellarAddress?: any;
  onSendTransaction?: (destination: string, amount: string) => Promise<any>;
  onRefreshBalance?: (address?: string) => Promise<string>;
  actor?: any;
  selectedNetwork?: string;
}

const ActionButtons = ({ stellarAddress, onSendTransaction, onRefreshBalance, actor, selectedNetwork }: ActionButtonsProps) => {
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showTokensModal, setShowTokensModal] = useState(false);
  const [showTrustlineModal, setShowTrustlineModal] = useState(false);
  const [sendForm, setSendForm] = useState({ destination: '', amount: '' });
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionProgress, setTransactionProgress] = useState(0);
  const [transactionResult, setTransactionResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Progress simulation effect
  useEffect(() => {
    if (transactionLoading) {
      setTransactionProgress(0);
      setTransactionResult(null);
      const progressInterval = setInterval(() => {
        setTransactionProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 15;
        });
      }, 500);

      return () => clearInterval(progressInterval);
    }
  }, [transactionLoading]);

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
    setTransactionProgress(0);
    setTransactionResult(null);
    
    try {
      const result = await onSendTransaction(sendForm.destination, sendForm.amount);
      setTransactionProgress(100);
      setTransactionResult(result);
      
      if (result.success) {
        toast({
          title: "Transaction successful!",
          description: result.hash ? `Hash: ${result.hash.substring(0, 16)}...` : result.message,
        });
        
        // Don't close modal immediately to show result
        setTimeout(() => {
          setSendForm({ destination: '', amount: '' });
          setTransactionResult(null);
          setShowSendModal(false);
        }, 5000);
      } else {
        toast({
          title: "Transaction failed",
          description: result.message || "Transaction could not be completed",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Transaction error:', error);
      setTransactionProgress(0);
      setTransactionResult({ success: false, message: error.message });
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
      const success = await copyToClipboard(stellarAddress.stellar_address);
      
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
        description: "Could not copy address. Please copy manually from the address shown.",
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
      icon: ArrowLeftRight,
      gradient: "from-purple-500 to-pink-500",
      hoverGradient: "hover:from-purple-500/80 hover:to-pink-500/80",
      onClick: () => setShowSwapModal(true),
      disabled: !stellarAddress?.stellar_address || !actor
    },
    {
      label: "Tokens",
      icon: Repeat,
      gradient: "from-crypto-teal to-crypto-green",
      hoverGradient: "hover:from-crypto-teal/80 hover:to-crypto-green/80",
      onClick: () => setShowTokensModal(true),
      disabled: !stellarAddress?.stellar_address || !actor
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
            className={`p-6 bg-gradient-card backdrop-blur-md border-border/20 shadow-card hover:shadow-crypto transition-all duration-300 cursor-pointer group relative overflow-hidden ${
              action.disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ animationDelay: `${index * 0.1}s` }}
            onClick={action.disabled ? undefined : action.onClick}
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

      {/* Send Modal */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent className="bg-card/95 backdrop-blur-sm border-border/20">
          <DialogHeader>
            <DialogTitle>Send XLM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!transactionResult ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Address</Label>
                  <Input
                    id="destination"
                    value={sendForm.destination}
                    onChange={(e) => setSendForm({...sendForm, destination: e.target.value})}
                    placeholder="Enter Stellar address"
                    className="bg-card/50 border-border/20"
                    disabled={transactionLoading}
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
                    className="bg-card/50 border-border/20 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&]:[-moz-appearance:textfield]"
                    disabled={transactionLoading}
                  />
                </div>
              </>
            ) : null}

            {/* Progress Bar */}
            {transactionLoading && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Processing transaction...</span>
                </div>
                <Progress value={transactionProgress} className="w-full" />
                <p className="text-xs text-center text-muted-foreground">
                  {transactionProgress < 30 ? 'Building transaction...' :
                   transactionProgress < 60 ? 'Signing with threshold cryptography...' :
                   transactionProgress < 90 ? 'Submitting to Stellar network...' :
                   'Finalizing...'}
                </p>
              </div>
            )}

            {/* Transaction Result */}
            {transactionResult && (
              <div className="space-y-4">
                {transactionResult.success ? (
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span className="font-semibold text-success">Transaction Successful!</span>
                    </div>
                    
                    <div className="space-y-2">
                      {transactionResult.hash ? (
                        <>
                          <p className="text-sm text-muted-foreground">Transaction Hash:</p>
                          <div className="bg-card/30 rounded p-2">
                            <p className="font-mono text-xs break-all text-primary">
                              {transactionResult.hash}
                            </p>
                          </div>
                          
                          {transactionResult.explorer_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(transactionResult.explorer_url, '_blank')}
                              className="w-full"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View on Stellar Explorer
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">Transaction Details:</p>
                          <div className="bg-card/30 rounded p-2 max-h-32 overflow-y-auto">
                            <p className="font-mono text-xs break-all text-primary">
                              {transactionResult.raw_response || 'Transaction completed successfully'}
                            </p>
                          </div>
                          <p className="text-xs text-warning">
                            Hash may appear in network explorer shortly
                          </p>
                        </>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      Modal will close automatically in a few seconds...
                    </p>
                  </div>
                ) : (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-destructive">❌</span>
                      <span className="font-semibold text-destructive">Transaction Failed</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {transactionResult.message}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!transactionResult && (
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSendModal(false)}
                  className="flex-1"
                  disabled={transactionLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendTransaction}
                  disabled={transactionLoading || !sendForm.destination || !sendForm.amount}
                  className="flex-1"
                >
                  {transactionLoading ? 'Sending...' : 'Send'}
                </Button>
              </div>
            )}
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

      {/* Swap Modal */}
      <Dialog open={showSwapModal} onOpenChange={setShowSwapModal}>
        <DialogContent className="bg-card/95 backdrop-blur-sm border-border/20 max-w-md">
          <DialogHeader>
            <DialogTitle>Token Swap</DialogTitle>
          </DialogHeader>
          <SwapComponent
            actor={actor}
            stellarAddress={stellarAddress}
            selectedNetwork={selectedNetwork}
            onSwapComplete={() => {
              setShowSwapModal(false);
              // Refresh balance after swap
              if (onRefreshBalance) {
                onRefreshBalance();
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Token Balances Modal */}
      <Dialog open={showTokensModal} onOpenChange={setShowTokensModal}>
        <DialogContent className="bg-card/95 backdrop-blur-sm border-border/20 max-w-lg">
          <DialogHeader>
            <DialogTitle>Token Balances</DialogTitle>
          </DialogHeader>
          <TokenBalances
            actor={actor}
            stellarAddress={stellarAddress}
            selectedNetwork={selectedNetwork}
            onAddTrustline={() => {
              setShowTokensModal(false);
              setShowTrustlineModal(true);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Trustline Manager Modal */}
      <Dialog open={showTrustlineModal} onOpenChange={setShowTrustlineModal}>
        <DialogContent className="bg-card/95 backdrop-blur-sm border-border/20 max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Trustlines</DialogTitle>
          </DialogHeader>
          <TrustlineManager
            actor={actor}
            stellarAddress={stellarAddress}
            selectedNetwork={selectedNetwork}
            onTrustlineChange={() => {
              setShowTrustlineModal(false);
              // Refresh token balances if they're open
              if (onRefreshBalance) {
                onRefreshBalance();
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ActionButtons;
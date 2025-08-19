import WalletHeader from "@/components/WalletHeader";
import AddressDisplay from "@/components/AddressDisplay";
import BalanceDisplay from "@/components/BalanceDisplay";
import AIStakingCard from "@/components/AIStakingCard";
import ActionButtons from "@/components/ActionButtons";
import WalletFooter from "@/components/WalletFooter";

interface AuthData {
  principal: any;
  actor: any;
  walletLoading: boolean;
  stellarAddress: any;
  logout: () => void;
  getStellarAddress: () => Promise<any>;
  buildAndSubmitTransaction: (destination: string, amount: string) => Promise<any>;
  getAccountBalance: (address?: string) => Promise<string>;
  selectedNetwork: string;
  onNetworkChange: (network: string) => void;
}

interface PriceData {
  data: any;
  loading: boolean;
  refresh: () => void;
  formatUsdValue: (price: number, amount: number) => string;
  formatPercentChange: (change: number) => string;
}

interface IndexProps {
  authData: AuthData;
  priceData: PriceData;
}

const Index = ({ authData, priceData }: IndexProps) => {
  return (
    <div className="min-h-screen bg-gradient-main relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-glow opacity-20"></div>
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-crypto-teal/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      
      {/* Main content */}
      <div className="relative z-10 max-w-md mx-auto">
        <WalletHeader 
          principal={authData.principal}
          onLogout={authData.logout}
          selectedNetwork={authData.selectedNetwork}
          onNetworkChange={authData.onNetworkChange}
        />
        
        <div className="px-6 space-y-6">
          <AddressDisplay 
            stellarAddress={authData.stellarAddress}
            walletLoading={authData.walletLoading}
            onRetryAddress={authData.getStellarAddress}
          />
          <BalanceDisplay 
            stellarAddress={authData.stellarAddress}
            onGetBalance={authData.getAccountBalance}
            priceData={priceData.data}
            priceLoading={priceData.loading}
            formatUsdValue={priceData.formatUsdValue}
            formatPercentChange={priceData.formatPercentChange}
            selectedNetwork={authData.selectedNetwork}
          />
          <AIStakingCard />
          <ActionButtons 
            stellarAddress={authData.stellarAddress}
            onSendTransaction={authData.buildAndSubmitTransaction}
            onRefreshBalance={authData.getAccountBalance}
            actor={authData.actor}
            selectedNetwork={authData.selectedNetwork}
          />
        </div>
        
        <WalletFooter />
      </div>
    </div>
  );
};

export default Index;

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
  // Check if running in extension context
  const isExtension = typeof (window as any).chrome !== 'undefined' && 
                      (window as any).chrome.runtime && 
                      (window as any).chrome.runtime.id;
  
  return (
    <div className={`${isExtension ? 'w-[400px] h-[600px]' : 'min-h-screen'} bg-gradient-main relative overflow-hidden animate-fade-in`}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-glow opacity-20 animate-pulse-glow"></div>
      {!isExtension && (
        <>
          <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-crypto-teal/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </>
      )}
      
      {/* Main content */}
      <div className={`relative z-10 max-w-md mx-auto ${isExtension ? 'h-full overflow-y-auto custom-scrollbar smooth-scroll' : ''}`}>
        <div className="animate-slide-in-up">
          <WalletHeader 
            principal={authData.principal}
            onLogout={authData.logout}
          />
        </div>
        
        <div className="px-6 space-y-6">
          <div className="animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
            <AddressDisplay 
              stellarAddress={authData.stellarAddress}
              walletLoading={authData.walletLoading}
              onRetryAddress={authData.getStellarAddress}
            />
          </div>
          <div className="animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
            <BalanceDisplay 
              stellarAddress={authData.stellarAddress}
              onGetBalance={authData.getAccountBalance}
              priceData={priceData.data}
              priceLoading={priceData.loading}
              formatUsdValue={priceData.formatUsdValue}
              formatPercentChange={priceData.formatPercentChange}
            />
          </div>
          <div className="animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
            <AIStakingCard />
          </div>
          <div className="animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
            <ActionButtons 
              stellarAddress={authData.stellarAddress}
              onSendTransaction={authData.buildAndSubmitTransaction}
              onRefreshBalance={authData.getAccountBalance}
            />
          </div>
        </div>
        
        <div className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <WalletFooter />
        </div>
      </div>
    </div>
  );
};

export default Index;

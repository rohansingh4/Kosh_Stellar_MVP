import WalletHeader from "@/components/WalletHeader";
import AddressDisplay from "@/components/AddressDisplay";
import BalanceDisplay from "@/components/BalanceDisplay";
import AIStakingCard from "@/components/AIStakingCard";
import ActionButtons from "@/components/ActionButtons";
import WalletFooter from "@/components/WalletFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-main relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-glow opacity-20"></div>
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-crypto-teal/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      
      {/* Main content */}
      <div className="relative z-10 max-w-md mx-auto">
        <WalletHeader />
        
        <div className="px-6 space-y-6">
          <AddressDisplay />
          <BalanceDisplay />
          <AIStakingCard />
          <ActionButtons />
        </div>
        
        <WalletFooter />
      </div>
    </div>
  );
};

export default Index;

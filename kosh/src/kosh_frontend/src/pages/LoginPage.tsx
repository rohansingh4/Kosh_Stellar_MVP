import { Button } from "@/components/ui/button";
import { useEffect } from "react";
// Using the new KOSH logo from public directory

interface LoginPageProps {
  onLogin: (authMethod?: string) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  // Always use Internet Identity 2.0
  useEffect(() => {
    localStorage.setItem('FORCE_II_2_0', 'true');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-main relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-glow opacity-20"></div>
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-crypto-teal/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      
      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6">
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Logo */}
          <div className="space-y-6">
            <div className="mx-auto w-24 h-24 bg-gradient-to-r from-primary to-crypto-teal rounded-xl flex items-center justify-center animate-pulse-glow p-2">
              <img 
                src="/PHOTO-2025-07-20-01-21-31.jpg" 
                alt="KOSH - The Keyless Holder Wallet" 
                className="w-20 h-16 object-contain"
                onError={(e) => {
                  // Fallback to text if image doesn't load
                  const target = e.currentTarget as HTMLImageElement;
                  const sibling = target.nextElementSibling as HTMLElement;
                  target.style.display = 'none';
                  if (sibling) sibling.style.display = 'block';
                }}
              />
              <div className="text-2xl font-bold text-white hidden">KOSH</div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-white">KOSH Wallet</h1>
              <p className="text-gray-300 text-lg">
                Your keyless crypto wallet powered by Internet Identity 2.0 and threshold cryptography
              </p>
            </div>
          </div>

          {/* Internet Identity 2.0 Info */}
          <div className="bg-crypto-teal/10 border border-crypto-teal/20 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-crypto-teal text-xl">✨</span>
              <div className="text-sm text-crypto-teal">
                <div className="font-semibold">Internet Identity 2.0</div>
                <div className="text-xs text-crypto-teal/80">Secure passkey authentication</div>
              </div>
            </div>
          </div>

          {/* Authentication Options */}
          <div className="space-y-4">

            {/* Internet Identity Login with Passkey */}
            <Button 
              onClick={() => onLogin('passkey')}
              className="w-full bg-gradient-to-r from-primary to-crypto-teal hover:from-primary/90 hover:to-crypto-teal/90 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105"
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-xl">🔐</span>
                <span>Connect with Passkey</span>
              </div>
            </Button>
          </div>

          {/* Footer */}
          <div className="pt-8 space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <img 
                src="/logo2.svg" 
                alt="Internet Computer" 
                className="w-6 h-6"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="text-gray-400 text-sm">Powered by Internet Computer</p>
            </div>
            
            <div className="text-xs text-gray-500 max-w-sm mx-auto">
              <p className="flex items-center justify-center space-x-1">
                <span>🔒</span>
                <span>Truly decentralized wallet powered by Threshold cryptography</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
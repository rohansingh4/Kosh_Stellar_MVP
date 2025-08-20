import { Button } from "@/components/ui/button";
import koshLogo from "@/assets/kosh-logo-final.png";

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  // Check if running in extension context
  const isExtension = typeof (window as any).chrome !== 'undefined' && 
                      (window as any).chrome.runtime && 
                      (window as any).chrome.runtime.id;
  
  return (
    <div className={`${isExtension ? 'w-[400px] h-[600px]' : 'min-h-screen'} bg-gradient-main relative overflow-hidden`}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-glow opacity-20"></div>
      {!isExtension && (
        <>
          <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-crypto-teal/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </>
      )}
      
      {/* Main content */}
      <div className={`relative z-10 flex items-center justify-center ${isExtension ? 'h-full' : 'min-h-screen'} ${isExtension ? 'px-4 py-4' : 'px-6'}`}>
        <div className="max-w-md w-full space-y-6 text-center">
          {/* Logo */}
          <div className={isExtension ? 'space-y-3' : 'space-y-6'}>
            <div className={`mx-auto ${isExtension ? 'w-16 h-16' : 'w-20 h-20'} bg-gradient-to-r from-primary to-crypto-teal rounded-full flex items-center justify-center animate-pulse-glow`}>
              <img 
                src={koshLogo} 
                alt="KOSH Logo" 
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  // Fallback to text if image doesn't load
                  const target = e.currentTarget as HTMLImageElement;
                  const sibling = target.nextElementSibling as HTMLElement;
                  target.style.display = 'none';
                  if (sibling) sibling.style.display = 'block';
                }}
              />
              <div className="text-2xl font-bold text-white hidden">K</div>
            </div>
            
            <div className={isExtension ? 'space-y-1' : 'space-y-2'}>
              <h1 className={`${isExtension ? 'text-2xl' : 'text-4xl'} font-bold text-white`}>KOSH Wallet</h1>
              <p className={`text-gray-300 ${isExtension ? 'text-sm' : 'text-lg'}`}>
                Your keyless crypto wallet powered by Internet Identity and threshold cryptography
              </p>
            </div>
          </div>

          {/* Authentication Options */}
          <div className={isExtension ? 'space-y-3' : 'space-y-4'}>
            {/* Social Login Options - Coming Soon - Hide in extension for space */}
            {!isExtension && (
              <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 relative opacity-60 cursor-not-allowed"
                disabled
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continue with Google</span>
                </div>
                <div className="absolute top-0 right-0 -mt-1 -mr-1 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
                  Coming Soon
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 relative opacity-60 cursor-not-allowed"
                disabled
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span>Continue with Apple</span>
                </div>
                <div className="absolute top-0 right-0 -mt-1 -mr-1 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
                  Coming Soon
                </div>
              </Button>
              </div>
            )}

            {/* Divider - Hide in extension for space */}
            {!isExtension && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-gray-300">or</span>
                </div>
              </div>
            )}

            {/* Internet Identity Login */}
            <Button 
              onClick={onLogin}
              className="w-full bg-gradient-to-r from-primary to-crypto-teal hover:from-primary/90 hover:to-crypto-teal/90 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105"
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-xl">🔐</span>
                <span>Connect with Internet Identity</span>
              </div>
            </Button>
          </div>

          {/* Footer - Compact for extension */}
          <div className={`${isExtension ? 'pt-4 space-y-2' : 'pt-8 space-y-4'}`}>
            <div className="flex items-center justify-center space-x-2">
              <img 
                src="/logo2.svg" 
                alt="Internet Computer" 
                className="w-6 h-6"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className={`text-gray-400 ${isExtension ? 'text-xs' : 'text-sm'}`}>Powered by Internet Computer</p>
            </div>
            
            {!isExtension && (
              <div className="text-xs text-gray-500 max-w-sm mx-auto">
                <p className="flex items-center justify-center space-x-1">
                  <span>🔒</span>
                  <span>Truly decentralized wallet powered by Threshold cryptography</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
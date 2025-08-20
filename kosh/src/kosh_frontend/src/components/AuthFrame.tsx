import React, { useEffect, useRef, useState } from 'react';

interface AuthFrameProps {
  authUrl: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AuthFrame: React.FC<AuthFrameProps> = ({ authUrl, onSuccess, onCancel }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Check if message is from Internet Identity
      if (event.origin.includes('localhost:4943') || 
          event.origin.includes('.ic0.app') || 
          event.origin.includes('.icp0.io')) {
        
        if (event.data && event.data.kind === 'authorize-ready') {
          // Authentication successful
          onSuccess();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onSuccess]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Internet Identity Login</h2>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md"
        >
          Cancel
        </button>
      </div>
      
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading Internet Identity...</span>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        src={authUrl}
        className="flex-1 w-full border-none"
        onLoad={handleIframeLoad}
        title="Internet Identity Authentication"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};

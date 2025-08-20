import { useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { createActor } from 'declarations/kosh_backend';
import { fetchStellarBalance } from './priceApi';

// Define canister IDs directly to avoid environment variable issues
const CANISTER_IDS = {
  INTERNET_IDENTITY: 'rdmx6-jaaaa-aaaaa-aaadq-cai',
  BACKEND: 'uxrrr-q7777-77774-qaaaq-cai',
  FRONTEND: 'u6s2n-gx777-77774-qaaba-cai'
};

// Detect if we're on the canister URL, localhost, or extension
const getHost = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Check if running in Chrome extension
    if (window.location.protocol === 'chrome-extension:') {
      // For extension, use localhost for development or IC mainnet for production
      return 'http://localhost:4943';
    }
    
    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      return 'http://localhost:4943';
    } else {
      // We're on the canister URL, use the same host
      return window.location.origin;
    }
  }
  return 'http://localhost:4943';
};

const HOST = getHost();

export const useAuth = () => {
  const [authClient, setAuthClient] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState(null);
  const [actor, setActor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stellarAddress, setStellarAddress] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // Load cached address for the current user when authenticated
  useEffect(() => {
    if (principal) {
      const cacheKey = `kosh_stellar_address_${principal.toString()}`;
      const cachedAddress = localStorage.getItem(cacheKey);
      
      // Also check old cache format as fallback (from yesterday)
      const oldCacheKey = 'kosh_stellar_address';
      const oldCachedAddress = localStorage.getItem(oldCacheKey);
      
      if (cachedAddress) {
        try {
          const parsed = JSON.parse(cachedAddress);
          setStellarAddress(parsed);
          console.log('Loaded cached address for user:', principal.toString(), parsed.stellar_address);
        } catch (error) {
          console.warn('Failed to parse cached address:', error);
          localStorage.removeItem(cacheKey);
        }
      } else if (oldCachedAddress) {
        try {
          const parsed = JSON.parse(oldCachedAddress);
          setStellarAddress(parsed);
          // Migrate to new format
          localStorage.setItem(cacheKey, oldCachedAddress);
          localStorage.removeItem(oldCacheKey);
          console.log('Migrated old cached address for user:', principal.toString(), parsed.stellar_address);
        } catch (error) {
          console.warn('Failed to parse old cached address:', error);
          localStorage.removeItem(oldCacheKey);
        }
      }
    }
  }, [principal]);

  useEffect(() => {
    const initAuthClient = async () => {
      try {
        console.log('Initializing auth client...');
        const client = await AuthClient.create();
        setAuthClient(client);
        
        const isAuthenticated = await client.isAuthenticated();
        console.log('Authentication status:', isAuthenticated);
        
        if (isAuthenticated) {
          console.log('User is authenticated, setting up actor...');
          const identity = client.getIdentity();
          const userPrincipal = identity.getPrincipal();
          console.log('Principal:', userPrincipal.toString());
          
          setPrincipal(userPrincipal);
          setIsAuthenticated(true);
          
          // Determine the correct host for the actor based on context
          const isExtension = window.location.protocol === 'chrome-extension:';
          const actorHost = isExtension ? 'http://localhost:4943' : HOST;
          
          // Create authenticated actor
          const authenticatedActor = createActor(CANISTER_IDS.BACKEND, {
            agentOptions: {
              identity,
              host: actorHost
            },
          });
          console.log('Actor created successfully');
          setActor(authenticatedActor);
          
          // Auto-generate address if not cached for this user
          const userPrincipalStr = userPrincipal.toString();
          const cacheKey = `kosh_stellar_address_${userPrincipalStr}`;
          const cachedAddress = localStorage.getItem(cacheKey);
          console.log('Cache key:', cacheKey);
          console.log('Cached address:', cachedAddress ? 'Found' : 'Not found');
          
          if (!cachedAddress) {
            console.log('No cached address found for user, generating new address...');
            // Use setTimeout to ensure actor is set
            setTimeout(() => {
              generateStellarAddressAuto(authenticatedActor, userPrincipalStr);
            }, 100);
          } else {
            console.log('Using cached address');
          }
        } else {
          console.log('User is not authenticated');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };
    initAuthClient();
  }, []);

  const login = async () => {
    if (!authClient) return;
    
    try {
      setLoading(true);
      
      // Check if running in extension context
      const isExtension = typeof window.chrome !== 'undefined' && 
                          window.chrome.runtime && 
                          window.chrome.runtime.id;
      
      if (isExtension) {
        // For extension, use a more controlled approach to keep popup open
        await authClient.login({
          identityProvider: HOST.includes('localhost') || HOST.includes('chrome') 
            ? `http://${CANISTER_IDS.INTERNET_IDENTITY}.localhost:4943`
            : `${HOST}?canisterId=${CANISTER_IDS.INTERNET_IDENTITY}`,
          windowOpenerFeatures: "width=500,height=600,left=200,top=200,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no",
          onSuccess: async () => {
            // Ensure we complete authentication and keep the extension popup open
            await completeAuthentication();
            // Store authentication success in extension storage to persist state
            if (window.chrome && window.chrome.storage) {
              await window.chrome.storage.local.set({ 'kosh_authenticated': true });
            }
            // Focus back to the extension popup if possible
            if (window.focus) {
              window.focus();
            }
          },
          onError: (error) => {
            console.error('Authentication failed:', error);
            setLoading(false);
          }
        });
      } else {
        // Standard web app flow
        await authClient.login({
          identityProvider: HOST.includes('localhost') || HOST.includes('chrome') 
            ? `http://${CANISTER_IDS.INTERNET_IDENTITY}.localhost:4943`
            : `${HOST}?canisterId=${CANISTER_IDS.INTERNET_IDENTITY}`,
          windowOpenerFeatures: "width=500,height=600,left=100,top=100,scrollbars=yes,resizable=yes",
          onSuccess: completeAuthentication,
          onError: (error) => {
            console.error('Authentication failed:', error);
            setLoading(false);
          }
        });
      }
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
    }
  };

  const completeAuthentication = async () => {
    try {
      const identity = authClient.getIdentity();
      setPrincipal(identity.getPrincipal());
      setIsAuthenticated(true);
      
      // Determine the correct host for the actor based on context
      const isExtension = window.location.protocol === 'chrome-extension:';
      const actorHost = isExtension ? 'http://localhost:4943' : HOST;
      
      // Create authenticated actor
      const authenticatedActor = createActor(CANISTER_IDS.BACKEND, {
        agentOptions: {
          identity,
          host: actorHost
        },
      });
      setActor(authenticatedActor);
      
      // Auto-generate address if not cached for this user
      const userPrincipal = identity.getPrincipal().toString();
      const cacheKey = `kosh_stellar_address_${userPrincipal}`;
      const cachedAddress = localStorage.getItem(cacheKey);
      if (!cachedAddress) {
        console.log('No cached address found for user, generating new address...');
        // Use setTimeout to ensure actor is set
        setTimeout(() => {
          generateStellarAddressAuto(authenticatedActor, userPrincipal);
        }, 100);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Authentication completion failed:', error);
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!authClient) return;
    
    try {
      setLoading(true);
      await authClient.logout();
      
      // Clear cached address for this user before clearing principal
      if (principal) {
        const userPrincipal = principal.toString();
        const cacheKey = `kosh_stellar_address_${userPrincipal}`;
        localStorage.removeItem(cacheKey);
      }
      
      // Clear extension storage if in extension context
      if (window.chrome && window.chrome.storage) {
        await window.chrome.storage.local.remove('kosh_authenticated');
      }
      
      setPrincipal(null);
      setIsAuthenticated(false);
      setActor(null);
      setStellarAddress('');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateStellarAddressAuto = async (actorInstance = null, userPrincipal = null) => {
    const currentActor = actorInstance || actor;
    const currentPrincipal = userPrincipal || principal?.toString();
    
    if (!currentActor) {
      console.warn('No actor available for address generation');
      return;
    }
    
    if (!currentPrincipal) {
      console.warn('No principal available for address caching');
      return;
    }
    
    setWalletLoading(true);
    try {
      console.log('Generating Stellar address...', {
        host: HOST,
        canisterId: CANISTER_IDS.BACKEND,
        principal: currentPrincipal
      });
      
      console.log('Calling public_key_stellar...');
      const result = await currentActor.public_key_stellar();
      console.log('Backend response:', result);
      
      if (result.Ok) {
        const address = result.Ok;
        const addressData = { stellar_address: address };
        setStellarAddress(addressData);
        
        // Cache the address in localStorage with user-specific key
        const cacheKey = `kosh_stellar_address_${currentPrincipal}`;
        localStorage.setItem(cacheKey, JSON.stringify(addressData));
        console.log('Address generated and cached for user:', currentPrincipal, address);
        
        return addressData;
      } else {
        console.error('Backend returned error:', result.Err);
        throw new Error(result.Err);
      }
    } catch (error) {
      console.error('Failed to generate Stellar address:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Set error state to show user
      setStellarAddress({ error: `Failed to generate address: ${error.message}` });
    } finally {
      setWalletLoading(false);
    }
  };

  const getStellarAddress = async () => {
    if (!actor) throw new Error('Not authenticated');
    if (!principal) throw new Error('No principal available');
    
    // Check cache first
    const cacheKey = `kosh_stellar_address_${principal.toString()}`;
    const cachedAddress = localStorage.getItem(cacheKey);
    if (cachedAddress) {
      try {
        const parsed = JSON.parse(cachedAddress);
        setStellarAddress(parsed);
        return parsed;
      } catch (error) {
        console.warn('Failed to parse cached address, regenerating...');
        localStorage.removeItem(cacheKey);
      }
    }
    
    // Generate new address
    return await generateStellarAddressAuto();
  };

  const buildAndSubmitTransaction = async (destinationAddress, amount) => {
    if (!actor) throw new Error('Not authenticated');
    
    try {
      // Convert amount to u64 format (whole XLM units)
      const amountU64 = BigInt(Math.floor(parseFloat(amount)));
      
      const result = await actor.build_stellar_transaction(destinationAddress, amountU64);
      if (result.Ok) {
        return {
          success: true,
          message: 'Transaction built, signed, and submitted successfully!',
          details: result.Ok
        };
      } else {
        throw new Error(result.Err);
      }
    } catch (error) {
      console.error('Failed to build and submit transaction:', error);
      throw error;
    }
  };

  const getAccountBalance = async (address) => {
    const addressToUse = address || stellarAddress?.stellar_address;
    
    if (!addressToUse) {
      throw new Error('No Stellar address available');
    }
    
    try {
      console.log('Fetching balance for address:', addressToUse);
      const balance = await fetchStellarBalance(addressToUse);
      console.log('Balance fetched successfully:', balance);
      return balance;
    } catch (error) {
      console.error('Failed to get account balance:', error);
      throw error;
    }
  };

  return {
    isAuthenticated,
    principal,
    actor,
    loading,
    walletLoading,
    stellarAddress,
    login,
    logout,
    getStellarAddress,
    buildAndSubmitTransaction,
    getAccountBalance,
  };
}; 
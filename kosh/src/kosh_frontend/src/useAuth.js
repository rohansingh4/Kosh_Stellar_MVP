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

// Detect if we're on the canister URL or localhost
const getHost = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
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
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('Initializing auth client...');
      const client = await AuthClient.create();
      setAuthClient(client);
      
      const isAuth = await client.isAuthenticated();
      console.log('Authentication status:', isAuth);
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        console.log('User is authenticated, setting up actor...');
        const identity = client.getIdentity();
        const userPrincipal = identity.getPrincipal();
        setPrincipal(userPrincipal);
        console.log('Principal:', userPrincipal.toString());
        
        // Create authenticated actor
        const authenticatedActor = createActor(CANISTER_IDS.BACKEND, {
          agentOptions: {
            identity,
            host: HOST
          },
        });
        setActor(authenticatedActor);
        console.log('Actor created successfully');
        
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

  const login = async () => {
    if (!authClient) return;
    
    try {
      setLoading(true);
      
      // Use standard AuthClient login for both extension and web
      await authClient.login({
        identityProvider: HOST.includes('localhost') 
          ? `http://${CANISTER_IDS.INTERNET_IDENTITY}.localhost:4943`
          : `${HOST}?canisterId=${CANISTER_IDS.INTERNET_IDENTITY}`,
        windowOpenerFeatures: "width=400,height=500,left=100,top=100,scrollbars=yes,resizable=yes",
        onSuccess: completeAuthentication,
        onError: (error) => {
          console.error('Authentication failed:', error);
          setLoading(false);
        }
      });
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
      
      // Create authenticated actor
      const authenticatedActor = createActor(CANISTER_IDS.BACKEND, {
        agentOptions: {
          identity,
          host: HOST
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
        const cacheKey = `kosh_stellar_address_${principal.toString()}`;
        localStorage.removeItem(cacheKey);
      }
      
      setIsAuthenticated(false);
      setPrincipal(null);
      setActor(null);
      setStellarAddress(null);
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
import { useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { createActor, CANISTER_IDS, HOST } from '@/lib/actor';
import { _SERVICE } from '@/types/backend';

interface StellarAddress {
  stellar_address: string;
}

interface AuthState {
  authClient: AuthClient | null;
  isAuthenticated: boolean;
  principal: Principal | null;
  identity: Identity | null;
  actor: _SERVICE | null;
  loading: boolean;
  walletLoading: boolean;
  stellarAddress: StellarAddress | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    authClient: null,
    isAuthenticated: false,
    principal: null,
    identity: null,
    actor: null,
    loading: true,
    walletLoading: false,
    stellarAddress: null,
  });

  // Load cached address for the current user when authenticated
  useEffect(() => {
    if (authState.principal) {
      const cacheKey = `kosh_stellar_address_${authState.principal.toString()}`;
      const cachedAddress = localStorage.getItem(cacheKey);
      
      if (cachedAddress) {
        try {
          const parsed = JSON.parse(cachedAddress);
          setAuthState(prev => ({ ...prev, stellarAddress: parsed }));
          console.log('Loaded cached address for user:', authState.principal.toString(), parsed.stellar_address);
        } catch (error) {
          console.warn('Failed to parse cached address:', error);
          localStorage.removeItem(cacheKey);
        }
      }
    }
  }, [authState.principal]);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('Initializing auth client...');
      const client = await AuthClient.create({
        idleOptions: {
          disableIdle: false,
          idleTimeout: 30 * 60 * 1000, // 30 minutes
          disableDefaultIdleCallback: false
        }
      });
      
      const isAuth = await client.isAuthenticated();
      console.log('Authentication status:', isAuth);
      
      setAuthState(prev => ({ ...prev, authClient: client, isAuthenticated: isAuth }));
      
      if (isAuth) {
        console.log('User is authenticated, setting up actor...');
        const identity = client.getIdentity();
        const userPrincipal = identity.getPrincipal();
        
        console.log('Principal:', userPrincipal.toString());
        
        // Create authenticated actor
        const authenticatedActor = createActor(CANISTER_IDS.BACKEND, {
          identity,
        });
        
        setAuthState(prev => ({
          ...prev,
          identity,
          principal: userPrincipal,
          actor: authenticatedActor,
        }));
        
        console.log('Actor created successfully');
        
        // Auto-generate address if not cached for this user
        const userPrincipalStr = userPrincipal.toString();
        const cacheKey = `kosh_stellar_address_${userPrincipalStr}`;
        const cachedAddress = localStorage.getItem(cacheKey);
        
        if (!cachedAddress) {
          console.log('No cached address found for user, generating new address...');
          setTimeout(() => {
            generateStellarAddress(authenticatedActor, userPrincipalStr);
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

  const login = async (authMethod = 'passkey') => {
    if (!authState.authClient) return;
    
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      // Configure login options based on auth method
      // Force Internet Identity 2.0 for testing (you can set FORCE_II_2_0=true in localStorage to test)
      const forceII20 = localStorage.getItem('FORCE_II_2_0') === 'true';
      
      // Important: II 2.0 (id.ai) only works with deployed canisters on IC mainnet
      // For local development, we should warn users about limitations
      if (forceII20 && HOST.includes('localhost')) {
        console.warn('⚠️ Warning: Using II 2.0 with local development environment may cause certificate verification errors');
        console.warn('💡 Recommendation: Deploy your backend to IC mainnet for full II 2.0 compatibility');
      }
      
      const identityProvider = forceII20 
        ? `https://id.ai`
        : (HOST.includes('localhost') 
          ? `http://${CANISTER_IDS.INTERNET_IDENTITY}.localhost:4943`
          : `https://id.ai`);
      
      console.log('Using Identity Provider:', identityProvider);
      console.log('Force II 2.0 mode:', forceII20);
      
      const loginOptions = {
        identityProvider: identityProvider,
        maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 7 days in nanoseconds
        onSuccess: async () => {
          const identity = authState.authClient!.getIdentity();
          const userPrincipal = identity.getPrincipal();
          
          // Create authenticated actor
          const authenticatedActor = createActor(CANISTER_IDS.BACKEND, {
            identity,
          });
          
          setAuthState(prev => ({
            ...prev,
            isAuthenticated: true,
            identity,
            principal: userPrincipal,
            actor: authenticatedActor,
          }));
          
          // Auto-generate address if not cached for this user
          const userPrincipalStr = userPrincipal.toString();
          const cacheKey = `kosh_stellar_address_${userPrincipalStr}`;
          const cachedAddress = localStorage.getItem(cacheKey);
          if (!cachedAddress) {
            console.log('No cached address found for user, generating new address...');
            setTimeout(() => {
              generateStellarAddress(authenticatedActor, userPrincipalStr);
            }, 100);
          }
        },
      };

      // Add Google-specific configuration if using Google auth
      if (authMethod === 'google') {
        loginOptions.derivationOrigin = window.location.origin;
        loginOptions.windowOpenerFeatures = 'width=500,height=600,scrollbars=yes,resizable=yes';
      }

      await authState.authClient.login(loginOptions);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

  const logout = async () => {
    if (!authState.authClient) return;
    
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      await authState.authClient.logout();
      
      // Clear cached address for this user
      if (authState.principal) {
        const cacheKey = `kosh_stellar_address_${authState.principal.toString()}`;
        localStorage.removeItem(cacheKey);
      }
      
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        principal: null,
        identity: null,
        actor: null,
        stellarAddress: null,
      }));
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

  const generateStellarAddress = async (actorInstance?: _SERVICE, userPrincipal?: string) => {
    const currentActor = actorInstance || authState.actor;
    const currentPrincipal = userPrincipal || authState.principal?.toString();
    
    if (!currentActor) {
      console.warn('No actor available for address generation');
      return;
    }
    
    if (!currentPrincipal) {
      console.warn('No principal available for address caching');
      return;
    }
    
    setAuthState(prev => ({ ...prev, walletLoading: true }));
    try {
      console.log('Generating Stellar address...');
      
      const result = await currentActor.public_key_stellar();
      console.log('Backend response:', result);
      
      if ('Ok' in result) {
        const address = result.Ok;
        const addressData = { stellar_address: address };
        
        setAuthState(prev => ({ ...prev, stellarAddress: addressData }));
        
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
      setAuthState(prev => ({
        ...prev,
        stellarAddress: { stellar_address: `Error: ${error}` }
      }));
    } finally {
      setAuthState(prev => ({ ...prev, walletLoading: false }));
    }
  };

  const buildAndSubmitTransaction = async (destinationAddress: string, amount: string, network = 'testnet') => {
    if (!authState.actor) throw new Error('Not authenticated');
    
    try {
      // Convert amount to u64 format (whole XLM units)
      const amountU64 = BigInt(Math.floor(parseFloat(amount)));
      
      console.log('Sending transaction with params:', { destinationAddress, amount, amountU64, network });
      const result = await authState.actor.build_stellar_transaction(destinationAddress, amountU64, [network]);
      console.log('Backend response:', result);
      
      if ('Ok' in result) {
        // Parse the JSON response from backend
        try {
          const responseData = JSON.parse(result.Ok);
          console.log('Parsed response data:', responseData);
          
          if (responseData.success) {
            return {
              success: true,
              message: responseData.hash ? 'Transaction submitted successfully!' : 'Transaction successful (hash pending)',
              hash: responseData.hash,
              explorer_url: responseData.explorer_url,
              raw_response: responseData.raw_response,
              details: responseData
            };
          } else {
            console.error('Transaction failed:', responseData);
            return {
              success: false,
              message: responseData.error || 'Transaction failed',
              raw_response: responseData.raw_response,
              details: responseData
            };
          }
        } catch (parseError) {
          console.warn('Failed to parse backend response as JSON:', parseError);
          return {
            success: true,
            message: 'Transaction completed',
            raw_response: result.Ok,
            details: result.Ok
          };
        }
      } else {
        console.error('Backend returned error:', result.Err);
        throw new Error(result.Err);
      }
    } catch (error) {
      console.error('Failed to build and submit transaction:', error);
      throw error;
    }
  };

  const getAccountBalance = async (network = 'testnet') => {
    if (!authState.actor) {
      throw new Error('Backend actor not available');
    }
    
    try {
      console.log('Fetching balance from backend canister for network:', network);
      const result = await authState.actor.get_account_balance([network]);
      console.log('Backend balance response:', result);
      
      if ('Ok' in result) {
        const balance = result.Ok;
        console.log('Balance fetched successfully:', balance);
        return balance;
      } else {
        throw new Error(result.Err);
      }
    } catch (error) {
      console.error('Failed to get account balance from backend:', error);
      throw error;
    }
  };

  return {
    ...authState,
    login,
    logout,
    generateStellarAddress: () => generateStellarAddress(),
    buildAndSubmitTransaction,
    getAccountBalance,
  };
};
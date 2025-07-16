import { useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { createActor } from 'declarations/kosh_backend';

// Define canister IDs directly to avoid environment variable issues
const CANISTER_IDS = {
  INTERNET_IDENTITY: 'rdmx6-jaaaa-aaaaa-aaadq-cai',
  BACKEND: 'uxrrr-q7777-77774-qaaaq-cai',
  FRONTEND: 'u6s2n-gx777-77774-qaaba-cai'
};

export const useAuth = () => {
  const [authClient, setAuthClient] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState(null);
  const [actor, setActor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stellarAddress, setStellarAddress] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const client = await AuthClient.create();
      setAuthClient(client);
      
      const isAuth = await client.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        const identity = client.getIdentity();
        setPrincipal(identity.getPrincipal());
        
        // Create authenticated actor
        const authenticatedActor = createActor(CANISTER_IDS.BACKEND, {
          agentOptions: {
            identity,
            host: 'http://localhost:4943'
          },
        });
        setActor(authenticatedActor);
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
      await authClient.login({
        identityProvider: `http://${CANISTER_IDS.INTERNET_IDENTITY}.localhost:4943`,
        onSuccess: async () => {
          const identity = authClient.getIdentity();
          setPrincipal(identity.getPrincipal());
          setIsAuthenticated(true);
          
          // Create authenticated actor
          const authenticatedActor = createActor(CANISTER_IDS.BACKEND, {
            agentOptions: {
              identity,
              host: 'http://localhost:4943'
            },
          });
          setActor(authenticatedActor);
        },
      });
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!authClient) return;
    
    try {
      setLoading(true);
      await authClient.logout();
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

  const getStellarAddress = async () => {
    if (!actor) throw new Error('Not authenticated');
    
    setWalletLoading(true);
    try {
      const result = await actor.public_key_stellar();
      if (result.Ok) {
        const address = result.Ok;
        setStellarAddress({ stellar_address: address });
        return { stellar_address: address };
      } else {
        throw new Error(result.Err);
      }
    } catch (error) {
      console.error('Failed to get Stellar address:', error);
      throw error;
    } finally {
      setWalletLoading(false);
    }
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

  const getAccountBalance = async () => {
    if (!actor) throw new Error('Not authenticated');
    
    try {
      const result = await actor.get_account_balance();
      if (result.Ok) {
        return result.Ok;
      } else {
        throw new Error(result.Err);
      }
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
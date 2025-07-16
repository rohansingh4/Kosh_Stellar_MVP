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
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    isAuthenticated,
    principal,
    actor,
    loading,
    login,
    logout,
  };
}; 
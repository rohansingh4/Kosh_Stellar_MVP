import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { idlFactory, _SERVICE } from '@/types/backend';

// Canister IDs configuration
const getCanisterIds = () => {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1');
  
  if (isLocal) {
    // Local development canister IDs
    return {
      INTERNET_IDENTITY: 'rdmx6-jaaaa-aaaaa-aaadq-cai',
      BACKEND: 'bkyz2-fmaaa-aaaaa-qaaaq-cai',
    };
  } else {
    // Mainnet canister IDs
    return {
      INTERNET_IDENTITY: 'rdmx6-jaaaa-aaaaa-aaadq-cai',
      BACKEND: 'nlfjr-7qaaa-aaaaj-qnsiq-cai',  // Your mainnet backend canister ID
    };
  }
};

export const CANISTER_IDS = getCanisterIds();

// Host configuration
const getHost = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      return 'http://localhost:4943';
    } else {
      // For mainnet deployment, use IC gateway
      return 'https://icp0.io';
    }
  }
  return 'http://localhost:4943';
};

export const HOST = getHost();

// Create authenticated actor
export const createActor = (canisterId: string, options: {
  identity?: Identity;
  agent?: HttpAgent;
}) => {
  const agent = options.agent || new HttpAgent({
    host: HOST,
    identity: options.identity,
  });

  // For local development, fetch root key
  if (HOST.includes('localhost')) {
    agent.fetchRootKey().catch(err => {
      console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
      console.error(err);
    });
  }

  return Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId,
  });
};

// Create anonymous actor (for public methods if any)
export const createAnonymousActor = (canisterId: string) => {
  const agent = new HttpAgent({
    host: HOST,
  });

  if (HOST.includes('localhost')) {
    agent.fetchRootKey().catch(err => {
      console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
      console.error(err);
    });
  }

  return Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId,
  });
};
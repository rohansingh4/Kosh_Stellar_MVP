import { useState } from 'react';
import { useAuth } from './useAuth';

function App() {
  const { isAuthenticated, principal, actor, loading, login, logout } = useAuth();
  const [greeting, setGreeting] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!actor) {
      alert('Please login first');
      return false;
    }
    
    const name = event.target.elements.name.value;
    actor.greet(name).then((greeting) => {
      setGreeting(greeting);
    }).catch((error) => {
      console.error('Error calling backend:', error);
      alert('Error calling backend. Make sure you are authenticated.');
    });
    return false;
  }

  if (loading) {
    return (
      <main style={{ textAlign: 'center', padding: '2rem' }}>
        <div>Loading...</div>
      </main>
    );
  }

  return (
    <main style={{ textAlign: 'center', padding: '2rem' }}>
      <img src="/logo2.svg" alt="DFINITY logo" />
      <br />
      <br />
      
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Authentication Status</h3>
        {isAuthenticated ? (
          <div>
            <p style={{ color: 'green' }}>✅ Authenticated</p>
            <p><strong>Principal:</strong> {principal?.toString()}</p>
            <button 
              onClick={logout} 
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#ff4444', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: 'red' }}>❌ Not Authenticated</p>
            <button 
              onClick={login}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#4444ff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Login with Internet Identity
            </button>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <div>
          <form action="#" onSubmit={handleSubmit}>
            <label htmlFor="name">Enter your name: &nbsp;</label>
            <input id="name" alt="Name" type="text" />
            <button type="submit" style={{ marginLeft: '0.5rem' }}>Click Me!</button>
          </form>
          <section id="greeting" style={{ marginTop: '1rem', fontWeight: 'bold' }}>
            {greeting}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;

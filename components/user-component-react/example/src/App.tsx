import { Passkeys, Sessions, UserService } from 'user-component-react';

function App() {
  const handleError = (error: Error) => {
    console.error('Error:', error);
  };

  const handleSuccess = (message: string) => {
    console.log('Success:', message);
  };

  // For local testing: set VITE_BEARER_TOKEN, VITE_API_URL, VITE_USER_ID, VITE_AUTH_API_URL in .env
  // or ensure user-service is running on localhost:8095 and auth-service on localhost:8100
  const bearerToken = import.meta.env.VITE_BEARER_TOKEN || undefined;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8095';
  const authApiUrl = import.meta.env.VITE_AUTH_API_URL || undefined;
  const userId = import.meta.env.VITE_USER_ID || 'me';

  return (
    <div className="App">
      <UserService
        apiUrl={apiUrl}
        authApiUrl={authApiUrl}
        userId={userId}
        bearerToken={bearerToken}
        onError={handleError}
        onSuccess={handleSuccess}
      />
      <Sessions
        apiUrl={apiUrl}
        authApiUrl={authApiUrl || 'http://localhost:8100'}
        bearerToken={bearerToken}
        onError={handleError}
      />
      <Passkeys
        apiUrl={apiUrl}
        authApiUrl={authApiUrl || 'http://localhost:8100'}
        bearerToken={bearerToken}
        onError={handleError}
      />
    </div>
  );
}

export default App; 

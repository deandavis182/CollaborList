import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Logo from './components/Logo';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';

const API_BASE = '/api';
// Use relative path for WebSocket to go through nginx proxy
// Only use direct connection for local development without Docker
const WS_URL = window.location.port === '5173'  // Vite dev server port
  ? 'http://localhost:3001'
  : '';

// Set axios default auth header and CSRF token
const setAuthHeader = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Add CSRF token for security (using a simple client-generated token)
    axios.defaults.headers.common['X-CSRF-Token'] = Math.random().toString(36).substring(2);
  } else {
    delete axios.defaults.headers.common['Authorization'];
    delete axios.defaults.headers.common['X-CSRF-Token'];
  }
};

function RealtimeApp() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [isAuthView, setIsAuthView] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // App state
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [items, setItems] = useState([]);
  const [shares, setShares] = useState([]);
  const [newListName, setNewListName] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('view');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Page navigation state
  const [currentPage, setCurrentPage] = useState('main');

  // Socket ref
  const socketRef = useRef(null);
  const selectedListRef = useRef(null);

  useEffect(() => {
    // Check if Google OAuth is configured
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    setGoogleEnabled(googleClientId && !googleClientId.includes('your-') && googleClientId !== '');

    if (token) {
      setAuthHeader(token);
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        setIsAuthView(false);
        initializeSocket(token);
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const initializeSocket = (authToken) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    socketRef.current = io(WS_URL, {
      auth: {
        token: authToken
      }
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionStatus('error');
    });

    // Real-time event listeners
    socket.on('list-created', (data) => {
      fetchLists();
    });

    socket.on('list-updated', (data) => {
      setLists(prev => prev.map(list =>
        list.id === data.id ? data : list
      ));
      if (selectedList?.id === data.id) {
        setSelectedList(data);
      }
    });

    socket.on('list-deleted', (data) => {
      setLists(prev => prev.filter(list => list.id !== data.id));
      if (selectedList?.id === data.id) {
        setSelectedList(null);
        setItems([]);
      }
    });

    socket.on('item-created', (data) => {
      if (selectedListRef.current?.id === data.listId) {
        setItems(prev => {
          // Check if item already exists (from optimistic update)
          const existingItem = prev.find(item => item.id === data.item.id);
          if (existingItem) {
            // Replace with server version to ensure consistency
            return prev.map(item => item.id === data.item.id ? data.item : item);
          }
          // Add new item for other users
          return [...prev, data.item].sort((a, b) => a.position - b.position);
        });
      }
    });

    socket.on('item-updated', (data) => {
      if (selectedListRef.current?.id === data.listId) {
        setItems(prev => prev.map(item =>
          item.id === data.item.id ? data.item : item
        ));
      }
    });

    socket.on('item-deleted', (data) => {
      if (selectedListRef.current?.id === data.listId) {
        setItems(prev => {
          // Remove the item if it exists
          const filtered = prev.filter(item => item.id !== data.itemId);
          // Only update if the item was actually found and removed
          return filtered.length !== prev.length ? filtered : prev;
        });
      }
    });

    socket.on('list-shared', (data) => {
      if (data.userId === user?.id) {
        // Refresh lists if someone shared a list with us
        fetchLists();
      }
      if (selectedList?.id === data.listId) {
        fetchShares(data.listId);
      }
    });

    socket.on('share-removed', (data) => {
      if (data.userId === user?.id) {
        // List was unshared from us
        setLists(prev => prev.filter(list => list.id !== data.listId));
        if (selectedList?.id === data.listId) {
          setSelectedList(null);
          setItems([]);
        }
      }
      if (selectedList?.id === data.listId) {
        fetchShares(data.listId);
      }
    });
  };

  useEffect(() => {
    if (user && !isAuthView) {
      fetchLists();
    }
  }, [user, isAuthView]);

  useEffect(() => {
    // Update the ref whenever selectedList changes
    selectedListRef.current = selectedList;

    if (selectedList && socketRef.current) {
      // Join the room for this list
      socketRef.current.emit('join-list', selectedList.id);
      fetchItems(selectedList.id);
      fetchShares(selectedList.id);

      return () => {
        // Leave the room when switching lists
        socketRef.current.emit('leave-list', selectedList.id);
      };
    }
  }, [selectedList]);

  // Auth functions
  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const endpoint = googleEnabled ? '/auth/login' : (authMode === 'login' ? '/auth/login' : '/auth/register');
      const response = await axios.post(`${API_BASE}${endpoint}`, {
        email,
        password
      });

      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setAuthHeader(token);
      setToken(token);
      setUser(user);
      setIsAuthView(false);
      setEmail('');
      setPassword('');
      initializeSocket(token);
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError(authMode === 'login' ? 'Failed to login' : 'Failed to register');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Check if Google Sign-In is available
    if (!window.google?.accounts?.id) {
      setError('Google Sign-In not loaded. Please check your configuration.');
      return;
    }

    // Get Google Client ID from environment or backend config
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

    if (!googleClientId || googleClientId.includes('your-')) {
      setError('Google Sign-In not configured. Add GOOGLE_CLIENT_ID to environment variables.');
      return;
    }

    // Initialize Google Sign-In
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        setIsLoading(true);
        setError(null);

        try {
          const res = await axios.post(`${API_BASE}/auth/google`, {
            credential: response.credential
          });

          const { token, user } = res.data;
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          setAuthHeader(token);
          setToken(token);
          setUser(user);
          setIsAuthView(false);
          setEmail('');
          setPassword('');
          initializeSocket(token);
        } catch (err) {
          if (err.response?.data?.error) {
            setError(err.response.data.error);
          } else {
            setError('Failed to authenticate with Google');
          }
        } finally {
          setIsLoading(false);
        }
      }
    });

    // Trigger the Google Sign-In prompt
    window.google.accounts.id.prompt();
  };

  const logout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthHeader(null);
    setToken(null);
    setUser(null);
    setIsAuthView(true);
    setLists([]);
    setSelectedList(null);
    setItems([]);
    setShares([]);
    setConnectionStatus('disconnected');
  };

  // List functions
  const fetchLists = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/lists`);
      setLists(response.data);
    } catch (err) {
      setError('Failed to fetch lists');
      if (err.response?.status === 401) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchItems = async (listId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/lists/${listId}/items`);
      setItems(response.data);
    } catch (err) {
      setError('Failed to fetch items');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShares = async (listId) => {
    try {
      const response = await axios.get(`${API_BASE}/lists/${listId}/shares`);
      setShares(response.data);
    } catch (err) {
      // Silently fail - user might not have permission to see shares
      setShares([]);
    }
  };

  const createList = async () => {
    if (!newListName.trim()) return;

    try {
      const response = await axios.post(`${API_BASE}/lists`, {
        name: newListName,
        description: ''
      });
      setLists([response.data, ...lists]);
      setNewListName('');
      setSelectedList(response.data);
    } catch (err) {
      setError('Failed to create list');
    }
  };

  const deleteList = async (listId) => {
    try {
      await axios.delete(`${API_BASE}/lists/${listId}`);
      // Update will happen via WebSocket
    } catch (err) {
      setError('Failed to delete list');
    }
  };

  const shareList = async () => {
    if (!shareEmail.trim() || !selectedList) return;

    try {
      await axios.post(`${API_BASE}/lists/${selectedList.id}/share`, {
        email: shareEmail,
        permission: sharePermission
      });
      setShareEmail('');
      // Updates will come via WebSocket
      setError(null);
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to share list');
      }
    }
  };

  const removeShare = async (userId) => {
    if (!selectedList) return;

    try {
      await axios.delete(`${API_BASE}/lists/${selectedList.id}/shares/${userId}`);
      // Updates will come via WebSocket
    } catch (err) {
      setError('Failed to remove share');
    }
  };

  const createItem = async () => {
    if (!newItemText.trim() || !selectedList) return;

    // Create a temporary item for optimistic update
    const tempItem = {
      id: `temp-${Date.now()}`,
      text: newItemText,
      completed: false,
      list_id: selectedList.id,
      position: items.length
    };

    // Optimistic update - add temporary item immediately
    setItems(prev => [...prev, tempItem]);
    const savedText = newItemText;
    setNewItemText('');

    try {
      const response = await axios.post(`${API_BASE}/lists/${selectedList.id}/items`, {
        text: savedText,
        completed: false
      });

      // Replace temporary item with real one from server
      setItems(prev => prev.map(item =>
        item.id === tempItem.id ? response.data : item
      ));
    } catch (err) {
      // Rollback on error - remove temporary item
      setItems(prev => prev.filter(item => item.id !== tempItem.id));
      setNewItemText(savedText); // Restore the text

      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else {
        setError('Failed to create item');
      }
    }
  };

  const toggleItemComplete = async (item) => {
    // Optimistic update
    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, completed: !i.completed } : i
    ));

    try {
      await axios.put(`${API_BASE}/items/${item.id}`, {
        completed: !item.completed
      });
    } catch (err) {
      // Rollback on error
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, completed: item.completed } : i
      ));

      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else {
        setError('Failed to update item');
      }
    }
  };

  const deleteItem = async (itemId) => {
    // Store item for rollback
    const deletedItem = items.find(i => i.id === itemId);
    if (!deletedItem) return;

    // Optimistic update - remove immediately
    setItems(prev => prev.filter(i => i.id !== itemId));

    try {
      await axios.delete(`${API_BASE}/items/${itemId}`);
      // Socket event will notify other users
    } catch (err) {
      // Rollback on error - restore the item at its original position
      if (deletedItem) {
        setItems(prev => {
          const restored = [...prev, deletedItem];
          return restored.sort((a, b) => a.position - b.position);
        });
      }

      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else {
        setError('Failed to delete item');
      }
    }
  };

  const isOwner = selectedList && user && selectedList.user_id === user.id;

  // Show Privacy Policy
  if (currentPage === 'privacy') {
    return <PrivacyPolicy onBack={() => setCurrentPage('main')} />;
  }

  // Show Terms of Service
  if (currentPage === 'terms') {
    return <TermsOfService onBack={() => setCurrentPage('main')} />;
  }

  // Auth View
  if (isAuthView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-xl w-96 border border-purple-100">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <p className="text-center text-gray-600 mb-6">Collaborate in real-time on shared lists</p>

          {googleEnabled ? (
            // Google OAuth is configured - show simplified login
            <>
              {/* Google Login Button - Primary for new users */}
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 px-4 border border-gray-300 rounded-md flex items-center justify-center space-x-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 bg-blue-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-gray-700 font-medium">Sign in with Google</span>
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Existing users with password</span>
                </div>
              </div>

              <form onSubmit={handleAuth}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 font-semibold"
                >
                  {isLoading ? 'Loading...' : 'Login'}
                </button>
              </form>
            </>
          ) : (
            // Google OAuth not configured - show traditional login/register
            <>
              <div className="flex mb-4">
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2 ${authMode === 'login' ? 'border-b-2 border-purple-500 text-purple-600 font-semibold' : 'text-gray-500'}`}
                >
                  Login
                </button>
                <button
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2 ${authMode === 'register' ? 'border-b-2 border-purple-500 text-purple-600 font-semibold' : 'text-gray-500'}`}
                >
                  Register
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleAuth}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 font-semibold"
                >
                  {isLoading ? 'Loading...' : (authMode === 'login' ? 'Login' : 'Register')}
                </button>
              </form>
            </>
          )}


          <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
            By using CollaborList, you agree to our
            <button
              onClick={() => setCurrentPage('terms')}
              className="text-purple-600 hover:text-purple-700 mx-1 underline"
            >
              Terms of Service
            </button>
            and
            <button
              onClick={() => setCurrentPage('privacy')}
              className="text-purple-600 hover:text-purple-700 mx-1 underline"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main App View
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Logo size="md" />
              {/* Connection Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
                }`}></div>
                <span className="text-xs text-gray-600 font-medium">
                  {connectionStatus === 'connected' ? '⚡ Live Sync' :
                   connectionStatus === 'error' ? 'Connection Error' : 'Connecting...'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lists Panel */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">My Lists</h2>

              {/* Create List Form */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createList()}
                    placeholder="New list name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={createList}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Lists */}
              <div className="space-y-2">
                {lists.map(list => (
                  <div
                    key={list.id}
                    className={`p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedList?.id === list.id
                        ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div
                        onClick={() => setSelectedList(list)}
                        className="flex-1"
                      >
                        <h3 className="font-medium text-gray-900">
                          {list.name}
                          {list.user_id !== user?.id && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Shared</span>
                          )}
                        </h3>
                      </div>
                      {list.user_id === user?.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteList(list.id);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {lists.length === 0 && !isLoading && (
                  <p className="text-gray-500 text-center py-4">No lists yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Items & Sharing Panel */}
          <div className="md:col-span-2">
            {selectedList ? (
              <div className="space-y-6">
                {/* Items */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{selectedList.name}</h2>
                    {connectionStatus === 'connected' && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        ⚡ Real-time sync active
                      </span>
                    )}
                  </div>

                  {/* Create Item Form */}
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && createItem()}
                        placeholder="Add new item..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={createItem}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        Add Item
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className="p-3 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => toggleItemComplete(item)}
                              className="mr-3 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className={`${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                              {item.text}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && !isLoading && (
                      <p className="text-gray-500 text-center py-4">No items in this list</p>
                    )}
                  </div>
                </div>

                {/* Sharing Section (only for owner) */}
                {isOwner && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Share This List</h3>

                    <div className="flex gap-2 mb-4">
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="Enter email to share..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={sharePermission}
                        onChange={(e) => setSharePermission(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="view">View</option>
                        <option value="edit">Edit</option>
                      </select>
                      <button
                        onClick={shareList}
                        className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
                      >
                        Share
                      </button>
                    </div>

                    {/* Current Shares */}
                    {shares.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-700">Shared with:</h4>
                        {shares.map(share => (
                          <div key={share.user_id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span>{share.email}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm bg-gray-200 px-2 py-1 rounded">
                                {share.permission}
                              </span>
                              <button
                                onClick={() => removeShare(share.user_id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center py-12 text-gray-500">
                  Select a list to view items
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RealtimeApp;
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api';

// Set axios default auth header
const setAuthHeader = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

function AuthApp() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [isAuthView, setIsAuthView] = useState(true);
  const [authMode, setAuthMode] = useState('login');

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

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (token) {
      setAuthHeader(token);
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        setIsAuthView(false);
      }
    }
  }, []);

  useEffect(() => {
    if (user && !isAuthView) {
      fetchLists();
    }
  }, [user, isAuthView]);

  useEffect(() => {
    if (selectedList) {
      fetchItems(selectedList.id);
      fetchShares(selectedList.id);
    }
  }, [selectedList]);

  // Auth functions
  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
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

  const logout = () => {
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
      setLists(lists.filter(l => l.id !== listId));
      if (selectedList && selectedList.id === listId) {
        setSelectedList(null);
        setItems([]);
        setShares([]);
      }
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
      fetchShares(selectedList.id);
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
      fetchShares(selectedList.id);
    } catch (err) {
      setError('Failed to remove share');
    }
  };

  const createItem = async () => {
    if (!newItemText.trim() || !selectedList) return;

    try {
      const response = await axios.post(`${API_BASE}/lists/${selectedList.id}/items`, {
        text: newItemText,
        completed: false
      });
      setItems([...items, response.data]);
      setNewItemText('');
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else {
        setError('Failed to create item');
      }
    }
  };

  const toggleItemComplete = async (item) => {
    try {
      const response = await axios.put(`${API_BASE}/items/${item.id}`, {
        completed: !item.completed
      });
      setItems(items.map(i => i.id === item.id ? response.data : i));
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else {
        setError('Failed to update item');
      }
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await axios.delete(`${API_BASE}/items/${itemId}`);
      setItems(items.filter(i => i.id !== itemId));
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else {
        setError('Failed to delete item');
      }
    }
  };

  const isOwner = selectedList && user && selectedList.user_id === user.id;

  // Auth View
  if (isAuthView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg w-96">
          <h1 className="text-2xl font-bold text-center mb-6">List Manager</h1>

          <div className="flex mb-4">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 ${authMode === 'login' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 ${authMode === 'register' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : (authMode === 'login' ? 'Login' : 'Register')}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            Demo account: demo@example.com / password123
          </div>
        </div>
      </div>
    );
  }

  // Main App View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">List Manager</h1>
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={createList}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        ? 'bg-blue-50 border-blue-300'
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
                            <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">Shared</span>
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
                  <h2 className="text-lg font-semibold mb-4">{selectedList.name}</h2>

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

export default AuthApp;
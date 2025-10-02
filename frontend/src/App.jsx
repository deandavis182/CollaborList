import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api';

function App() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [items, setItems] = useState([]);
  const [newListName, setNewListName] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLists();
  }, []);

  useEffect(() => {
    if (selectedList) {
      fetchItems(selectedList.id);
    }
  }, [selectedList]);

  const fetchLists = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/lists`);
      setLists(response.data);
    } catch (err) {
      setError('Failed to fetch lists');
      console.error(err);
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
      console.error(err);
    } finally {
      setIsLoading(false);
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
      console.error(err);
    }
  };

  const deleteList = async (listId) => {
    try {
      await axios.delete(`${API_BASE}/lists/${listId}`);
      setLists(lists.filter(l => l.id !== listId));
      if (selectedList && selectedList.id === listId) {
        setSelectedList(null);
        setItems([]);
      }
    } catch (err) {
      setError('Failed to delete list');
      console.error(err);
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
      setError('Failed to create item');
      console.error(err);
    }
  };

  const toggleItemComplete = async (item) => {
    try {
      const response = await axios.put(`${API_BASE}/items/${item.id}`, {
        completed: !item.completed
      });
      setItems(items.map(i => i.id === item.id ? response.data : i));
    } catch (err) {
      setError('Failed to update item');
      console.error(err);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await axios.delete(`${API_BASE}/items/${itemId}`);
      setItems(items.filter(i => i.id !== itemId));
    } catch (err) {
      setError('Failed to delete item');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">List Manager</h1>
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
                        <h3 className="font-medium text-gray-900">{list.name}</h3>
                        {list.description && (
                          <p className="text-sm text-gray-500">{list.description}</p>
                        )}
                      </div>
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
                    </div>
                  </div>
                ))}
                {lists.length === 0 && !isLoading && (
                  <p className="text-gray-500 text-center py-4">No lists yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Items Panel */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              {selectedList ? (
                <>
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
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Select a list to view items
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
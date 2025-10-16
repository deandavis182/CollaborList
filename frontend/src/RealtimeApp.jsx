import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Logo from './components/Logo';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Sortable Item Component
function SortableItem({ id, children, canEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children(attributes, listeners, isDragging)}
    </div>
  );
}

// Droppable zone component for making items drop targets
function DroppableItem({ id, children, isOver }) {
  return (
    <div
      id={id}
      className={`${isOver ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
    >
      {children}
    </div>
  );
}

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

  // Notes state
  const [expandedNotes, setExpandedNotes] = useState({});
  const [editingNotes, setEditingNotes] = useState({});
  const [savingNotes, setSavingNotes] = useState({});
  const notesDebounceTimeout = useRef({});

  // Hierarchy state
  const [expandedItems, setExpandedItems] = useState({});
  const [addingSubItemTo, setAddingSubItemTo] = useState(null);
  const [newSubItemText, setNewSubItemText] = useState('');

  // Drag and drop state
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Page navigation state
  const [currentPage, setCurrentPage] = useState('main');

  // Socket ref
  const socketRef = useRef(null);
  const selectedListRef = useRef(null);
  const editingNotesRef = useRef({});
  const expandedNotesRef = useRef({});
  const lastFetchListsTime = useRef(0); // Track last fetchLists() call to prevent rapid requests

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
      // Use WebSocket payload instead of making HTTP call
      if (data && data.id) {
        setLists(prev => {
          // Check if list already exists
          const exists = prev.some(list => list.id === data.id);
          if (!exists) {
            return [data, ...prev];
          }
          return prev;
        });
      } else {
        // Fallback if payload is incomplete
        fetchLists();
      }
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
      if (selectedListRef.current?.id == data.listId) {
        setItems(prev => {
          // Check if item already exists (from optimistic update or HTTP response)
          const existingItem = prev.find(item => item.id === data.item.id);
          if (existingItem) {
            // Already have this item (HTTP response arrived first), no action needed
            return prev;
          }

          // Check for temp item from optimistic update (socket arrived before HTTP response)
          const tempItem = prev.find(item =>
            typeof item.id === 'string' &&
            item.id.startsWith('temp-') &&
            item.text === data.item.text
          );

          if (tempItem) {
            // Replace temp item with real one from server
            return prev.map(item => item.id === tempItem.id ? data.item : item);
          }

          // Add new item for other users
          return [...prev, data.item].sort((a, b) => a.position - b.position);
        });
      }
    });

    socket.on('item-updated', (data) => {
      if (selectedListRef.current?.id == data.listId) {
        setItems(prev => prev.map(item => {
          if (item.id === data.item.id) {
            // Only preserve local notes if user is ACTIVELY TYPING (has pending debounce)
            const hasPendingNotesUpdate = notesDebounceTimeout.current[item.id] !== undefined;
            if (hasPendingNotesUpdate) {
              // Keep local notes, update everything else
              return { ...data.item, notes: item.notes };
            }
            return data.item;
          }
          return item;
        }));

        // Update the editing notes state if not actively typing
        setEditingNotes(prev => {
          const hasPendingNotesUpdate = notesDebounceTimeout.current[data.item.id] !== undefined;
          if (!hasPendingNotesUpdate && expandedNotesRef.current[data.item.id]) {
            // If notes are expanded but user is not typing, sync the notes
            return { ...prev, [data.item.id]: data.item.notes || '' };
          }
          return prev;
        });
      }
    });

    socket.on('item-deleted', (data) => {
      if (selectedListRef.current?.id == data.listId) {
        setItems(prev => {
          // Remove the item if it exists (handle both string and number IDs)
          const filtered = prev.filter(item => item.id != data.itemId);
          return filtered.length !== prev.length ? filtered : prev;
        });

        // Clean up notes state for deleted item
        setEditingNotes(prev => {
          const newState = { ...prev };
          delete newState[data.itemId];
          return newState;
        });
        setExpandedNotes(prev => {
          const newState = { ...prev };
          delete newState[data.itemId];
          return newState;
        });
        setSavingNotes(prev => {
          const newState = { ...prev };
          delete newState[data.itemId];
          return newState;
        });
      }
    });

    socket.on('list-shared', (data) => {
      if (data.userId === user?.id) {
        // Only refresh lists if someone actually shared a NEW list with us
        // This prevents unnecessary API calls when permissions are just updated
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

  useEffect(() => {
    editingNotesRef.current = editingNotes;
  }, [editingNotes]);

  useEffect(() => {
    expandedNotesRef.current = expandedNotes;
  }, [expandedNotes]);

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
  const fetchLists = async (force = false) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchListsTime.current;

    // Skip if fetched within last 5 seconds (unless forced)
    if (!force && timeSinceLastFetch < 5000) {
      console.log('Skipping fetchLists() - called too recently');
      return;
    }

    lastFetchListsTime.current = now;
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/lists`);
      setLists(response.data);
    } catch (err) {
      // Better error handling for rate limiting
      if (err.response?.status === 429) {
        const retryAfter = err.response.data?.retryAfter || 15;
        setError(`Too many requests. Please wait ${retryAfter} minute(s) before trying again. Try logging out and back in to reset.`);
      } else if (err.response?.status === 401) {
        logout();
      } else {
        setError('Failed to fetch lists');
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
      // Clear state when loading new items
      setEditingNotes({});
      setExpandedNotes({});
      setExpandedItems({});
      setAddingSubItemTo(null);
      setNewSubItemText('');
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = err.response.data?.retryAfter || 15;
        setError(`Too many requests. Please wait ${retryAfter} minute(s). Try logging out and back in to reset.`);
      } else {
        setError('Failed to fetch items');
      }
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

  const createItem = async (parentId = null) => {
    const textToUse = parentId ? newSubItemText : newItemText;
    if (!textToUse.trim() || !selectedList) return;

    // Create a temporary item for optimistic update
    const tempItem = {
      id: `temp-${Date.now()}`,
      text: textToUse,
      completed: false,
      list_id: selectedList.id,
      position: items.length,
      parent_id: parentId
    };

    // Optimistic update - add temporary item immediately
    setItems(prev => [...prev, tempItem]);
    const savedText = textToUse;

    if (parentId) {
      setNewSubItemText('');
      setAddingSubItemTo(null);
    } else {
      setNewItemText('');
    }

    try {
      const response = await axios.post(`${API_BASE}/lists/${selectedList.id}/items`, {
        text: savedText,
        completed: false,
        parent_id: parentId
      });

      // Replace temporary item with real one from server
      setItems(prev => prev.map(item =>
        item.id === tempItem.id ? response.data : item
      ));

      // Ensure parent is expanded when adding sub-item
      if (parentId) {
        setExpandedItems(prev => ({ ...prev, [parentId]: true }));
      }
    } catch (err) {
      // Rollback on error - remove temporary item
      setItems(prev => prev.filter(item => item.id !== tempItem.id));

      if (parentId) {
        setNewSubItemText(savedText);
      } else {
        setNewItemText(savedText);
      }

      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else {
        setError('Failed to create item');
      }
    }
  };

  // Helper function to organize items hierarchically
  const organizeItems = (items) => {
    const itemMap = {};
    const rootItems = [];

    // First pass: create a map of all items
    items.forEach(item => {
      itemMap[item.id] = { ...item, children: [] };
    });

    // Second pass: build the hierarchy
    items.forEach(item => {
      if (item.parent_id && itemMap[item.parent_id]) {
        itemMap[item.parent_id].children.push(itemMap[item.id]);
      } else {
        rootItems.push(itemMap[item.id]);
      }
    });

    // Third pass: sort items by position (recursively)
    const sortByPosition = (itemList) => {
      itemList.sort((a, b) => a.position - b.position);
      itemList.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortByPosition(item.children);
        }
      });
    };

    sortByPosition(rootItems);

    return rootItems;
  };

  const toggleItemExpanded = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
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

  const updateItemNotes = async (itemId, notes) => {
    setSavingNotes(prev => ({ ...prev, [itemId]: true }));
    try {
      await axios.put(`${API_BASE}/items/${itemId}`, { notes });

      // Update local state
      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, notes } : i
      ));
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else {
        setError('Failed to update notes');
      }
    } finally {
      setSavingNotes(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleNotesChange = (itemId, notes) => {
    // Update local state immediately for responsiveness
    setEditingNotes(prev => ({ ...prev, [itemId]: notes }));

    // Clear any existing timeout for this item
    if (notesDebounceTimeout.current[itemId]) {
      clearTimeout(notesDebounceTimeout.current[itemId]);
    }

    // Set a new timeout to save after 500ms of no typing
    notesDebounceTimeout.current[itemId] = setTimeout(() => {
      updateItemNotes(itemId, notes);
      // Clear the timeout reference after saving
      delete notesDebounceTimeout.current[itemId];
    }, 500);
  };

  const toggleNotesExpanded = (itemId) => {
    setExpandedNotes(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));

    // Initialize editing notes if not already set
    if (!editingNotes[itemId] && expandedNotes[itemId] === undefined) {
      const item = items.find(i => i.id === itemId);
      setEditingNotes(prev => ({
        ...prev,
        [itemId]: item?.notes || ''
      }));
    }
  };

  const deleteItem = async (itemId) => {
    // Store item for rollback
    const deletedItem = items.find(i => i.id === itemId);
    if (!deletedItem) return;

    // Optimistic update - remove immediately
    setItems(prev => prev.filter(i => i.id !== itemId));

    // Clean up notes state for this item
    setEditingNotes(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
    setExpandedNotes(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
    setSavingNotes(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });

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

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms hold before drag starts on touch
        tolerance: 5,
      },
    })
  );

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event) => {
    setOverId(event.over?.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over, activatorEvent, delta } = event;

    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeItem = items.find(item => item.id === active.id);
    const overItem = items.find(item => item.id === over.id);

    if (!activeItem) {
      return;
    }

    try {
      if (!overItem) {
        // Dropped on empty space or list - do nothing for now
        return;
      }

      // Prevent dropping an item onto itself or its own descendants
      if (activeItem.id === overItem.id) {
        return;
      }

      // Check if overItem is a descendant of activeItem (would create circular reference)
      const isDescendant = (parentItem, childItem) => {
        if (!childItem.parent_id) return false;
        if (childItem.parent_id === parentItem.id) return true;
        const parent = items.find(i => i.id === childItem.parent_id);
        return parent ? isDescendant(parentItem, parent) : false;
      };

      if (isDescendant(activeItem, overItem)) {
        setError('Cannot move item into its own sub-item');
        return;
      }

      // Determine if we should nest or make sibling based on:
      // 1. Shift key (desktop)
      // 2. Drop position - dropping on right side nests (mobile-friendly)
      const shiftKey = activatorEvent?.shiftKey || false;

      // Check horizontal position - if dragged significantly to the right, nest it
      // This works on both desktop and mobile
      const shouldNest = shiftKey || (delta && delta.x > 40);

      if (shouldNest) {
        // Nest as sub-item
        await axios.put(`${API_BASE}/items/${activeItem.id}`, {
          parent_id: overItem.id,
          list_id: overItem.list_id
        });
        // Expand the parent to show the new child
        setExpandedItems(prev => ({ ...prev, [overItem.id]: true }));
        return;
      }

      // Default behavior: move to same level as over item (make them siblings)
      const newParentId = overItem.parent_id;

      // Determine if dropping above or below based on vertical drag delta
      // Negative delta.y means dragging upward (drop above), positive means downward (drop below)
      const droppingAbove = delta && delta.y < 0;

      // Calculate position using integers with gaps (position is INTEGER in DB)
      // Get all siblings at the same level to find surrounding positions
      const siblings = items
        .filter(item => item.parent_id === newParentId)
        .sort((a, b) => a.position - b.position);

      const overIndex = siblings.findIndex(s => s.id === overItem.id);
      let newPosition;

      const GAP = 1000; // Use large gaps to allow many insertions before rebalancing needed

      if (droppingAbove) {
        // Dropping above: insert before the target item
        if (overIndex === 0) {
          // Dropping before the first item
          newPosition = Math.max(0, overItem.position - GAP);
        } else {
          // Insert between previous item and target item
          const prevItem = siblings[overIndex - 1];
          const midpoint = Math.floor((prevItem.position + overItem.position) / 2);
          // If no room, place right after previous item
          newPosition = midpoint === prevItem.position ? prevItem.position + 1 : midpoint;
        }
      } else {
        // Dropping below: insert after the target item
        if (overIndex === siblings.length - 1) {
          // Dropping after the last item
          newPosition = overItem.position + GAP;
        } else {
          // Insert between target item and next item
          const nextItem = siblings[overIndex + 1];
          const midpoint = Math.floor((overItem.position + nextItem.position) / 2);
          // If no room, place right before next item
          newPosition = midpoint === overItem.position ? overItem.position + 1 : midpoint;
        }
      }

      // Only update if something actually changed
      if (activeItem.parent_id !== newParentId || activeItem.position !== newPosition) {
        await axios.put(`${API_BASE}/items/${activeItem.id}`, {
          parent_id: newParentId,
          position: newPosition,
          list_id: overItem.list_id
        });

        // If moved to a different parent, expand it
        if (newParentId && newParentId !== activeItem.parent_id) {
          setExpandedItems(prev => ({ ...prev, [newParentId]: true }));
        }
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You only have view permission for this list');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to move item');
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
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
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-sm text-gray-600 truncate max-w-[150px] sm:max-w-none">{user?.email}</span>
              <button
                onClick={logout}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 whitespace-nowrap"
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
                <div className="flex flex-col sm:flex-row gap-2">
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
                    className="px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 whitespace-nowrap"
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
                    <div className="flex flex-col sm:flex-row gap-2">
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
                        className="px-3 sm:px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 whitespace-nowrap"
                      >
                        Add Item
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  {(() => {
                    // Check if user can edit this list
                    const canEdit = isOwner || shares.some(s => s.user_id === user?.id && s.permission === 'edit');

                    return (
                      <>
                        {/* Drag & Drop Help */}
                        {canEdit && items.length > 0 && (
                          <div className="mb-3 text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
                            💡 <strong>Drag & Drop:</strong> Drag items up/down to reorder them. <strong>To nest as sub-item:</strong> hold <kbd className="px-1 bg-white border border-gray-300 rounded text-[10px]">Shift</kbd> (desktop) or drag right 40px+ before dropping (mobile).
                          </div>
                        )}

                        <DndContext
                          sensors={sensors}
                          collisionDetection={pointerWithin}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDragEnd={handleDragEnd}
                          onDragCancel={handleDragCancel}
                        >
                          <SortableContext
                            items={items.map(item => item.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {(() => {

                          const renderItem = (item, depth = 0) => {
                            const hasChildren = item.children && item.children.length > 0;
                            const isExpanded = expandedItems[item.id] === true; // default to collapsed

                            // Visual styling based on depth
                            const bgColors = ['bg-gray-50', 'bg-blue-50', 'bg-green-50'];
                            const borderColors = ['border-gray-200', 'border-blue-200', 'border-green-200'];
                            const bgColor = bgColors[Math.min(depth, bgColors.length - 1)];
                            const borderColor = borderColors[Math.min(depth, borderColors.length - 1)];

                            return (
                              <SortableItem key={item.id} id={item.id} canEdit={canEdit}>
                                {(attributes, listeners, isDragging) => (
                                  <div className="space-y-2">
                                    <div
                                      style={{
                                        marginLeft: `${depth * 24}px`,
                                        borderLeftWidth: depth > 0 ? '3px' : '0',
                                        borderLeftColor: depth > 0 ? 'rgb(59, 130, 246)' : 'transparent'
                                      }}
                                      className={`p-3 ${bgColor} rounded-md border ${borderColor} ${
                                        isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-sm'
                                      } transition-all ${overId === `item-${item.id}` ? 'ring-2 ring-blue-400' : ''}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center flex-1 gap-2">
                                          {/* Drag handle - only show for users with edit permission */}
                                          {canEdit && (
                                            <button
                                              {...attributes}
                                              {...listeners}
                                              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 touch-none"
                                              title="Drag to reorder"
                                            >
                                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                                              </svg>
                                            </button>
                                          )}

                                          {!canEdit && <div className="w-6" />}
                                  {/* Expand/Collapse button for items with children */}
                                  {hasChildren && (
                                    <button
                                      onClick={() => toggleItemExpanded(item.id)}
                                      className="text-gray-500 hover:text-gray-700 p-1"
                                      title={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {isExpanded ? (
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        ) : (
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        )}
                                      </svg>
                                    </button>
                                  )}
                                  {!hasChildren && <div className="w-6" />}

                                  <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() => toggleItemComplete(item)}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                  />
                                  <span className={`flex-1 ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                    {item.text}
                                  </span>
                                  {hasChildren && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                      {item.children.length}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* Add Sub-Item button */}
                                  <button
                                    onClick={() => setAddingSubItemTo(item.id)}
                                    className="text-green-500 hover:text-green-700 p-1"
                                    title="Add sub-item"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </button>
                                  {/* Notes toggle button */}
                                  <button
                                    onClick={() => toggleNotesExpanded(item.id)}
                                    className={`text-gray-500 hover:text-gray-700 p-1 ${item.notes || expandedNotes[item.id] ? 'text-yellow-500' : ''}`}
                                    title={expandedNotes[item.id] ? 'Hide notes' : 'Add/view notes'}
                                  >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11l5-5V5c0-1.1-.9-2-2-2zm-1 14.5l-3.5 3.5H4V5h16v12.5z"/>
                                      <path d="M6 10h8v2H6zm0-3h10v2H6zm0 6h6v2H6z"/>
                                    </svg>
                                  </button>
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

                              {/* Add Sub-Item Form */}
                              {addingSubItemTo === item.id && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={newSubItemText}
                                      onChange={(e) => setNewSubItemText(e.target.value)}
                                      onKeyPress={(e) => e.key === 'Enter' && createItem(item.id)}
                                      placeholder="Add sub-item..."
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => createItem(item.id)}
                                      className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
                                    >
                                      Add
                                    </button>
                                    <button
                                      onClick={() => { setAddingSubItemTo(null); setNewSubItemText(''); }}
                                      className="px-3 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Notes section */}
                              {expandedNotes[item.id] && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="relative">
                                    <textarea
                                      value={editingNotes[item.id] !== undefined ? editingNotes[item.id] : (item.notes || '')}
                                      onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                      placeholder="Add notes..."
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                      rows="3"
                                    />
                                    {savingNotes[item.id] && (
                                      <div className="absolute top-2 right-2 text-xs text-gray-500 flex items-center gap-1">
                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Render children */}
                            {hasChildren && isExpanded && (
                              <div>
                                {item.children.map(child => renderItem(child, depth + 1))}
                              </div>
                            )}
                                    </div>
                                  )}
                                </SortableItem>
                              );
                            };

                            const organizedItems = organizeItems(items);
                            return organizedItems.length > 0
                              ? organizedItems.map(item => renderItem(item))
                              : !isLoading && (
                                  <p className="text-gray-500 text-center py-4">No items in this list</p>
                                );
                          })()}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </>
                );
              })()}
                </div>

                {/* Sharing Section (only for owner) */}
                {isOwner && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Share This List</h3>

                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="Enter email to share..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
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
                          className="px-3 sm:px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 whitespace-nowrap"
                        >
                          Share
                        </button>
                      </div>
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
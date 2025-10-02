# Testing Real-Time Updates

## Setup
1. Start the application:
   ```bash
   docker-compose up
   ```

2. Open two browser windows/tabs (or use two different browsers)

3. Register/login with two different user accounts:
   - User A: user1@example.com
   - User B: user2@example.com

## Test Procedure

### 1. Test List Sharing
1. User A: Create a new list called "Shared Shopping List"
2. User A: Share the list with User B (use edit permission)
3. User B: Refresh and verify the shared list appears

### 2. Test Real-Time Item Updates

#### Adding Items (Fixed)
1. Both users: Open the same shared list
2. User A: Add item "Milk"
   - User B should see "Milk" appear instantly without refresh
3. User B: Add item "Bread"
   - User A should see "Bread" appear instantly without refresh

#### Checking/Unchecking Items (Already Working)
1. User A: Check "Milk" as completed
   - User B should see "Milk" checked instantly
2. User B: Uncheck "Milk"
   - User A should see "Milk" unchecked instantly

#### Deleting Items (Fixed)
1. User A: Delete "Bread"
   - User B should see "Bread" disappear instantly
2. User B: Add "Eggs" and then delete it
   - User A should see "Eggs" appear then disappear

### 3. Verify Connection Status
- Both users should see "⚡ Live Sync" in the header
- The green indicator should be pulsing

## Expected Behavior After Fix

✅ **Working Real-Time Updates:**
- Adding items updates live for all users viewing the list
- Removing items updates live for all users viewing the list
- Checking/unchecking items updates live (already working)
- Optimistic updates provide instant feedback to the user performing the action
- Other users see changes immediately via WebSocket events

## Technical Changes Made

1. **Improved `item-created` handler**: Now properly handles both optimistic updates and incoming items from other users
2. **Enhanced `createItem` function**: Uses temporary IDs for optimistic updates, then replaces with server response
3. **Better `deleteItem` function**: Improved rollback mechanism on errors
4. **Fixed `item-deleted` handler**: More robust deletion handling

## Troubleshooting

If real-time updates aren't working:
1. Check browser console for WebSocket connection errors
2. Verify both users are viewing the same list
3. Check the connection status indicator in the header
4. Ensure both users have proper permissions (view/edit)
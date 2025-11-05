# Running Tests

## Via Docker Compose

To run the test suite using Docker Compose:

```bash
# Run tests (builds and runs the test container)
docker compose --profile test run --rm backend-test

# Or rebuild and run tests
docker compose --profile test build backend-test
docker compose --profile test run --rm backend-test
```

## What the Tests Cover

The test suite includes comprehensive tests for the cross-list item moving feature:

### Cross-List Move Feature Tests
- ✅ Successfully move item to another list when user is owner
- ✅ Rollback transaction if error occurs during cross-list move
- ✅ Move item with descendants (entire subtree) to another list

### Permission Validation Tests
- ✅ Reject move if user is not owner of source list
- ✅ Reject move if user lacks edit permission on target list
- ✅ Allow move if user has edit permission on target list
- ✅ Reject move if target list does not exist
- ✅ Reject move if item does not exist

### Input Validation Tests
- ✅ Reject invalid list_id format
- ✅ Allow regular updates without cross-list move

## Test Structure

Tests are located in `__tests__/cross-list-move.test.js` and use:
- **Jest** - Testing framework
- **Supertest** - HTTP assertions
- **Mocked database** - For isolated unit testing

## Important Notes

- Tests use database transactions to ensure atomicity during cross-list moves
- All descendants of an item are moved together with their parent
- Only list owners can move items out of their lists
- Users must have edit permission on the target list to move items into it

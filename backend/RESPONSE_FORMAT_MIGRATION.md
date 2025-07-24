# API Response Format Migration Guide

## Overview
This guide explains how to migrate existing API endpoints to use the unified response format.

## Current Issues
- Direct return of model objects/lists
- Inconsistent response formats
- Frontend needs to handle multiple response types

## Solution: Unified Response Format

### Standard Response Structure
```json
{
    "success": true,
    "message": "Operation successful",
    "data": {...},
    "errors": null
}
```

### Migration Approaches

#### Option 1: Use Response Wrapper Decorator (Recommended)
```python
from app.middleware.response_wrapper import wrap_response

@router.get("/")
@wrap_response
async def get_items():
    return items  # Automatically wrapped
```

#### Option 2: Manual Response Functions
```python
from app.utils.response import success_response, error_response

@router.get("/")
async def get_items():
    try:
        items = get_all_items()
        return success_response(data=items)
    except Exception as e:
        return error_response(message=str(e))
```

#### Option 3: Wrap Entire Router
```python
from app.middleware.response_wrapper import wrap_router_responses

router = APIRouter()

# Define all routes...

# At the end of file
wrap_router_responses(router)
```

## Migration Steps

### Phase 1: Add Response Wrapper (Non-breaking)
1. Import response wrapper in each route file
2. Add `@wrap_response` decorator to endpoints
3. Test that frontend still works with wrapped responses

### Phase 2: Update Frontend (Gradual)
1. Update API interceptor to handle both formats
2. Gradually update components to expect unified format
3. Remove `ensureArray` and similar workarounds

### Phase 3: Cleanup
1. Remove old response handling code
2. Update API documentation
3. Add response format validation tests

## Example Migration

### Before:
```python
@router.get("/", response_model=List[CollaboratorSchema])
async def get_collaborators(db: Session = Depends(get_db)):
    collaborators = db.query(Collaborator).all()
    return collaborators  # Returns array directly
```

### After:
```python
@router.get("/")
@wrap_response
async def get_collaborators(db: Session = Depends(get_db)):
    collaborators = db.query(Collaborator).all()
    return collaborators  # Automatically wrapped in standard format
```

### Frontend Before:
```typescript
const response = await api.get('/collaborators');
const collaborators = ensureArray(response);
```

### Frontend After:
```typescript
const response = await api.get('/collaborators');
const collaborators = response.data;  // Always in data field
```

## Benefits
1. Consistent error handling
2. Predictable response structure
3. Better TypeScript support
4. Simplified frontend code
5. Easier debugging

## Testing
Always test after migration:
```bash
# Backend tests
pytest tests/test_api_responses.py

# Frontend tests
npm test

# Manual testing
curl http://localhost:8080/api/collaborators
```
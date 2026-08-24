# HashiCorp Boundary Remove User from Group Action

Remove a user from a group in HashiCorp Boundary for access management and permissions control.

## Overview

This SGNL action integrates with HashiCorp Boundary to remove users from groups. When executed, the specified user will be removed from the target group, revoking the access permissions associated with that group.

## Prerequisites

- HashiCorp Boundary instance
- Basic authentication credentials (username and password)
- Boundary API access
- Group ID from which the user should be removed
- User ID to remove from the group
- Auth method ID for authentication

## Configuration

### Required Secrets

| Secret | Description |
|--------|-------------|
| `BASIC_USERNAME` | Username for HashiCorp Boundary authentication |
| `BASIC_PASSWORD` | Password for HashiCorp Boundary authentication |

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ADDRESS` | HashiCorp Boundary API base URL | `https://boundary.example.com` |

### Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `groupId` | string | Yes | The Boundary group ID to remove user from | `g_1234567890` |
| `userId` | string | Yes | The Boundary user ID to remove from group | `u_0987654321` |
| `authMethodId` | string | Yes | The Boundary auth method ID for authentication | `ampw_1234567890` |

### Output Structure

| Field | Type | Description |
|-------|------|-------------|
| `groupId` | string | The group ID that was processed |
| `userId` | string | The user ID that was removed |
| `authMethodId` | string | The auth method ID used for authentication |
| `userRemoved` | boolean | `true` if the user was removed; `false` if the user was not a member (no mutation performed) |
| `removedAt` | datetime | When the action ran (ISO 8601). Always set; check `userRemoved` to determine if membership changed |

## Usage Example

### Job Request

```json
{
  "id": "remove-user-from-group-001",
  "type": "nodejs-22",
  "script": {
    "repository": "github.com/sgnl-actions/hashicorp-boundary-remove-user-from-group",
    "version": "v1.0.0",
    "type": "nodejs"
  },
  "script_inputs": {
    "groupId": "g_1234567890",
    "userId": "u_0987654321",
    "authMethodId": "ampw_1234567890"
  },
  "environment": {
    "ADDRESS": "https://boundary.example.com"
  }
}
```

### Successful Response

User was removed:

```json
{
  "groupId": "g_1234567890",
  "userId": "u_0987654321",
  "authMethodId": "ampw_1234567890",
  "userRemoved": true,
  "removedAt": "2024-01-15T10:30:00Z"
}
```

User was not a member (no mutation performed):

```json
{
  "groupId": "g_1234567890",
  "userId": "u_0987654321",
  "authMethodId": "ampw_1234567890",
  "userRemoved": false,
  "removedAt": "2024-01-15T10:30:00Z"
}
```

## How It Works

The action performs the following steps:

1. **Authenticate**: Uses the provided auth method ID and credentials to obtain an authentication token from Boundary
2. **Get Group Details**: Retrieves the current group information including its version number and current member list
3. **Check membership**: If the user is not a member, returns immediately with `userRemoved: false` without mutating state
4. **Remove User from Group**: If the user is a member, removes them using the version number to ensure consistency

## Error Handling

The action includes comprehensive error handling with retryable and fatal error types:

### Retryable Errors (Framework will retry)
- **429 Rate Limit**: Boundary API rate limit exceeded
- **409 Conflict**: Version mismatch from a concurrent change on the `:remove-members` call. Note: this should be rare in practice since the action checks membership before mutating, but can still occur if the group changed between the read and the write
- **5xx Server Errors**: Boundary API server errors

### Fatal Errors (Will not retry)
- **401 Unauthorized**: Invalid username or password
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Group or user not found
- **Missing Parameters**: Invalid or missing required parameters

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test locally with mock data
npm run dev

# Build for production
npm run build
```

### Running Tests

The action includes comprehensive unit tests covering:
- Input validation (groupId, userId, authMethodId)
- Secret validation (BASIC_USERNAME, BASIC_PASSWORD)
- Environment variable validation (ADDRESS)
- Empty parameter validation

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage
```

## Security Considerations

- **Credential Protection**: Never log or expose authentication credentials
- **Token Management**: Authentication tokens are ephemeral and obtained per-request
- **Audit Logging**: All operations are logged with timestamps
- **Input Validation**: All parameters are validated before API calls
- **Rate Limiting**: Includes delays between operations to avoid rate limits

## HashiCorp Boundary API Reference

This action uses the following HashiCorp Boundary API endpoints:
- [Authenticate](https://developer.hashicorp.com/boundary/api-docs/authmethods#authenticate)
- [Read Group](https://developer.hashicorp.com/boundary/api-docs/groups#read)
- [Remove Members from Group](https://developer.hashicorp.com/boundary/api-docs/groups#remove-members)

## Troubleshooting

### Common Issues

1. **"Invalid or missing groupId parameter"**
   - Ensure the `groupId` parameter is provided and is a non-empty string
   - Verify the group ID exists in your Boundary instance

2. **"Invalid or missing userId parameter"**
   - Ensure the `userId` parameter is provided and is a non-empty string
   - Verify the user ID exists in your Boundary instance

3. **"Invalid or missing authMethodId parameter"**
   - Ensure the `authMethodId` parameter is provided and is a non-empty string
   - Verify the auth method ID is correct for your Boundary instance

4. **"Missing required secrets: BASIC_USERNAME and BASIC_PASSWORD"**
   - Ensure both `BASIC_USERNAME` and `BASIC_PASSWORD` secrets are configured
   - Verify the credentials have the correct permissions

5. **"No URL specified. Provide address parameter or ADDRESS environment variable"**
   - Ensure the `ADDRESS` environment variable is set to your Boundary API URL
   - Example: `https://boundary.example.com`

6. **Authentication Errors (401)**
   - Verify your username and password are correct
   - Check that the auth method ID is valid

7. **Group or User Not Found (404)**
   - Verify the group ID and user ID are correct
   - Check that both resources exist in Boundary

8. **Conflict Error (409)**
   - Version mismatch caused by a concurrent change to the group
   - The action will handle retries automatically by re-fetching group state

## License

MIT

## Support

For issues or questions, please contact SGNL Engineering or create an issue in this repository.

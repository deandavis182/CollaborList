# Security Documentation

This document describes the security architecture and measures implemented in the CollaborList application to protect user data and prevent common attacks.

## Security Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Security   │────▶│   Backend   │
│    (React)  │     │  Middleware  │     │   (Express) │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    ┌──────┼──────┐
                    │      │      │
                 Rate   CSRF   Input
                Limit  Token  Sanitize
```

## Authentication & Authorization

### Primary Authentication Methods

#### Google OAuth (Recommended)
When configured, Google OAuth becomes the primary authentication method:
- Eliminates password management complexity
- Prevents spam account creation
- Leverages Google's security infrastructure
- Automatic account verification

#### Traditional Authentication
When Google OAuth is not configured:
- Email and password registration
- Strong password requirements enforced
- Secure bcrypt hashing with salt rounds
- JWT tokens with 24-hour expiration

### Password Security Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Validated on both client and server

## Attack Prevention

### Rate Limiting
Protects against brute force and denial of service attacks:
- **General API**: 100 requests per 15-minute window
- **Authentication**: 5 attempts per 15-minute window
- IP-based tracking with automatic cleanup
- Memory-efficient implementation

### CSRF Protection
Prevents cross-site request forgery:
- X-CSRF-Token header validation
- Required for all state-changing operations
- Client-generated tokens on authentication
- GET requests and auth endpoints exempt

### SQL Injection Prevention
Multiple layers of protection:
- Parameterized queries throughout the application
- Input sanitization removes dangerous characters
- No dynamic query construction
- PostgreSQL's built-in protections

### XSS Prevention
Protects against cross-site scripting:
- Input sanitization on all user data
- Dangerous characters stripped: `<>\"'`;(){}[]\\`
- Length limits (1000 characters max)
- Security headers prevent inline script execution

## Information Security

### User Privacy Protection
- Generic error messages prevent user enumeration
- No confirmation of existing email addresses
- Consistent response times for all auth failures
- Minimal data exposure in responses

### Security Headers
HTTP headers that enhance security:
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS filter activation
- `Strict-Transport-Security` - Forces HTTPS connections

### CORS Configuration
- Restricted to specific frontend origin
- Configurable via FRONTEND_URL environment variable
- Credentials properly handled
- Methods limited to necessary operations

## Data Validation

### Input Validation
All user input is validated before processing:
- **Email**: RFC-compliant format, max 255 characters
- **Password**: Strength requirements enforced
- **Text fields**: Sanitized, trimmed, length-limited
- **IDs**: Integer validation for all identifiers

### Output Encoding
- API responses use JSON encoding
- No raw HTML in responses
- Consistent error format
- Safe error messages

## Session Management

### JWT Token Security
- Tokens expire after 24 hours
- Signed with configurable secret
- No sensitive data in payload
- Secure transmission via Authorization header

### Token Storage
- Frontend stores in localStorage
- HTTPOnly cookies not used (to support mobile apps)
- Tokens cleared on logout
- No token refresh mechanism (security over convenience)

## Environment Configuration

### Required Security Settings

#### Production Environment
```bash
NODE_ENV=production
JWT_SECRET=<long-random-string>
FRONTEND_URL=https://your-domain.com
GOOGLE_CLIENT_ID=<optional-for-oauth>
```

#### Security Validations
The application performs startup checks:
- JWT_SECRET must be configured in production
- Default secrets are rejected
- Missing configuration causes startup failure
- Security status endpoint for monitoring

## Monitoring & Compliance

### Security Status Endpoint
Monitor security configuration at `/api/security-status`:
```json
{
  "googleOAuth": "configured",
  "signupMethod": "google-only",
  "jwtSecure": true,
  "rateLimiting": "enabled",
  "csrfProtection": "enabled",
  "cors": "configured",
  "securityHeaders": "enabled",
  "tokenExpiry": "24h",
  "passwordRequirements": {
    "minLength": 8,
    "requiresUppercase": true,
    "requiresLowercase": true,
    "requiresNumber": true
  }
}
```

### Compliance Standards
The security implementation aligns with:
- **OWASP Top 10** - Protection against common vulnerabilities
- **PCI DSS** - Password complexity requirements
- **GDPR** - Data minimization and privacy
- **SOC 2** - Security controls and monitoring

## Security Best Practices

### Defense in Depth
Multiple security layers ensure protection even if one fails:
1. Rate limiting prevents abuse
2. Input validation blocks malicious data
3. Parameterized queries prevent injection
4. Output encoding prevents XSS
5. Security headers add browser protection

### Principle of Least Privilege
- Users can only access their own data
- Shared lists require explicit permission
- Edit permissions separate from view permissions
- Owner-only operations (delete, share management)

### Secure by Default
- Production checks enforce security
- Strong defaults for all configurations
- Explicit opt-in for less secure options
- Fail closed on errors

## Testing Security

### Rate Limiting Test
```bash
# Should block after 5 attempts
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

### Security Configuration Check
```bash
curl http://localhost:3001/api/security-status
```

### CSRF Protection Test
```bash
# This should fail without CSRF token
curl -X POST http://localhost:3001/api/lists \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test List"}'
```

## Future Security Enhancements

While the current implementation provides robust security, consider these enhancements:

1. **Two-Factor Authentication (2FA)** - Additional authentication layer
2. **Account Lockout** - Temporary lockout after failed attempts
3. **Session Management** - Refresh tokens and device management
4. **Audit Logging** - Track security events and access patterns
5. **Web Application Firewall** - Cloud-based protection (Cloudflare, AWS WAF)
6. **Content Security Policy** - Advanced XSS protection
7. **Subresource Integrity** - Verify third-party resources

## Security Incident Response

In case of a security incident:
1. Immediately revoke all JWT tokens by changing JWT_SECRET
2. Review access logs for suspicious activity
3. Update passwords for affected accounts
4. Notify users if data was compromised
5. Document incident and response actions

## Conclusion

The CollaborList application implements comprehensive security measures following industry best practices. The multi-layered approach ensures protection against common attacks while maintaining usability. Regular security reviews and updates are recommended to maintain this security posture.
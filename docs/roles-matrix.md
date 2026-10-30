# LoomPilot Role-Based Access Control (RBAC) Matrix

Generated from `ROUTE_PERMISSION_MATRIX` in `@loompilot/shared`.
Enforced strictly at the API gateway layer via `authenticate` and `authorize` middleware. Default policy: **DENY ALL**.

| Method | Route Path | Access Level | Allowed Realms | Allowed Roles | Idempotent | Description |
|---|---|---|---|---|---|---|
| **POST** | `/api/v1/auth/login` | Public | - | - | No | Staff portal user login (admin, supervisor) |
| **POST** | `/api/v1/client/auth/login` | Public | - | - | No | Client portal login |
| **POST** | `/api/v1/auth/refresh` | Public (Cookie) | - | - | No | Staff portal token rotation |
| **POST** | `/api/v1/client/auth/refresh` | Public (Cookie) | - | - | No | Client portal token rotation |
| **POST** | `/api/v1/auth/logout` | Public (Cookie/Token) | - | - | No | Staff portal session logout |
| **POST** | `/api/v1/client/auth/logout` | Public (Cookie/Token) | - | - | No | Client portal session logout |
| **POST** | `/api/v1/auth/logout-all` | Authenticated | `user` | `admin`, `supervisor` | No | Staff user logout from all devices |
| **POST** | `/api/v1/client/auth/logout-all` | Authenticated | `client` | - | No | Client account logout from all devices |
| **POST** | `/api/v1/client/auth/accept-invite` | Public (One-time token) | - | - | Yes | Accept client invitation and activate account |
| **GET** | `/api/v1/me` | Authenticated | `user`, `client` | `admin`, `supervisor` | No | Get authenticated profile and permissions |
| **PATCH** | `/api/v1/me` | Authenticated | `user`, `client` | `admin`, `supervisor` | No | Update own profile settings |
| **POST** | `/api/v1/auth/change-password` | Authenticated | `user`, `client` | `admin`, `supervisor` | No | Change password and revoke other sessions |
| **GET** | `/api/v1/users` | Authenticated | `user` | `admin` | No | List staff users |
| **POST** | `/api/v1/users` | Authenticated | `user` | `admin` | No | Create staff user |
| **PATCH** | `/api/v1/users/:id` | Authenticated | `user` | `admin` | No | Update staff user |
| **POST** | `/api/v1/users/:id/lock` | Authenticated | `user` | `admin` | No | Lock staff user and revoke sessions |
| **POST** | `/api/v1/users/:id/unlock` | Authenticated | `user` | `admin` | No | Unlock staff user |
| **GET** | `/api/v1/client-accounts` | Authenticated | `user` | `admin` | No | List client accounts |
| **POST** | `/api/v1/client-accounts/invite` | Authenticated | `user` | `admin` | No | Invite client contact with one-time invite token |
| **POST** | `/api/v1/client-accounts/:id/reinvite` | Authenticated | `user` | `admin` | No | Re-issue invitation for client account and revoke sessions |
| **POST** | `/api/v1/client-accounts/:id/lock` | Authenticated | `user` | `admin` | No | Lock client account and revoke sessions |
| **POST** | `/api/v1/client-accounts/:id/unlock` | Authenticated | `user` | `admin` | No | Unlock client account |
| **POST** | `/api/v1/clients/:id/portal/invite` | Authenticated | `user` | `admin` | No | Invite client contact with one-time invite token |
| **POST** | `/api/v1/clients/:id/portal/re-invite` | Authenticated | `user` | `admin` | No | Re-issue invitation for client portal and revoke active sessions |
| **POST** | `/api/v1/clients/:id/portal/reinvite` | Authenticated | `user` | `admin` | No | Re-issue invitation for client portal and revoke active sessions |
| **POST** | `/api/v1/clients/:id/portal/accept` | Authenticated | `user` | `admin` | Yes | Admin or portal activation of client portal access |
| **POST** | `/api/v1/clients/:id/portal/lock` | Authenticated | `user` | `admin` | No | Lock client portal access and revoke sessions |
| **POST** | `/api/v1/clients/:id/portal/unlock` | Authenticated | `user` | `admin` | No | Unlock client portal access |
| **GET** | `/api/v1/audit` | Authenticated | `user` | `admin` | No | Query immutable audit logs |
| **GET** | `/health` | Public | - | - | No | Service health probe |
| **GET** | `/ready` | Public | - | - | No | Service readiness probe (MongoDB, Redis) |
| **GET** | `/api/v1/health` | Public | - | - | No | API v1 service health probe |
| **GET** | `/api/v1/ready` | Public | - | - | No | API v1 service readiness probe |
| **GET** | `/docs.json` | Public | - | - | No | OpenAPI JSON specification |

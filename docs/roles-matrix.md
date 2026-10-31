# LoomPilot Role-Based Access Control (RBAC) Matrix

Generated from `ROUTE_PERMISSION_MATRIX` in `@loompilot/shared`.
Enforced strictly at the API gateway layer via `authenticate` and `authorize` middleware. Default policy: **DENY ALL**.

| Method | Route Path | Access Level | Allowed Realms | Allowed Roles | Idempotent | Description |
|---|---|---|---|---|---|---|
| **POST** | `/api/v1/auth/login` | Public | - | - | No | Staff portal user login (admin, supervisor) |
| **POST** | `/api/v1/client/auth/login` | Public | - | - | No | Client portal login |
| **POST** | `/api/v1/auth/refresh` | Public | - | - | No | Staff portal token rotation |
| **POST** | `/api/v1/client/auth/refresh` | Public | - | - | No | Client portal token rotation |
| **POST** | `/api/v1/auth/logout` | Public | - | - | No | Staff portal session logout |
| **POST** | `/api/v1/client/auth/logout` | Public | - | - | No | Client portal session logout |
| **POST** | `/api/v1/auth/logout-all` | Authenticated | `user` | `admin`, `supervisor` | No | Staff user logout from all devices |
| **POST** | `/api/v1/client/auth/logout-all` | Authenticated | `client` | - | No | Client account logout from all devices |
| **POST** | `/api/v1/client/auth/accept-invite` | Public | - | - | Yes | Accept client invitation and activate account |
| **GET** | `/api/v1/me` | Authenticated | `user`, `client` | `admin`, `supervisor` | No | Get authenticated profile and permissions |
| **PATCH** | `/api/v1/me` | Authenticated | `user`, `client` | `admin`, `supervisor` | No | Update own profile settings |
| **POST** | `/api/v1/auth/change-password` | Authenticated | `user`, `client` | `admin`, `supervisor` | No | Change password and revoke other sessions |
| **GET** | `/api/v1/users` | Authenticated | `user` | `admin` | No | List staff users |
| **POST** | `/api/v1/users` | Authenticated | `user` | `admin` | No | Create staff user |
| **PATCH** | `/api/v1/users/:id` | Authenticated | `user` | `admin` | No | Update staff user |
| **POST** | `/api/v1/users/:id/lock` | Authenticated | `user` | `admin` | No | Lock staff user and revoke sessions |
| **POST** | `/api/v1/users/:id/unlock` | Authenticated | `user` | `admin` | No | Unlock staff user |
| **POST** | `/api/v1/clients/:id/portal/invite` | Authenticated | `user` | `admin` | No | Invite client contact with one-time invite token |
| **POST** | `/api/v1/clients/:id/portal/re-invite` | Authenticated | `user` | `admin` | No | Re-issue invitation for client portal and revoke active sessions |
| **POST** | `/api/v1/clients/:id/portal/reinvite` | Authenticated | `user` | `admin` | No | Re-issue invitation for client portal and revoke active sessions |
| **POST** | `/api/v1/clients/:id/portal/lock` | Authenticated | `user` | `admin` | No | Lock client portal access and revoke sessions |
| **POST** | `/api/v1/clients/:id/portal/unlock` | Authenticated | `user` | `admin` | No | Unlock client portal access |
| **GET** | `/api/v1/audit` | Authenticated | `user` | `admin` | No | Query immutable audit logs |
| **GET** | `/api/v1/settings` | Authenticated | `user` | `admin` | No | Get tenant configuration settings |
| **PATCH** | `/api/v1/settings` | Authenticated | `user` | `admin` | No | Update tenant configuration settings with optimistic lock |
| **GET** | `/api/v1/clients` | Authenticated | `user` | `admin` | No | List clients with search and pagination |
| **POST** | `/api/v1/clients` | Authenticated | `user` | `admin` | No | Create new client profile |
| **GET** | `/api/v1/clients/:id` | Authenticated | `user` | `admin` | No | Get client profile details |
| **PATCH** | `/api/v1/clients/:id` | Authenticated | `user` | `admin` | No | Update client profile |
| **DELETE** | `/api/v1/clients/:id` | Authenticated | `user` | `admin` | No | Deactivate client profile |
| **GET** | `/api/v1/suppliers` | Authenticated | `user` | `admin` | No | List suppliers with pagination |
| **POST** | `/api/v1/suppliers` | Authenticated | `user` | `admin` | No | Create supplier profile |
| **GET** | `/api/v1/suppliers/:id` | Authenticated | `user` | `admin` | No | Get supplier profile |
| **PATCH** | `/api/v1/suppliers/:id` | Authenticated | `user` | `admin` | No | Update supplier profile |
| **DELETE** | `/api/v1/suppliers/:id` | Authenticated | `user` | `admin` | No | Deactivate supplier |
| **GET** | `/api/v1/materials` | Authenticated | `user` | `admin`, `supervisor` | No | List materials with pagination and filters |
| **POST** | `/api/v1/materials` | Authenticated | `user` | `admin` | No | Create material |
| **GET** | `/api/v1/materials/:id` | Authenticated | `user` | `admin`, `supervisor` | No | Get material details |
| **PATCH** | `/api/v1/materials/:id` | Authenticated | `user` | `admin` | No | Update material |
| **DELETE** | `/api/v1/materials/:id` | Authenticated | `user` | `admin` | No | Delete material |
| **POST** | `/api/v1/materials/:id/rate` | Authenticated | `user` | `admin` | No | Update material rate and append trusted market price observation |
| **POST** | `/api/v1/materials/:id/offers` | Authenticated | `user` | `admin` | No | Update supplier offers for material |
| **GET** | `/api/v1/machines` | Authenticated | `user` | `admin`, `supervisor` | No | List factory machines |
| **POST** | `/api/v1/machines` | Authenticated | `user` | `admin` | No | Create machine with validated process area |
| **GET** | `/api/v1/machines/:id` | Authenticated | `user` | `admin`, `supervisor` | No | Get machine details |
| **PATCH** | `/api/v1/machines/:id` | Authenticated | `user` | `admin` | No | Update machine details |
| **DELETE** | `/api/v1/machines/:id` | Authenticated | `user` | `admin` | No | Delete machine |
| **GET** | `/api/v1/products` | Authenticated | `user` | `admin` | No | List products with BOM and routing |
| **POST** | `/api/v1/products` | Authenticated | `user` | `admin` | No | Create product with validated BOM and routing |
| **GET** | `/api/v1/products/:id` | Authenticated | `user` | `admin` | No | Get product details with BOM and routing |
| **PATCH** | `/api/v1/products/:id` | Authenticated | `user` | `admin` | No | Update product details |
| **DELETE** | `/api/v1/products/:id` | Authenticated | `user` | `admin` | No | Delete product |
| **POST** | `/api/v1/products/:id/images` | Authenticated | `user` | `admin` | No | Attach image file to product |
| **GET** | `/api/v1/client/products` | Authenticated | `client` | - | No | Client product catalogue (active items only, no costing) |
| **GET** | `/api/v1/client/products/:id` | Authenticated | `client` | - | No | Client product details (no costing) |
| **POST** | `/api/v1/files` | Authenticated | `user`, `client` | `admin`, `supervisor` | No | Upload file with ownership metadata |
| **GET** | `/api/v1/files/:id` | Authenticated | `user`, `client` | `admin`, `supervisor` | No | Download file with ownership check |
| **POST** | `/api/v1/stock/receipt` | Authenticated | `user` | `admin` | Yes | Record material goods receipt and increment stock |
| **POST** | `/api/v1/stock/adjust` | Authenticated | `user` | `admin` | No | Adjust stock with required reason and non-negative guard |
| **GET** | `/api/v1/stock/balances` | Authenticated | `user` | `admin` | No | Get real-time stock balances (total, reserved, available) |
| **GET** | `/api/v1/stock/movements` | Authenticated | `user` | `admin` | No | List stock movements history |
| **POST** | `/api/v1/imports/dry-run` | Authenticated | `user` | `admin` | No | CSV import dry run and error validation report |
| **POST** | `/api/v1/imports/commit` | Authenticated | `user` | `admin` | Yes | Commit verified CSV import idempotently |
| **GET** | `/health` | Public | - | - | No | Service health probe |
| **GET** | `/ready` | Public | - | - | No | Service readiness probe (MongoDB, Redis) |
| **GET** | `/api/v1/health` | Public | - | - | No | API v1 service health probe |
| **GET** | `/api/v1/ready` | Public | - | - | No | API v1 service readiness probe |
| **GET** | `/docs.json` | Public | - | - | No | OpenAPI JSON specification |

import { MongoUnitOfWork } from "./repositories/unit-of-work.js";
import { MongoAuditLogRepository } from "./repositories/audit.repository.js";
import { registerAuditRepository } from "./middleware/audit.js";

// Users & Auth
import { MongoUserRepository } from "./repositories/user.repository.js";
import { AuthService } from "./services/auth.service.js";
import { AuthController } from "./controllers/auth.controller.js";
import { createAuthRoutes } from "./routes/auth.routes.js";

// Enquiries
import { MongoEnquiryRepository } from "./repositories/enquiry.repository.js";
import { EnquiryService } from "./services/enquiry.service.js";
import { EnquiryController } from "./controllers/enquiry.controller.js";
import { createEnquiryRoutes } from "./routes/enquiry.routes.js";

// Customers
import { MongoCustomerRepository } from "./repositories/customer.repository.js";
import { CustomerService } from "./services/customer.service.js";
import { CustomerController } from "./controllers/customer.controller.js";
import { createCustomerRoutes } from "./routes/customer.routes.js";

// Materials
import { MongoMaterialRepository } from "./repositories/material.repository.js";
import { MaterialService } from "./services/material.service.js";
import { MaterialController } from "./controllers/material.controller.js";
import { createMaterialRoutes } from "./routes/material.routes.js";

// Suppliers
import { MongoSupplierRepository } from "./repositories/supplier.repository.js";
import { SupplierService } from "./services/supplier.service.js";
import { SupplierController } from "./controllers/supplier.controller.js";
import { createSupplierRoutes } from "./routes/supplier.routes.js";

// Processes
import { MongoProcessRepository } from "./repositories/process.repository.js";
import { ProcessService } from "./services/process.service.js";
import { ProcessController } from "./controllers/process.controller.js";
import { createProcessRoutes } from "./routes/process.routes.js";

// Workforce
import { MongoWorkforceRepository } from "./repositories/workforce.repository.js";
import { WorkforceService } from "./services/workforce.service.js";
import { WorkforceController } from "./controllers/workforce.controller.js";
import { createWorkforceRoutes } from "./routes/workforce.routes.js";

// Orders
import { MongoOrderRepository } from "./repositories/order.repository.js";
import { OrderService } from "./services/order.service.js";
import { OrderController } from "./controllers/order.controller.js";
import { createOrderRoutes } from "./routes/order.routes.js";

// Core Infrastructure
export const unitOfWork = new MongoUnitOfWork();
export const auditLogRepository = new MongoAuditLogRepository();
registerAuditRepository(auditLogRepository);

// Users & Auth Composition
export const userRepository = new MongoUserRepository();
export const authService = new AuthService(userRepository, auditLogRepository);
export const authController = new AuthController(authService);
export const authRoutes = createAuthRoutes(authController);

// Enquiries Composition
export const enquiryRepository = new MongoEnquiryRepository();
export const enquiryService = new EnquiryService(enquiryRepository, auditLogRepository);
export const enquiryController = new EnquiryController(enquiryService);
export const enquiryRoutes = createEnquiryRoutes(enquiryController);

// Customers Composition
export const customerRepository = new MongoCustomerRepository();
export const customerService = new CustomerService(customerRepository, auditLogRepository);
export const customerController = new CustomerController(customerService);
export const customerRoutes = createCustomerRoutes(customerController);

// Materials Composition
export const materialRepository = new MongoMaterialRepository();
export const materialService = new MaterialService(materialRepository, unitOfWork, auditLogRepository);
export const materialController = new MaterialController(materialService);
export const materialRoutes = createMaterialRoutes(materialController);

// Suppliers Composition
export const supplierRepository = new MongoSupplierRepository();
export const supplierService = new SupplierService(supplierRepository, auditLogRepository);
export const supplierController = new SupplierController(supplierService);
export const supplierRoutes = createSupplierRoutes(supplierController);

// Processes Composition
export const processRepository = new MongoProcessRepository();
export const processService = new ProcessService(processRepository, auditLogRepository);
export const processController = new ProcessController(processService);
export const processRoutes = createProcessRoutes(processController);

// Workforce Composition
export const workforceRepository = new MongoWorkforceRepository();
export const workforceService = new WorkforceService(workforceRepository, unitOfWork, auditLogRepository);
export const workforceController = new WorkforceController(workforceService);
export const workforceRoutes = createWorkforceRoutes(workforceController);

// Orders Composition
export const orderRepository = new MongoOrderRepository();
export const orderService = new OrderService(orderRepository, workforceRepository, unitOfWork, auditLogRepository);
export const orderController = new OrderController(orderService);
export const orderRoutes = createOrderRoutes(orderController);

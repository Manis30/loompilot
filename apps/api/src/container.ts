import { MongoUnitOfWork } from "./repositories/unit-of-work.js";
import { MongoAuditLogRepository } from "./repositories/audit.repository.js";
import { registerAuditRepository } from "./middleware/audit.js";

// Users & Auth
import { MongoUserRepository } from "./repositories/user.repository.js";
import { MongoRefreshTokenRepository } from "./repositories/refresh-token.repository.js";
import { AuthService } from "./services/auth.service.js";
import { AuthController } from "./controllers/auth.controller.js";
import { createAuthRoutes } from "./routes/auth.routes.js";
import { UserService } from "./services/user.service.js";
import { UserController } from "./controllers/user.controller.js";
import { createUserRoutes } from "./routes/user.routes.js";
import { AuditController } from "./controllers/audit.controller.js";
import { createAuditRoutes } from "./routes/audit.routes.js";

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

// Quotations
import { MongoQuotationRepository } from "./repositories/quotation.repository.js";
import { QuotationService } from "./services/quotation.service.js";
import { QuotationController } from "./controllers/quotation.controller.js";
import { createQuotationRoutes } from "./routes/quotation.routes.js";
import { PdfMakeRenderer } from "./integrations/pdf/pdfmake.renderer.js";

// Alerts & Recommendations
import { MongoAlertRepository } from "./repositories/alert.repository.js";
import { AlertService } from "./services/alert.service.js";
import { AlertController } from "./controllers/alert.controller.js";
import { createAlertRoutes } from "./routes/alert.routes.js";

// Deliveries
import { MongoDeliveryRepository } from "./repositories/delivery.repository.js";
import { DeliveryService } from "./services/delivery.service.js";
import { DeliveryController } from "./controllers/delivery.controller.js";
import { createDeliveryRoutes } from "./routes/delivery.routes.js";

// Payments
import { MongoPaymentRepository } from "./repositories/payment.repository.js";
import { PaymentService } from "./services/payment.service.js";
import { PaymentController } from "./controllers/payment.controller.js";
import { createPaymentRoutes } from "./routes/payment.routes.js";

// Reports
import { MongoReportRepository } from "./repositories/report.repository.js";
import { ReportService } from "./services/report.service.js";
import { ReportController } from "./controllers/report.controller.js";
import { createReportRoutes } from "./routes/report.routes.js";

// Agent Gateway
import { AgentGatewayService } from "./services/agent-gateway.service.js";
import { AgentGatewayController } from "./controllers/agent-gateway.controller.js";
import { createAgentGatewayRoutes } from "./routes/agent-gateway.routes.js";
import { UnavailableAgentsClient } from "./integrations/agents/unavailable.agents-client.js";

// Core Infrastructure
export const unitOfWork = new MongoUnitOfWork();
export const auditLogRepository = new MongoAuditLogRepository();
registerAuditRepository(auditLogRepository);
export const pdfRenderer = new PdfMakeRenderer();

// Users & Auth Composition
export const userRepository = new MongoUserRepository();
export const refreshTokenRepository = new MongoRefreshTokenRepository();
export const authService = new AuthService(userRepository, refreshTokenRepository, auditLogRepository);
export const authController = new AuthController(authService);
export const authRoutes = createAuthRoutes(authController);

export const userService = new UserService(userRepository, auditLogRepository);
export const userController = new UserController(userService);
export const userRoutes = createUserRoutes(userController);

export const auditController = new AuditController(auditLogRepository);
export const auditRoutes = createAuditRoutes(auditController);

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

// Quotations Composition
export const agentsClient = new UnavailableAgentsClient();
export const quotationRepository = new MongoQuotationRepository();
export const quotationService = new QuotationService(
  quotationRepository,
  customerRepository,
  materialRepository,
  processRepository,
  orderRepository,
  pdfRenderer,
  unitOfWork,
  auditLogRepository,
  agentsClient
);
export const quotationController = new QuotationController(quotationService);
export const quotationRoutes = createQuotationRoutes(quotationController);

// Alerts & Recommendations Composition
export const alertRepository = new MongoAlertRepository();
export const alertService = new AlertService(alertRepository, unitOfWork, auditLogRepository);
export const alertController = new AlertController(alertService);
export const alertRoutes = createAlertRoutes(alertController);

// Deliveries Composition
export const deliveryRepository = new MongoDeliveryRepository();
export const deliveryService = new DeliveryService(deliveryRepository, orderRepository, unitOfWork, auditLogRepository);
export const deliveryController = new DeliveryController(deliveryService);
export const deliveryRoutes = createDeliveryRoutes(deliveryController);

// Payments Composition
export const paymentRepository = new MongoPaymentRepository();
export const paymentService = new PaymentService(paymentRepository, unitOfWork, auditLogRepository);
export const paymentController = new PaymentController(paymentService);
export const paymentRoutes = createPaymentRoutes(paymentController);

// Reports Composition
export const reportRepository = new MongoReportRepository();
export const reportService = new ReportService(reportRepository);
export const reportController = new ReportController(reportService);
export const reportRoutes = createReportRoutes(reportController);

// Agent Gateway Composition
export const agentGatewayService = new AgentGatewayService(
  quotationService,
  alertService,
  paymentService
);
export const agentGatewayController = new AgentGatewayController(agentGatewayService);
export const agentGatewayRoutes = createAgentGatewayRoutes(agentGatewayController);

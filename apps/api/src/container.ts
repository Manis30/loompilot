import { MongoUnitOfWork } from "./repositories/unit-of-work.js";
import { MongoAuditLogRepository } from "./repositories/audit.repository.js";
import { registerAuditRepository } from "./middleware/audit.js";

// Enquiries
import { MongoEnquiryRepository } from "./repositories/enquiry.repository.js";
import { EnquiryService } from "./services/enquiry.service.js";
import { EnquiryController } from "./controllers/enquiry.controller.js";
import { createEnquiryRoutes } from "./routes/enquiry.routes.js";

// Core Infrastructure
export const unitOfWork = new MongoUnitOfWork();
export const auditLogRepository = new MongoAuditLogRepository();
registerAuditRepository(auditLogRepository);

// Enquiries Composition
export const enquiryRepository = new MongoEnquiryRepository();
export const enquiryService = new EnquiryService(enquiryRepository, auditLogRepository);
export const enquiryController = new EnquiryController(enquiryService);
export const enquiryRoutes = createEnquiryRoutes(enquiryController);

import { authPaths } from "./auth.paths.js";
import { userPaths } from "./user.paths.js";
import { auditPaths } from "./audit.paths.js";
import { customerPaths } from "./customer.paths.js";
import { enquiryPaths } from "./enquiry.paths.js";
import { quotationPaths } from "./quotation.paths.js";
import { materialPaths } from "./material.paths.js";
import { supplierPaths } from "./supplier.paths.js";
import { processPaths } from "./process.paths.js";
import { workforcePaths } from "./workforce.paths.js";
import { orderPaths } from "./order.paths.js";
import { alertPaths } from "./alert.paths.js";
import { deliveryPaths } from "./delivery.paths.js";
import { paymentPaths } from "./payment.paths.js";
import { reportPaths } from "./report.paths.js";
import { agentGatewayPaths } from "./agent-gateway.paths.js";
import { healthPaths } from "./health.paths.js";

export const openapiPaths = {
  ...healthPaths,
  ...authPaths,
  ...userPaths,
  ...auditPaths,
  ...customerPaths,
  ...enquiryPaths,
  ...quotationPaths,
  ...materialPaths,
  ...supplierPaths,
  ...processPaths,
  ...workforcePaths,
  ...orderPaths,
  ...alertPaths,
  ...deliveryPaths,
  ...paymentPaths,
  ...reportPaths,
  ...agentGatewayPaths,
};


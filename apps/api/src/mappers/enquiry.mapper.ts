import { Enquiry } from "../interfaces/enquiry.repository.js";

export function toEnquiryResponse(enquiry: Enquiry) {
  return {
    id: enquiry.id,
    enquiryNumber: enquiry.enquiryNumber,
    customerId: enquiry.customerId,
    customerName: enquiry.customerName,
    rawText: enquiry.rawText,
    parsedRequirements: enquiry.parsedRequirements,
    status: enquiry.status,
    createdAt: enquiry.createdAt,
    updatedAt: enquiry.updatedAt,
  };
}


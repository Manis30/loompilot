import { Customer } from "../interfaces/customer.repository.js";

export function toCustomerResponse(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    code: customer.code,
    contactPerson: customer.contactPerson,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    creditPeriodDays: customer.creditPeriodDays,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

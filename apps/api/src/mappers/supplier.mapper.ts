import { Supplier } from "../interfaces/supplier.repository.js";

export function toSupplierResponse(supplier: Supplier) {
  return {
    id: supplier.id,
    _id: supplier.id,
    tenantId: supplier.tenantId,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    leadTimeDays: supplier.leadTimeDays,
    rating: supplier.rating,
    suppliedMaterials: supplier.suppliedMaterials,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

import { BaseRepository } from "./base.repository.js";
import { ISupplier, SupplierModel } from "../models/identity/supplier.model.js";

export class SupplierRepository extends BaseRepository<ISupplier> {
  constructor() {
    super(SupplierModel);
  }
}


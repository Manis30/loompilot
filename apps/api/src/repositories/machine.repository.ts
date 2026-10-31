import { BaseRepository } from "./base.repository.js";
import { IMachine, MachineModel } from "../models/catalog/machine.model.js";

export class MachineRepository extends BaseRepository<IMachine> {
  constructor() {
    super(MachineModel);
  }
}


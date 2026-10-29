import { TxContext } from "./unit-of-work.js";

export interface ICounterRepository {
  getNextSequence(tenantId: string, entity: string, tx?: TxContext): Promise<number>;
  getNextDocumentNumber(
    tenantId: string,
    entity: string,
    prefix: string,
    digits?: number,
    tx?: TxContext
  ): Promise<string>;
}


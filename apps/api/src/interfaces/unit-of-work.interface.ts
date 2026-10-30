export interface TxContext {
  session: unknown;
}

export interface IUnitOfWork {
  withTransaction<T>(work: (tx: TxContext) => Promise<T>, existingTx?: TxContext): Promise<T>;
}


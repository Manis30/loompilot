export interface TxContext {
  session: any;
}

export interface IUnitOfWork {
  run<T>(fn: (tx: TxContext) => Promise<T>): Promise<T>;
}


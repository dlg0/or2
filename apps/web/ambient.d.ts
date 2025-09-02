declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    end(): Promise<void>;
  }
}


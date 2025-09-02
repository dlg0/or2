declare module 'cookie' {
  const mod: any;
  export default mod;
}

declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    end(): Promise<void>;
  }
}

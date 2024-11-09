export interface RegisterMethodPayload {
  host: string;
  port: number;
  serviceName: string;
  method: MethodType;
}

export interface RegisterMethodsPayload {
  host: string;
  port: number;
  serviceName: string;
  methods: MethodType[];
}

export interface MethodType {
  name: string;
  params: any[];
  description: string;
  handler: MethodHandlerType;
}

export interface UpdateMethodPayload {
  serviceName: string;
  methodName: string;
  method: Partial<MethodType>;
}

export interface DeleteMethodPayload {
  serviceName: string;
  methodName: string;
}

export interface InvokeMethodPayload {
  serviceName: string;
  method: Omit<MethodType, "handler" | "description">;
}

export type MethodHandlerType = (...params: any[]) => any;

export interface KubeRPCServerConfig {
  apiBaseURL: string;
  host?: string;
  port: number;
  serviceName: string;
}

export interface KubeRPCClientConfig {
  apiBaseURL: string;
  retries?: number;
  timeout?: number;
  retryDelay?: number;
}

export interface TimeoutConfigurable {
  config: { timeout: number };
}

export interface RetryConfigurable {
  config: { retries: number; retryDelay: number };
}

export interface UpdateServicePayload {
  serviceName: string;
  host: string;
  port: number;
}

export interface KubeRPCConfig {
  apiBaseURL: string;
  port: number | string;
}

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

export interface DeleteMethodPayload {
  serviceName: string;
  methodName: string;
}

export interface InvokeMethodPayload {
  serviceName: string;
  method: Omit<MethodType, "handler" | "description">;
}

export type MethodHandlerType = (...params: any[]) => any;

export interface StartPayload {
  port: number | string;
}

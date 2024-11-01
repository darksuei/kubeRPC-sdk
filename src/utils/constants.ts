export enum KubeRpcErrorEnum {
  InvalidEndpoint = "InvalidEndpoint",
  ServiceNotFound = "ServiceNotFound",
  MethodNotFound = "MethodNotFound",
  ConnectionError = "ConnectionError",
  InvalidParams = "InvalidParams",
  RegisterMethodError = "RegisterMethodError",
  DeleteMethodError = "DeleteMethodError",
  InternalServerError = "InternalServerError",
}
export enum ConnectionState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  ERROR,
}

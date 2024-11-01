import axios, { AxiosError } from "axios";
import { KubeRpcErrorEnum } from "./constants";

export class KubeRpcError extends Error {
  public readonly type: KubeRpcErrorEnum;
  public readonly details?: any;

  constructor(type: KubeRpcErrorEnum, message: string, details?: any) {
    super(message);
    this.type = type;
    this.details = details;

    Object.setPrototypeOf(this, KubeRpcError.prototype);
  }

  public static InvalidEndpoint(endpoint: string) {
    return new KubeRpcError(
      KubeRpcErrorEnum.InvalidEndpoint,
      `Invalid kubeRPC API endpoint.`,
      { endpoint },
    );
  }

  public static ServiceNotFound(serviceName: string) {
    return new KubeRpcError(
      KubeRpcErrorEnum.ServiceNotFound,
      `Service "${serviceName}" not found.`,
      { serviceName },
    );
  }

  public static MethodNotFound(methodName: string, serviceName: string) {
    return new KubeRpcError(
      KubeRpcErrorEnum.MethodNotFound,
      `Method "${methodName}" not found in service "${serviceName}".`,
      { methodName, serviceName },
    );
  }

  public static ConnectionError(host: string, port: number) {
    return new KubeRpcError(
      KubeRpcErrorEnum.ConnectionError,
      `Failed to connect to ${host}:${port}.`,
      { host, port },
    );
  }

  public static InvalidParams(params: any) {
    return new KubeRpcError(
      KubeRpcErrorEnum.InvalidParams,
      `Invalid parameters provided.`,
      { params },
    );
  }

  public static RegisterMethodError(details: any) {
    return new KubeRpcError(
      KubeRpcErrorEnum.RegisterMethodError,
      `Failed to register method.`,
      details,
    );
  }

  public static DeleteMethodError(details: any) {
    return new KubeRpcError(
      KubeRpcErrorEnum.DeleteMethodError,
      `Failed to delete method.`,
      details,
    );
  }
}

export async function handleError(error: AxiosError) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 404) {
      // Invalid endpoint
      return Promise.reject(
        new KubeRpcError(
          KubeRpcErrorEnum.InvalidEndpoint,
          `Invalid kubeRPC API endpoint. Please verify the endpoint URL.`,
        ),
      );
    }

    if (status === 500) {
      // Internal server error indicating an issue with the kubeRPC API
      return Promise.reject(
        new KubeRpcError(
          KubeRpcErrorEnum.InternalServerError,
          `KubeRPC API error: The server encountered an internal error. Please try again later.`,
        ),
      );
    }

    // Handle connection errors (e.g., no response)
    if (!error.response) {
      return Promise.reject(
        new KubeRpcError(
          KubeRpcErrorEnum.ConnectionError,
          `Connection error: Please check your network connection or the server status.`,
        ),
      );
    }
  }

  return Promise.reject(error);
}

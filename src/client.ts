// kuberpc-sdk/index.ts
import * as https from "https";
import axios, { AxiosInstance, HttpStatusCode } from "axios";
import { InvokeMethodPayload, KubeRPCConfig } from "./@types";
import { Socket } from "net";
import { handleError, KubeRpcError } from "./utils/error";
import { KubeRpcErrorEnum } from "./utils/constants";

export class KubeRPCClient {
  private apiClient: AxiosInstance;
  private httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });
  private config: Omit<KubeRPCConfig, "port" | "serviceName">;

  constructor({ apiBaseURL }: Omit<KubeRPCConfig, "port" | "serviceName">) {
    this.apiClient = axios.create({
      baseURL: apiBaseURL,
      headers: {
        "Content-Type": "application/json",
      },
      httpsAgent: this.httpsAgent,
    });

    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => handleError(error),
    );
    this.config = { apiBaseURL };
  }

  async validateEndpoint(endpoint?: string) {
    try {
      if (!endpoint)
        throw new KubeRpcError(
          KubeRpcErrorEnum.InvalidEndpoint,
          `Invalid kubeRPC API endpoint: endpoint is not provided.`,
        );

      const response = await this.apiClient.get("/health");

      if (response.status !== HttpStatusCode.Ok) {
        throw new KubeRpcError(
          KubeRpcErrorEnum.InvalidEndpoint,
          `Invalid kubeRPC API endpoint: received status code ${response.status}.`,
        );
      }
    } catch (error) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.InvalidEndpoint,
        `Invalid kubeRPC API endpoint: Unexpected error while validating kubeRPC API endpoint}`,
      );
    }
  }

  async initialize() {
    try {
      await this.validateEndpoint(this.config.apiBaseURL);
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.InternalServerError,
        `Error initializing KubeRPC service: ${error.message}`,
      );
    }
  }

  async invokeMethod({
    serviceName,
    method,
  }: InvokeMethodPayload): Promise<any> {
    try {
      const response = await this.apiClient.get(
        `/get-service-method?name=${serviceName}&method=${method.name}`,
      );

      if (
        response.status !== HttpStatusCode.Ok ||
        !response.data.host ||
        !response.data.port
      )
        throw new KubeRpcError(
          KubeRpcErrorEnum.MethodNotFound,
          `Method ${method.name} not found in service ${serviceName}`,
        );

      const { host, port } = response.data;

      const client = new Socket();

      return new Promise((resolve, reject) => {
        client.connect(port, host, () => {
          const requestPayload = {
            serviceName,
            method,
          };

          client.write(JSON.stringify(requestPayload));
        });

        client.on("data", (data) => {
          const response = JSON.parse(data.toString());
          if (response.error) reject(response.error);
          resolve(response);
          client.end();
        });

        client.on("error", (error) => {
          reject(error);
        });
      });
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.InternalServerError,
        `Error invoking method ${method.name} for service ${serviceName}: ${error.message}`,
      );
    }
  }
}

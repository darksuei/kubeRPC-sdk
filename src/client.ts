// kuberpc-sdk/index.ts
import * as https from "https";
import axios, { AxiosInstance, HttpStatusCode } from "axios";
import { InvokeMethodPayload, KubeRPCClientConfig } from "./@types";
import { Socket } from "net";
import { handleError, KubeRpcError } from "./utils/error";
import { KubeRpcErrorEnum } from "./utils/constants";
import { Retry, Timeout } from "./decorators";
import { encode, decode } from "@msgpack/msgpack";

export class KubeRPCClient {
  private apiClient: AxiosInstance;
  private httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });
  private config: Required<KubeRPCClientConfig>;

  constructor({
    apiBaseURL,
    retries,
    timeout,
    retryDelay,
  }: KubeRPCClientConfig) {
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

    this.config = {
      apiBaseURL,
      retries: retries || 3,
      timeout: timeout || 10000,
      retryDelay: retryDelay || 250,
    };
  }

  @Timeout()
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

  async getServices() {
    try {
      const response = await this.apiClient.get(`/get-all-services`);

      return response.data;
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.InternalServerError,
        `Error fetching services: ${error.message}`,
      );
    }
  }

  async getSingleService(serviceName: string) {
    try {
      const response = await this.apiClient.get(
        `/get-service?name=${serviceName}`,
      );

      return response.data;
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.InternalServerError,
        `Error fetching service methods: ${error.message}`,
      );
    }
  }

  @Timeout()
  @Retry()
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

      return new Promise((resolve, reject) => {
        const client = new Socket();

        client.setNoDelay(true);

        client.connect(port, host, () => {
          const requestPayload = {
            serviceName,
            method,
          };

          client.write(encode(requestPayload));
        });

        client.on("data", (data) => {
          const response = decode(data) as any;
          if (response.error) reject(response.error);
          if (!response.error) resolve(response);
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

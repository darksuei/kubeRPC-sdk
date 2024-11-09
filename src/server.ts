// kuberpc-sdk/index.ts
import * as https from "https";
import axios, { AxiosInstance, HttpStatusCode } from "axios";
import {
  DeleteMethodPayload,
  KubeRPCServerConfig,
  MethodHandlerType,
  RegisterMethodPayload,
  RegisterMethodsPayload,
  UpdateMethodPayload,
  UpdateServicePayload,
} from "./@types";
import net from "net";
import { handleError, KubeRpcError } from "./utils/error";
import { ConnectionState, KubeRpcErrorEnum } from "./utils/constants";
import { KubeConnectionHandler } from "./utils/socket";
import { encode, decode } from "@msgpack/msgpack";

export class KubeRPCServer {
  private apiClient: AxiosInstance;
  private httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });
  private methodHandlers = new Map<string, MethodHandlerType>();
  private server: net.Server | null = null;
  private connectionState = ConnectionState.DISCONNECTED;
  private config: KubeRPCServerConfig;

  constructor({ apiBaseURL, host, port, serviceName }: KubeRPCServerConfig) {
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
    this.config = { apiBaseURL, host, port, serviceName };
  }

  async validateEndpoint(endpoint?: string) {
    try {
      if (!endpoint)
        throw new KubeRpcError(
          KubeRpcErrorEnum.InvalidEndpoint,
          `Invalid kubeRPC API endpoint: endpoint is not provided.`,
        );

      const response = await this.apiClient.put(
        `/update-service?name=${this.config.serviceName}`,
        this.config,
      );

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
      const kubeConnectionHander = new KubeConnectionHandler();

      this.server = net.createServer((socket) => {
        this.connectionState = ConnectionState.CONNECTING;

        socket.on("data", (data) => {
          this.connectionState = ConnectionState.CONNECTED;
          kubeConnectionHander.recievedData(socket, data, this.methodHandlers);
        });

        socket.on("end", () => {
          this.connectionState = ConnectionState.DISCONNECTED;
        });

        socket.on("error", (error) => {
          this.connectionState = ConnectionState.ERROR;
          kubeConnectionHander.connectionTerminatedHandler(socket);
        });

        socket.setNoDelay(true);
      });

      this.server.listen(this.config.port, () => {
        kubeConnectionHander.newConnectionHandler(this.config.port);
      });
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.InternalServerError,
        `Error initializing KubeRPC service: ${error.message}`,
      );
    }
  }

  async registerMethod({
    serviceName,
    method,
  }: RegisterMethodPayload): Promise<void> {
    try {
      const payload = {
        service_name: serviceName,
        methods: [method],
      };

      // Store a ref to the method's handler in memory
      this.methodHandlers.set(`${serviceName}:${method.name}`, method.handler);

      // Associate the method with the service
      const { status } = await this.apiClient.post(
        "/register-methods",
        payload,
      );

      if (status !== HttpStatusCode.Ok)
        throw new KubeRpcError(
          KubeRpcErrorEnum.RegisterMethodError,
          `Error registering method for service ${serviceName}`,
        );
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.RegisterMethodError,
        `Error registering method ${method.name} for service ${serviceName}: ${error.message}`,
      );
    }
  }

  async registerMethods({
    serviceName,
    methods,
  }: RegisterMethodsPayload): Promise<void> {
    try {
      const payload = {
        service_name: serviceName,
        methods,
      };

      methods.forEach(({ name, handler }) => {
        this.methodHandlers.set(`${serviceName}:${name}`, handler);
      });

      const { status } = await this.apiClient.post(
        "/register-methods",
        payload,
      );

      if (status !== HttpStatusCode.Ok)
        throw new KubeRpcError(
          KubeRpcErrorEnum.RegisterMethodError,
          `Error registering methods for service ${serviceName}`,
        );
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.RegisterMethodError,
        `Error registering methods for service ${serviceName}: ${error.message}`,
      );
    }
  }

  async deleteMethod({
    serviceName,
    methodName,
  }: DeleteMethodPayload): Promise<void> {
    try {
      this.methodHandlers.delete(`${serviceName}:${methodName}`);

      const { status } = await this.apiClient.delete(
        `/delete-method?name=${serviceName}&method=${methodName}`,
      );

      if (status !== HttpStatusCode.Ok)
        throw new KubeRpcError(
          KubeRpcErrorEnum.DeleteMethodError,
          `Error deleting method for service ${serviceName}`,
        );
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.DeleteMethodError,
        `Error deleting method ${methodName} for service ${serviceName}: ${error.message}`,
      );
    }
  }

  async updateMethod({
    serviceName,
    methodName,
    method,
  }: UpdateMethodPayload): Promise<void> {
    try {
      if (method.handler) {
        this.methodHandlers.delete(`${serviceName}:${method.name}`);
        this.methodHandlers.set(
          `${serviceName}:${method.name}`,
          method.handler,
        );
      }

      const { status } = await this.apiClient.put(
        `/update-method?name=${serviceName}&method=${methodName}`,
        method,
      );

      if (status !== HttpStatusCode.Ok)
        throw new KubeRpcError(
          KubeRpcErrorEnum.InternalServerError,
          `Error updating method for service ${serviceName}`,
        );
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.InternalServerError,
        `Error updating method ${method.name} for service ${serviceName}: ${error.message}`,
      );
    }
  }

  async updateService({
    serviceName,
    host,
    port,
  }: UpdateServicePayload): Promise<void> {
    try {
      if (serviceName != this.config.serviceName) {
        throw new Error("Invalid service name. Cannot update service name.");
      }

      const { status } = await this.apiClient.put(
        `/update-service?name=${serviceName}`,
        {
          host,
          port,
        },
      );

      if (status !== HttpStatusCode.Ok)
        throw new KubeRpcError(
          KubeRpcErrorEnum.DeleteMethodError,
          `Error updating service ${serviceName}`,
        );
    } catch (error: any) {
      if (error instanceof KubeRpcError) throw error;

      throw new KubeRpcError(
        KubeRpcErrorEnum.InternalServerError,
        `Error updating service ${serviceName}: ${error.message}`,
      );
    }
  }
}

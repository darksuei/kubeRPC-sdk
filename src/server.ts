// kuberpc-sdk/index.ts
import * as https from "https";
import axios, { AxiosInstance, HttpStatusCode } from "axios";
import {
  DeleteMethodPayload,
  KubeRPCServerConfig,
  MethodHandlerType,
  RegisterMethodPayload,
  RegisterMethodsPayload,
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

  constructor({ apiBaseURL, port, serviceName }: KubeRPCServerConfig) {
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
    this.config = { apiBaseURL, port, serviceName };
  }

  async validateEndpoint(endpoint?: string) {
    try {
      if (!endpoint)
        throw new KubeRpcError(
          KubeRpcErrorEnum.InvalidEndpoint,
          `Invalid kubeRPC API endpoint: endpoint is not provided.`,
        );

      // Strict service check
      // const response = await this.apiClient.get(
      //   `/check-service-exists?name=${this.config.serviceName}`,
      // );

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

  async registerSingleMethod({
    host,
    port,
    serviceName,
    method,
  }: RegisterMethodPayload): Promise<void> {
    try {
      const payload = {
        host,
        port,
        service_name: serviceName,
        methods: [method],
      };

      // Store a ref to the method's handler in memory
      this.methodHandlers.set(`${serviceName}:${method.name}`, method.handler);

      // Associate the method with the service
      const { status } = await this.apiClient.post(
        "/register-service-method",
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
    host,
    port,
    serviceName,
    methods,
  }: RegisterMethodsPayload): Promise<void> {
    try {
      const payload = {
        host,
        port,
        service_name: serviceName,
        methods,
      };

      methods.forEach(({ name, handler }) => {
        this.methodHandlers.set(`${serviceName}:${name}`, handler);
      });

      const { status } = await this.apiClient.post(
        "/register-service-method",
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
        `/delete-service-method?name=${serviceName}&method=${methodName}`,
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
}

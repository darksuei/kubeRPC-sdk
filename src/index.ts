// kuberpc-sdk/index.ts
import * as https from "https";
import axios, { AxiosInstance } from "axios";
import {
  DeleteMethodPayload,
  InvokeMethodPayload,
  KubeRPCConfig,
  MethodHandlerType,
  RegisterMethodPayload,
  RegisterMethodsPayload,
  StartPayload,
} from "./@types";
import net, { Socket } from "net";

export class KubeRPC {
  private apiClient: AxiosInstance;
  private httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });
  private methodHandlers = new Map<string, MethodHandlerType>();
  private server: net.Server | null = null;

  constructor({ apiBaseURL }: KubeRPCConfig) {
    this.apiClient = axios.create({
      baseURL: apiBaseURL,
      headers: {
        "Content-Type": "application/json",
      },
      httpsAgent: this.httpsAgent,
    });
  }

  async start({ port }: StartPayload) {
    this.server = net.createServer((socket) => {
      console.log("Client connected.");

      socket.on("data", (data) => {
        console.log("Data received: ", data.toString());
        const request: InvokeMethodPayload = JSON.parse(data.toString());
        const { serviceName, method } = request;
        const { params } = method;

        // Check if the method exists
        const handler = this.methodHandlers.get(
          `${serviceName}:${method.name}`,
        );

        console.log(handler);

        if (handler) {
          try {
            // Call the method
            const result = handler(...params);
            console.log("Handler result", result);
            socket.write(JSON.stringify({ result }));
          } catch (error) {
            socket.write(JSON.stringify({ error: "Error executing method" }));
          }
        } else {
          socket.write(JSON.stringify({ error: "Method not found" }));
        }
      });

      socket.on("end", () => {
        console.log("Client disconnected.");
      });
    });

    this.server.listen(port, () => {
      console.log(`Service listening on port ${port}`);
    });
  }

  // Method to register an array of methods
  async registerMethod({
    host,
    port,
    serviceName,
    method,
  }: RegisterMethodPayload): Promise<any> {
    const payload = {
      host,
      port,
      service_name: serviceName,
      methods: [method],
    };

    this.methodHandlers.set(`${serviceName}:${method.name}`, method.handler);

    const response = await this.apiClient.post(
      "/register-service-method",
      payload,
    );
    return response.data;
  }

  // Method to register an array of methods
  async registerMethods({
    host,
    port,
    serviceName,
    methods,
  }: RegisterMethodsPayload): Promise<any> {
    const payload = {
      host,
      port,
      service_name: serviceName,
      methods,
    };

    methods.forEach(({ name, handler }) => {
      this.methodHandlers.set(`${serviceName}:${name}`, handler);
    });

    const response = await this.apiClient.post(
      "/register-service-method",
      payload,
    );
    return response.data;
  }

  // Method to delete a service function
  async deleteServiceMethod({
    serviceName,
    methodName,
  }: DeleteMethodPayload): Promise<any> {
    this.methodHandlers.delete(`${serviceName}:${methodName}`);

    const response = await this.apiClient.delete(
      `/delete-service-method?name=${serviceName}&method=${methodName}`,
    );
    return response.data;
  }

  async invokeMethod({
    serviceName,
    method,
  }: InvokeMethodPayload): Promise<any> {
    const response = await this.apiClient.get(
      `/get-service-method?name=${serviceName}&method=${method.name}`,
    );

    if (!response.data.host || !response.data.port) {
      throw new Error(
        `Method ${method.name} does not exist in service ${serviceName}`,
      );
    }

    const { host, port } = response.data;

    console.log("host", host, "port", port);

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
        resolve(response);
        client.end();
      });

      client.on("error", (error) => {
        reject(error);
      });
    });
  }
}

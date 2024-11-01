import net from "net";
import { InvokeMethodPayload } from "../@types";

export class KubeConnectionHandler {
  recievedData(
    socket: net.Socket,
    data: Buffer,
    methodHandlers: Map<string, Function>,
  ) {
    console.log("Data received: ", data.toString());
    const request: InvokeMethodPayload = JSON.parse(data.toString());
    const { serviceName, method } = request;
    const { params } = method;

    const handler = methodHandlers.get(`${serviceName}:${method.name}`);

    if (handler) {
      try {
        const result = handler(...params);
        socket.write(JSON.stringify({ result }));
      } catch (error) {
        socket.write(JSON.stringify({ error: "Error executing method" }));
      }
    } else {
      socket.write(JSON.stringify({ error: "Method not found" }));
    }
  }

  connectionTerminatedHandler(socket: net.Socket) {
    socket.destroy();
    console.log(`KubeRPC service terminated.`);
  }

  newConnectionHandler(port: number) {
    console.log(`KubeRPC service listening on port ${port}`);
  }
}

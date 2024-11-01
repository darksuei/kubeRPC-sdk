import net from "net";
import { InvokeMethodPayload } from "../@types";
import { decode, encode } from "@msgpack/msgpack";

export class KubeConnectionHandler {
  recievedData(
    socket: net.Socket,
    data: Buffer,
    methodHandlers: Map<string, Function>,
  ) {
    const request: InvokeMethodPayload = decode(data) as InvokeMethodPayload;
    const { serviceName, method } = request;
    const { params } = method;

    const handler = methodHandlers.get(`${serviceName}:${method.name}`);

    if (handler) {
      try {
        const result = handler(...params);
        socket.write(encode(result));
      } catch (error) {
        socket.write(encode({ error: "Error executing method" }));
      }
    } else {
      socket.write(encode({ error: "Method not found" }));
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

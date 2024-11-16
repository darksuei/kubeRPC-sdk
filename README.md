# KubeRPC Typescript SDK

The **Typescript SDK** enables easy integration with **kubeRPC core** to register and invoke service methods. Below is a quick guide to help you get started.

---

## Installation

Install the SDK with npm or yarn:

```bash
npm install kuberpc-sdk
```

or

```bash
yarn add kuberpc-sdk
```

---

## Usage

### 1. **Register a Method (Server Side)**

To allow clients to call methods, use `KubeRPCServer` to register methods:

```javascript
import { KubeRPCServer } from 'kuberpc-sdk';

const kubeRPCServer = new KubeRPCServer({
  apiBaseURL: 'http://kuberpc-core-url', // Replace with kubeRPC Core URL
  host: 'localhost', // No need to set this if you are running on Kubernetes and have service discovery enabled
  port: 8082,        // Service port
  serviceName: 'service-name', // Name of the service
});

await kubeRPCServer.initialize();

await kubeRPCServer.registerMethod({
  serviceName: 'service-name', // Your service name
  method: {
    name: 'method-name',         // Method name
    params: ['param1'],          // Method parameters
    handler: (params) => `Received: ${params.join(", ")}`, // Method handler
  },
});
```

### 2. **Initialize the Client**

To interact with the core and invoke methods, create and initialize a `KubeRPCClient`:

```javascript
import { KubeRPCClient } from 'kuberpc-sdk';

const kubeRPCClient = new KubeRPCClient({
  apiBaseURL: 'http://kuberpc-core-url',  // Replace with kubeRPC Core URL
  timeout: 10000, // Timeout for method calls
  retries: 2,     // Retry count for failed calls
});

await kubeRPCClient.initialize();
```

### 3. **Invoke a Method**

After initializing the client, use `invoke()` to call a method on a registered service:

```javascript
const response = await kubeRPCClient.invoke({
  serviceName: 'service-name', // Replace with the service name that owns the method
  method: {
    name: 'method-name',        // Replace with method name
    params: ['param1', 'param2'], // Method parameters
  },
});

console.log(response); // Logs the result of the method call
```

---

## Full Example

For a full working example, check out the [demo project](https://github.com/darksuei/kubeRPC-node-demo).

---

This is a quick overview of the core methods to register and call services using the **kubeRPC SDK**.

---

This streamlined version focuses on the key steps for initializing the client, invoking methods, and registering methods on the server.

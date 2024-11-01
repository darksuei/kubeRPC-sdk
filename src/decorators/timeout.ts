import { TimeoutConfigurable } from "../@types";

export function Timeout() {
  return (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const milliseconds = (this as TimeoutConfigurable).config.timeout;
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(
            new Error(`Function timed out after ${milliseconds} milliseconds`),
          );
        }, milliseconds);

        originalMethod
          .apply(this, args)
          .then((result: any) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error: any) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });
    };

    return descriptor;
  };
}

import { RetryConfigurable } from "../@types";

export function Retry() {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const maxAttempts = (this as RetryConfigurable).config.retries;
      const delay = (this as RetryConfigurable).config.retryDelay;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          if (attempt === maxAttempts) {
            throw error;
          } else {
            console.warn(
              `Attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    };

    return descriptor;
  };
}

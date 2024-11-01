export function Timeout(milliseconds: number) {
  return (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.log(`Function timed out after ${milliseconds} milliseconds`);
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

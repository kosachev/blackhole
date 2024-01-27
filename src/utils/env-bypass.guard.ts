export function EnvBypassGuard(key: string, value: any) {
  return function (target: object, name: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if (process.env[key] == value) {
      } else {
        return original.apply(this, args);
      }
    };
    return descriptor;
  };
}

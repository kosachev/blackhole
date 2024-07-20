export class GarbageCollector {
  private to_destruct: any[] = [];

  constructor() {}

  push(instance: any) {
    this.to_destruct.push(instance);
  }

  clean() {
    for (const instance of this.to_destruct) {
      instance.destructor();
    }
    this.to_destruct = [];
  }
}

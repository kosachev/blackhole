import { Injectable, MessageEvent } from "@nestjs/common";
import { watchFile, unwatchFile, PathLike, createReadStream, readFileSync, Stats } from "node:fs";
import { Observable } from "rxjs";
import type { Request } from "express";

@Injectable()
export class LogViewerService {
  tail(req: Request, file?: string, preload: boolean = true): Observable<MessageEvent> {
    if (!file) {
      const d = new Date();
      file = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.log`;
    }
    file = `./logs/${file}`;

    return new Observable<MessageEvent>((subscriber) => {
      if (preload) {
        const content = readFileSync(file, { encoding: "utf8" });
        content.split("\n").forEach((line) => subscriber.next({ data: line }));
      }
      const listener = async (curr: Stats, prev: Stats) => {
        (await this.readNBytes(file, prev.size, curr.size))
          .trim()
          .split("\n")
          .forEach((line) => subscriber.next({ data: line }));
      };
      watchFile(file, listener);
      req.on("close", () => unwatchFile(file, listener));
    });
  }

  private async readNBytes(
    path: PathLike,
    start: number,
    end: number,
    encoding: BufferEncoding = "utf8",
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of createReadStream(path, { start, end })) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString(encoding);
  }
}

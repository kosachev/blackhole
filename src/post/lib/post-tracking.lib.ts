const tracking_parse_pattern =
  /<ns3:historyRecord>.*?<ns3:OperationAddress>.*?<ns3:Index>(.*?)<\/ns3:Index>.*?<ns3:Description>(.*?)<\/ns3:Description>.*?<\/ns3:OperationAddress>.*?<ns3:OperType>.*?<ns3:Name>(.*?)<\/ns3:Name><\/ns3:OperType>.*?<ns3:OperDate>(.*?)<\/ns3:OperDate>.*?<\/ns3:historyRecord>/gm;

export type TrackingHistory = {
  last_operation: string;
  duration: number;
  history: {
    index: number;
    place: string;
    operation: string;
    datetime: Date;
  }[];
};

export class PostTrackingError extends Error {}

export class PostTrackingClient {
  constructor(
    private readonly login: string,
    private readonly password: string,
    private readonly on_error?: (error: PostTrackingError) => void | Promise<void>,
  ) {}

  async tracking(barcode: number): Promise<TrackingHistory> {
    try {
      const body = `
    <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:oper="http://russianpost.org/operationhistory" xmlns:data="http://russianpost.org/operationhistory/data" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header/>
    <soap:Body>
       <oper:getOperationHistory>
          <data:OperationHistoryRequest>
             <data:Barcode>${barcode}</data:Barcode>
             <data:MessageType>0</data:MessageType>
             <data:Language>RUS</data:Language>
          </data:OperationHistoryRequest>
          <data:AuthorizationHeader soapenv:mustUnderstand="1">
             <data:login>${this.login}</data:login>
             <data:password>${this.password}</data:password>
          </data:AuthorizationHeader>
       </oper:getOperationHistory>
    </soap:Body>
    </soap:Envelope>`;

      const res = await fetch(`https://tracking.russianpost.ru/rtm34`, {
        method: "POST",
        headers: {
          "content-type": "application/soap+xml; charset=utf-8",
          "content-length": body.length.toString(),
        },
        body: body,
      });

      const xml = await res.text();

      const out: TrackingHistory = {
        history: [],
        last_operation: "",
        duration: 0,
      };

      for (const match of xml.matchAll(tracking_parse_pattern)) {
        out.history.push({
          index: +match[1],
          place: match[2],
          operation: match[3],
          datetime: new Date(match[4]),
        });
      }

      out.last_operation = out.history.at(out.history.length - 1)?.operation ?? "";
      console.log(
        out.history.at(out.history.length - 1)?.datetime.valueOf() ?? 0,
        out.history.at(0)?.datetime.valueOf(),
      );
      out.duration =
        Math.abs(
          (out.history.at(out.history.length - 1)?.datetime.valueOf() ?? 0) -
            (out.history.at(0)?.datetime.valueOf() ?? 0),
        ) / 1000;

      return out;
    } catch (error) {
      const err = new PostTrackingError(`API request fialure: ${error.message}`);
      if (this.on_error) {
        this.on_error(err);
      } else {
        throw err;
      }
    }
  }
}

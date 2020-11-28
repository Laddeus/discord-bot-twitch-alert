import express, { Application, Request, Response } from "express";
import fetch, { HeadersInit } from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

enum WebhookRequestType {
  subscribe = "subscribe",
  unsubscribe = "unsubscribe",
}

export default class SubscriptionServer {
  private app: Application;
  private port: number | string;
  private clientID!: string;
  private accessToken!: string;
  private appSecret!: string;
  private webhookEndpoint!: string;
  private callbackEndpoint!: string;
  private streamChangeTopicURL!: string;
  private getUserByNameEndpoint!: string;
  private subscriptionExpiration!: number;
  private authorizedHeader!: HeadersInit;
  private subscriptionRequestBody!: WebhookSubscriptionBody;

  constructor(accessToken: string, clientID: string) {
    this.app = express();
    this.app.use(express.json());
    this.port = process.env.PORT || 443;
    this.setupTwitchAPIData(accessToken, clientID);
  }

  setupTwitchAPIData(accessToken: string, clientID: string) {
    this.clientID = clientID;
    this.accessToken = accessToken;
    this.appSecret = process.env.APP_SECRET || "applicationsecret";
    this.webhookEndpoint = "https://api.twitch.tv/helix/webhooks/hub";
    this.callbackEndpoint = "https://10cb5d0d9193.ngrok.io";
    this.streamChangeTopicURL = "https://api.twitch.tv/helix/streams?user_id=";
    this.getUserByNameEndpoint = "https://api.twitch.tv/helix/users?login=";
    this.subscriptionExpiration = 3600;
    this.authorizedHeader = {
      "Content-Type": "application/json",
      "Client-Id": this.clientID,
      Authorization: `Bearer ${this.accessToken}`,
    };

    this.subscriptionRequestBody = {
      "hub.mode": "",
      "hub.topic": "",
      "hub.callback": this.callbackEndpoint,
      "hub.secret": this.appSecret,
      "hub.lease_seconds": this.subscriptionExpiration,
    };
  }

  async startServerAndcreateSubscriptionEndpoint(
    subscriptionCallback: (streamInfo: StreamChangedEvent) => void,
    serverReadyCallback: () => void | undefined
  ) {
    this.app
      .route("/")
      .get((req: Request, res: Response) => {
        // verify that the request signature is valid

        res.status(200);

        if (req.query["hub.challenge"]) {
          res.send(req.query["hub.challenge"]);
        } else {
          res.send("Hi");
        }
      })
      .post((req: Request, res: Response) => {
        // verify that the request signature is valid

        console.log(req.query);
        console.log(req.body);
        const streamInfo = req.body.data[0];
        res.status(202).end();
        subscriptionCallback(streamInfo);
      });

    this.app.listen(this.port, serverReadyCallback);
  }

  async requestSubscription(mode: string, channelName: string) {
    let channelId = await this.getChannelIdByName(channelName);

    if (channelId) {
      const requestSubscriptionURL = this.webhookEndpoint;

      this.subscriptionRequestBody["hub.mode"] = mode;
      this.subscriptionRequestBody["hub.topic"] =
        this.streamChangeTopicURL + channelId;

      const requestOptions = {
        method: "POST",
        headers: this.authorizedHeader,
        body: JSON.stringify(this.subscriptionRequestBody),
      };

      try {
        const response = await fetch(requestSubscriptionURL, requestOptions);

        if (!response.ok) {
          channelId = null;
        }
      } catch (error) {
        console.log(error);
      }
    }

    return channelId;
  }

  async removeStreamChangedSubscription(channelName: string) {
    return await this.requestSubscription(
      WebhookRequestType.unsubscribe,
      channelName
    );
  }

  async addStreamChangedSubscription(channelName: string) {
    return await this.requestSubscription(
      WebhookRequestType.subscribe,
      channelName
    );
  }

  async getChannelIdByName(channelName: string) {
    const requestURL = this.getUserByNameEndpoint + channelName;
    const requestOptions = {
      method: "GET",
      headers: this.authorizedHeader,
    };

    let channelId: string | null = null;

    try {
      const response = await fetch(requestURL, requestOptions);
      if (response.ok) {
        const data = await response.json();
        channelId = data.data[0].id || null;
      }
    } catch (error) {
      console.log(error);
    }

    return channelId;
  }
}

const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

class SubscriptionServer {
  constructor(accessToken, clientID) {
    this.app = express();
    this.app.use(express.json());
    this.port = process.env.PORT || 443;

    this.subscribe = "subscribe";
    this.unsubscribe = "unsubscribe";

    this.setupTwitchAPIData(accessToken, clientID);
  }

  setupTwitchAPIData(accessToken, clientID) {
    this.clientID = clientID;
    this.accessToken = accessToken;
    this.appSecret = process.env.APP_SECRET;
    this.webhookEndpoint = "https://api.twitch.tv/helix/webhooks/hub";
    this.callbackEndpoint = "https://47b620098de0.ngrok.io";
    this.streamChangeTopicURL = "https://api.twitch.tv/helix/streams?user_id=";
    this.getUserByNameEndpoint = "https://api.twitch.tv/helix/users?login=";
    this.subscriptionExpiration = 3600;
    this.authorizedHeader = {
      "Content-Type": "application/json",
      "Client-Id": this.clientID,
      Authorization: `Bearer ${this.accessToken}`,
    };

    this.subscriptionRequestBody = {
      "hub.mode": null,
      "hub.topic": null,
      "hub.callback": this.callbackEndpoint,
      "hub.secret": this.appSecret,
      "hub.lease_seconds": this.subscriptionExpiration,
    };
  }

  async startServerAndcreateSubscriptionEndpoint(
    subscriptionCallback,
    serverReadyCallback
  ) {
    this.app
      .route("/")
      .get((req, res) => {
        // verify that the request signature is valid

        if (req.query["hub.challenge"]) {
          res.status(200).send(req.query["hub.challenge"]);
        }
      })
      .post((req, res) => {
        // verify that the request signature is valid

        console.log(req.query);
        console.log(req.body);
        const streamInfo = req.body.data[0];
        res.status(202).end();
        subscriptionCallback(streamInfo);
      });

    this.app.listen(this.port, serverReadyCallback);
  }

  async requestSubscription(mode, channelName) {
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

  async removeStreamChangedSubscription(channelName) {
    return await this.requestSubscription(this.unsubscribe, channelName);
  }

  async addStreamChangedSubscription(channelName) {
    return await this.requestSubscription(this.subscribe, channelName);
  }

  async getChannelIdByName(channelName) {
    const requestURL = this.getUserByNameEndpoint + channelName;
    const requestOptions = {
      method: "GET",
      headers: this.authorizedHeader,
    };

    let channelId = null;

    try {
      const response = await fetch(requestURL, requestOptions);
      if (response.ok) {
        const data = await response.json();
        channelId = data.data[0].id;
      }
    } catch (error) {
      console.log(error);
    }

    return channelId;
  }
}

module.exports = SubscriptionServer;

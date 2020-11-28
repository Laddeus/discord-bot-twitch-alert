import {
  Client,
  Channel,
  Message,
  TextChannel,
  DMChannel,
  NewsChannel,
  TextBasedChannelFields,
} from "discord.js";
import e from "express";
import fetch from "node-fetch";
import Streamer from "./streamer";
import SubscriptionServer from "./subscriptionServer";
require("dotenv").config();

interface CommandActions {
  [key: string]: (commandArgs: string[], channel: AlertChannel) => void;
}

type AlertChannel = TextBasedChannelFields;

class TwitchAlert {
  private bot: Client;
  private streamerWatchList: Streamer[];
  private usageMessage: string;
  private availableCommands: CommandActions;
  private clientID!: string | undefined;
  private clientSecret!: string | undefined;
  private discordToken!: string | undefined;
  private channelToPostIn!: AlertChannel;
  private accessToken!: string;
  private subscriptionServer!: SubscriptionServer;

  constructor() {
    this.setEnvriomentVariables();
    this.bot = new Client();
    this.setupBotListeners();

    this.streamerWatchList = [];
    this.usageMessage =
      "Usage: [!add s1, s2, s3... | !remove s1, s2, s3... | !watchlist | !currentlylive]";

    this.bindCommandMethods();
    this.availableCommands = {
      add: this.addStreamers,
      remove: this.removeStreamers,
      watchlist: this.listCurrentWatchList,
      currentlylive: this.listCurrentLiveStreamers,
    };
  }

  setEnvriomentVariables() {
    this.clientID = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.discordToken = process.env.DISCORD_TOKEN;
  }
  setupBotListeners() {
    this.bot.on("ready", async () => {
      console.log("Bot is online");
      this.channelToPostIn = <TextChannel>(
        this.bot.channels.cache.get("401356624310173716")
      );
    });

    this.bot.on("message", (receivedMessage: Message) => {
      if (!receivedMessage.author.bot) {
        const messageText = receivedMessage.content;

        if (messageText.startsWith("!")) {
          const command = messageText.replace(/,/g, "").split(" ");
          const commandName = command[0].slice(1);
          const commandArgs = command.slice(1);

          const action = this.availableCommands[commandName];
          if (action) {
            action(
              commandArgs,
              <TextBasedChannelFields>receivedMessage.channel
            );
          } else {
            receivedMessage.channel.send(this.usageMessage);
          }
        }
      }
    });
  }

  bindCommandMethods() {
    this.addStreamers = this.addStreamers.bind(this);
    this.removeStreamers = this.removeStreamers.bind(this);
    this.listCurrentWatchList = this.listCurrentWatchList.bind(this);
    this.listCurrentLiveStreamers = this.listCurrentLiveStreamers.bind(this);
    this.onStreamChange = this.onStreamChange.bind(this);
  }

  async startApp() {
    try {
      const response = await this.fetchTwitchAccessToken();

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;

        if (this.accessToken && this.clientID) {
          this.subscriptionServer = new SubscriptionServer(
            this.accessToken,
            this.clientID!
          );

          await this.subscriptionServer.startServerAndcreateSubscriptionEndpoint(
            this.onStreamChange,
            () => {
              console.log("Server up and running");
            }
          );

          await this.bot.login(this.discordToken);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  fetchTwitchAccessToken() {
    const requestString = `https://id.twitch.tv/oauth2/token?client_id=${this.clientID}&client_secret=${this.clientSecret}&grant_type=client_credentials`;
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    return fetch(requestString, requestOptions);
  }

  listCurrentLiveStreamers(commandArgs: string[], channel: AlertChannel) {
    const liveStreamers = this.streamerWatchList.filter(
      (streamer: Streamer) => streamer.IsLive
    );

    const liveStreamersWithTime = liveStreamers.map((streamer: Streamer) => {
      const streamStartTime = new Date(streamer.StreamStartTime);
      const currentTime = Date.now();
      const streamLiveTime =
        (currentTime - streamStartTime.getTime()) / (1000 * 3600);

      return `${streamer.Name}(${streamLiveTime.toPrecision(2)} hours)`;
    });

    channel.send(
      liveStreamersWithTime.length > 0
        ? liveStreamersWithTime.join(", ")
        : "no live streamers"
    );
  }

  listCurrentWatchList(commandArgs: string[], channel: AlertChannel) {
    if (this.streamerWatchList.length > 0) {
      const streamerNames = this.streamerWatchList.map(
        (streamer) => streamer.Name
      );
      channel.send(streamerNames.join(", "));
    } else {
      channel.send("No streamers in watch list");
    }
  }

  async removeStreamers(streamersToRemove: string[], channel: AlertChannel) {
    const streamersSuccessfullyRemoved = await this.removeStreamersFromWatchList(
      streamersToRemove
    );

    if (streamersSuccessfullyRemoved.length > 0) {
      channel.send(
        `${streamersSuccessfullyRemoved.join(", ")} ${
          streamersSuccessfullyRemoved.length === 1 ? "has" : "have"
        } been removed from the watch list.`
      );
    } else {
      channel.send("No streamers were found.");
    }
  }

  async addStreamers(streamersToAdd: string[], channel: AlertChannel) {
    const streamersSuccessfullyAdded = await this.addStreamersToWatchList(
      streamersToAdd
    );

    if (streamersSuccessfullyAdded.length > 0) {
      channel.send(
        `${streamersSuccessfullyAdded.join(", ")} ${
          streamersSuccessfullyAdded.length === 1 ? "has" : "have"
        } been added to the watch list!`
      );
    } else {
      channel.send(`Could not add streamers.`);
    }
  }

  alertChannel(streamer: Streamer, channel: AlertChannel) {
    if (channel) {
      channel.send(
        `@here, ${streamer.Name} is LIVE\n${streamer.StreamTitle}\nhttps://www.twitch.tv/${streamer.Name}`
      );
    } else {
      console.log("Channel not set up.");
    }
  }

  // might need to loop backwards!!
  async removeStreamersFromWatchList(streamersToRemove: string[]) {
    const successfullyRemovedStreamers = [];

    for (const streamer of streamersToRemove) {
      if (await this.removeStreamerFromWatchList(streamer)) {
        successfullyRemovedStreamers.push(streamer);
      }
    }

    return successfullyRemovedStreamers;
  }

  async removeStreamerFromWatchList(streamerToRemove: string) {
    let streamerRemovedSuccessfully = false;

    const indexOfStreamerToRemove = this.streamerWatchList.findIndex(
      (streamer) => streamer.Name === streamerToRemove
    );

    if (indexOfStreamerToRemove >= 0) {
      const streamerId = await this.subscriptionServer.removeStreamChangedSubscription(
        streamerToRemove
      );

      if (streamerId) {
        this.streamerWatchList.splice(indexOfStreamerToRemove, 1);
        streamerRemovedSuccessfully = true;
      }
    }

    return streamerRemovedSuccessfully;
  }

  async addStreamersToWatchList(streamersToAdd: string[]) {
    const successfullyAddedStreamers = [];

    for (const streamer of streamersToAdd) {
      if (await this.addStreamerToWatchList(streamer)) {
        successfullyAddedStreamers.push(streamer);
      }
    }

    return successfullyAddedStreamers;
  }

  async addStreamerToWatchList(streamerToAdd: string) {
    let streamerAddedSuccessfully = false;

    if (streamerToAdd !== "") {
      const streamerFound = this.streamerWatchList.find(
        (streamer) => streamer.Name === streamerToAdd
      );

      if (!streamerFound) {
        const streamerId = await this.subscriptionServer.addStreamChangedSubscription(
          streamerToAdd
        );

        console.log(streamerId);
        if (streamerId) {
          const streamer = new Streamer(streamerToAdd, streamerId);
          this.streamerWatchList.push(streamer);
          this.setStreamerInfo(streamer);
          streamerAddedSuccessfully = true;
        }
      }
    }

    return streamerAddedSuccessfully;
  }

  async setStreamerInfo(streamer: Streamer) {
    try {
      const response = await this.fetchStreamerInfo(streamer.Name);
      if (response.ok) {
        const data = await response.json();
        streamer.setInfo(data.data[0]);
      }
    } catch (error) {
      console.log(error);
    }
  }

  fetchStreamerInfo(streamerName: string) {
    const requestURL = `https://api.twitch.tv/helix/search/channels?query=${streamerName}&first=1`;
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": this.clientID!,
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    return fetch(requestURL, requestOptions);
  }

  onStreamChange(streamInfo: StreamChangedEvent) {
    if (streamInfo) {
      const streamerToUpdate = this.streamerWatchList.find(
        (streamer) => streamer.Id === streamInfo.user_id
      );

      if (streamerToUpdate) {
        if (!streamerToUpdate.IsLive) {
          this.alertChannel(streamerToUpdate, this.channelToPostIn);
        }
        streamerToUpdate.updateInfo(streamInfo);
      }
    }
  }
}

const twitchAlert = new TwitchAlert();
twitchAlert.startApp();

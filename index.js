const Discord = require("discord.js");
const fetch = require("node-fetch");
const Streamer = require("./streamer");
const SubscriptionServer = require("./server");
require("dotenv").config();

class TwitchAlert {
  constructor() {
    this.setEnvriomentVariables();
    this.bot = new Discord.Client();
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
      this.channelToPostIn = this.bot.channels.cache.find(
        (channel) => channel.name === "test-channel"
      );
    });

    this.bot.on("message", (receivedMessage) => {
      if (!receivedMessage.author.bot) {
        const messageText = receivedMessage.content;

        if (messageText.startsWith("!")) {
          const command = messageText.replace(/,/g, "").split(" ");
          const commandName = command[0].slice(1);
          const commandArgs = command.slice(1);

          const action = this.availableCommands[commandName];
          if (action) {
            action(commandArgs, receivedMessage.channel);
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
        this.subscriptionServer = new SubscriptionServer(
          this.accessToken,
          this.clientID
        );
        await this.subscriptionServer.startServerAndcreateSubscriptionEndpoint(
          this.onStreamChange,
          () => {
            console.log("Server up and running");
          }
        );

        await this.bot.login(this.discordToken);
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

  listCurrentLiveStreamers(commandArgs, channel) {
    const liveStreamers = this.streamerWatchList.filter(
      (streamer) => streamer.isLive
    );

    const liveStreamersWithTime = liveStreamers.map((streamer) => {
      const streamStartTime = new Date(streamer.streamStartTime);
      const currentTime = Date.now();
      const streamLiveTime =
        (currentTime - streamStartTime.getTime()) / (1000 * 3600);

      return `${streamer.name}(${streamLiveTime.toPrecision(2)} hours)`;
    });

    channel.send(
      liveStreamersWithTime.length > 0
        ? liveStreamersWithTime.join(", ")
        : "no live streamers"
    );
  }

  listCurrentWatchList(commandArgs, channel) {
    if (this.streamerWatchList.length > 0) {
      const streamerNames = this.streamerWatchList.map(
        (streamer) => streamer.name
      );
      channel.send(streamerNames.join(", "));
    } else {
      channel.send("No streamers in watch list");
    }
  }

  async removeStreamers(streamersToRemove, channel) {
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

  async addStreamers(stremersToAdd, channel) {
    const streamersSuccessfullyAdded = await this.addStreamersToWatchList(
      stremersToAdd
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

  alertChannel(streamer, channel) {
    channel.send(
      `@here, ${streamer.name} is LIVE\n${streamer.streamTitle}\nhttps://www.twitch.tv/${streamer.name}`
    );
  }

  // might need to loop backwards!!
  async removeStreamersFromWatchList(streamersToRemove) {
    const successfullyRemovedStreamers = [];

    for (const streamer of streamersToRemove) {
      if (await this.removeStreamerFromWatchList(streamer)) {
        successfullyRemovedStreamers.push(streamer);
      }
    }

    return successfullyRemovedStreamers;
  }

  async removeStreamerFromWatchList(streamerToRemove) {
    let streamerRemovedSuccessfully = false;

    const indexOfStreamerToRemove = this.streamerWatchList.findIndex(
      (streamer) => streamer.name === streamerToRemove
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

  async addStreamersToWatchList(streamersToAdd) {
    const successfullyAddedStreamers = [];

    for (const streamer of streamersToAdd) {
      if (await this.addStreamerToWatchList(streamer)) {
        successfullyAddedStreamers.push(streamer);
      }
    }

    return successfullyAddedStreamers;
  }

  async addStreamerToWatchList(streamerToAdd) {
    let streamerAddedSuccessfully = false;

    if (streamerToAdd !== "") {
      const streamerFound = this.streamerWatchList.find(
        (streamer) => streamer.name === streamerToAdd
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

  async setStreamerInfo(streamer) {
    try {
      const response = await this.fetchStreamerInfo(streamer.name);
      if (response.ok) {
        const data = await response.json();
        streamer.setInfo(data.data[0]);
      }
    } catch (error) {
      console.log(error);
    }
  }

  fetchStreamerInfo(streamerName) {
    const requestURL = `https://api.twitch.tv/helix/search/channels?query=${streamerName}&first=1`;
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": this.clientID,
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    return fetch(requestURL, requestOptions);
  }

  onStreamChange(streamInfo) {
    if (streamInfo) {
      const streamerToUpdate = this.streamerWatchList.find(
        (streamer) => streamer.id === streamInfo.user_id
      );

      if (streamerToUpdate) {
        if (!streamerToUpdate.isLive) {
          this.alertChannel(streamerToUpdate, this.channelToPostIn);
        }
        streamerToUpdate.updateInfo(streamInfo);
      }
    }
  }
}

const twitchAlert = new TwitchAlert();
twitchAlert.startApp();

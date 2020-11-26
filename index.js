const Discord = require("discord.js");
const fetch = require("node-fetch");
const Streamer = require("./streamer");

require("dotenv").config();

const clientID = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

const bot = new Discord.Client();
const streamerWatchList = [];
const usage =
  "Usage: [!add s1, s2, s3... | !remove s1, s2, s3... | !watchlist | !currentlylive]";

const availableCommands = {
  add: addStreamers,
  remove: removeStreamers,
  watchlist: listCurrentWatchList,
  currentlylive: listCurrentLiveStreamers,
};

let accessToken;
let channelToPostIn;

getTwitchAccessToken();

bot.on("ready", async () => {
  console.log("Bot is online");
  channelToPostIn = bot.channels.cache.find(
    (channel) => channel.name == "stream-alert"
  );

  setTimeout(scanWatchLists, 10000);
});

bot.on("message", (receivedMessage) => {
  if (!receivedMessage.author.bot) {
    const messageText = receivedMessage.content;

    if (messageText.startsWith("!")) {
      const command = messageText.replace(/,/g, "").split(" ");
      const commandName = command[0].slice(1);
      const commandArgs = command.slice(1);

      const action = availableCommands[commandName];

      if (action) {
        action(commandArgs, receivedMessage.channel);
      } else {
        receivedMessage.channel.send(usage);
      }
    }
  }
});

function listCurrentLiveStreamers(commandArgs, channel) {
  const liveStreamers = streamerWatchList.filter((streamer) => streamer.isLive);

  const liveStreamersWithTime = liveStreamers.map((streamer) => {
    const streamStartTime = new Date(streamer.streamStartTime);
    const currentTime = Date.now();
    const streamLiveTime =
      (currentTime - streamStartTime.getTime()) / (1000 * 3600);

    return `${streamer.name}(${streamLiveTime.toPrecision(2)} hours)`;
  });

  channel.send(
    liveStreamersWithTime.length > 0
      ? liveStreamersWithTime.join(",")
      : "no live streamers"
  );
}

function listCurrentWatchList(commandArgs, channel) {
  if (streamerWatchList.length > 0) {
    const streamerNames = streamerWatchList.map((streamer) => streamer.name);
    channel.send(streamerNames.join(", "));
  } else {
    channel.send("no streamers in watch list");
  }
}

function removeStreamers(streamersToRemove, channel) {
  const streamersSuccessfullyRemoved = removeStreamersFromWatchList(
    streamersToRemove
  );

  if (streamersSuccessfullyRemoved.length > 0) {
    channel.send(
      `${streamersSuccessfullyRemoved.join(", ")} ${
        streamersSuccessfullyRemoved.length === 1 ? "has" : "have"
      } been removed from the watch list.`
    );
  } else {
    channel.send("no streamers were found.");
  }
}

function addStreamers(stremersToAdd, channel) {
  streamersSuccessfullyAdded = addStreamersToWatchList(stremersToAdd);

  if (streamersSuccessfullyAdded.length > 0) {
    channel.send(
      `${streamersSuccessfullyAdded.join(", ")} ${
        streamersSuccessfullyAdded.length === 1 ? "has" : "have"
      } been added to the watch list!`
    );
  } else {
    channel.send(`all the streamers are already in the watch list.`);
  }
}

function alertChannel(streamer, channel) {
  channel.send(
    `@here, ${streamer.name} is LIVE\n${streamer.streamTitle}\nhttps://www.twitch.tv/${streamer.name}`
  );
}

async function scanStreamerWatchList() {
  for (const streamer of streamerWatchList) {
    const wasStreamerLive = streamer.isLive;

    await streamer.updateInfo(clientID, accessToken);

    if (!wasStreamerLive && streamer.isLive) {
      alertChannel(streamer, channelToPostIn);
    }
  }
}

async function scanWatchLists() {
  scanStreamerWatchList();

  console.log(streamerWatchList);
  setTimeout(scanWatchLists, 10000);
}

// might need to loop backwards!!
function removeStreamersFromWatchList(streamersToRemove) {
  const successfullyRemovedStreamers = [];

  for (const streamer of streamersToRemove) {
    if (removeStreamerFromWatchList(streamer)) {
      successfullyRemovedStreamers.push(streamer);
    }
  }

  return successfullyRemovedStreamers;
}

function removeStreamerFromWatchList(streamerToRemove) {
  let streamerRemovedSuccessfully = false;

  const indexOfStreamerToRemove = streamerWatchList.findIndex(
    (streamer) => streamer.name === streamerToRemove
  );

  if (indexOfStreamerToRemove >= 0) {
    streamerWatchList.splice(indexOfStreamerToRemove, 1);
    streamerRemovedSuccessfully = true;
  }

  return streamerRemovedSuccessfully;
}

function addStreamersToWatchList(streamersToAdd) {
  const successfullyAddedStreamers = [];
  for (const streamer of streamersToAdd) {
    if (addStreamerToWatchList(streamer)) {
      successfullyAddedStreamers.push(streamer);
    }
  }

  return successfullyAddedStreamers;
}

function addStreamerToWatchList(streamerToAdd) {
  let streamerAddedSuccessfully = false;

  if (streamerToAdd !== "") {
    const existingStreamer = streamerWatchList.find(
      (streamer) => streamer.name === streamerToAdd
    );

    if (!existingStreamer) {
      streamerWatchList.push(new Streamer(streamerToAdd));
      streamerAddedSuccessfully = true;
    }
  }

  return streamerAddedSuccessfully;
}

function getTwitchAccessToken() {
  const requestString = `https://id.twitch.tv/oauth2/token?client_id=${clientID}&client_secret=${clientSecret}&grant_type=client_credentials`;

  fetch(requestString, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      accessToken = data.access_token;
      bot.login(process.env.TOKEN);
    })
    .catch((error) => console.log(error));
}

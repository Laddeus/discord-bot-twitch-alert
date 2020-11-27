const { default: fetch } = require("node-fetch");

class Streamer {
  constructor(streamerName, streamerId) {
    this.name = streamerName;
    this.id = streamerId;
    this.isLive = false;
    this.streamTitle = "";
    this.streamStartTime = null;
  }

  setInfo(streamInfo) {
    if (streamInfo) {
      this.isLive = streamInfo.is_live;
      this.streamTitle = streamInfo.title;
      this.streamStartTime = streamInfo.started_at;
    }
  }

  updateInfo(streamInfo) {
    if (streamInfo) {
      this.streamTitle = streamInfo.title;
      this.streamStartTime = streamInfo.started_at;
    }

    this.isLive = Boolean(streamInfo);
  }
}

module.exports = Streamer;

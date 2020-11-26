const { default: fetch } = require("node-fetch");

class Streamer {
  constructor(streamerName) {
    this.name = streamerName;
    this.isLive = false;
    this.streamTitle = "";
    this.streamStartTime = null;
  }

  async updateInfo(clientID, accessToken) {
    const streamerInfo = await this.fetchInfo(clientID, accessToken);
    this.isLive = streamerInfo.is_live;
    this.streamTitle = streamerInfo.title;
    this.streamStartTime = this.isLive ? streamerInfo.started_at : null;
  }

  async fetchInfo(clientID, accessToken) {
    const requestURL = `https://api.twitch.tv/helix/search/channels?query=${this.name}`;
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "client-id": clientID,
        Authorization: `Bearer ${accessToken}`,
      },
    };

    try {
      const response = await fetch(requestURL, requestOptions);

      if (response.ok) {
        const streamers = await response.json();

        return streamers.data[0]; // return first streamer found in the search list
      }
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = Streamer;

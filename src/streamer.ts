export default class Streamer {
  private name: string;
  private id: string;
  private isLive: boolean;
  private streamTitle: string;
  private streamStartTime: string;

  constructor(streamerName: string, streamerId: string) {
    this.name = streamerName;
    this.id = streamerId;
    this.isLive = false;
    this.streamTitle = "";
    this.streamStartTime = "";
  }

  get Name() {
    return this.name;
  }

  get Id() {
    return this.id;
  }

  get IsLive() {
    return this.isLive;
  }

  get StreamTitle() {
    return this.streamTitle;
  }

  get StreamStartTime() {
    return this.streamStartTime;
  }

  setInfo(channlelInfo: ChannelSearchEvent | null) {
    if (channlelInfo) {
      this.isLive = channlelInfo.is_live;
      this.streamTitle = channlelInfo.title;
      this.streamStartTime = channlelInfo.started_at;
    }
  }

  updateInfo(streamInfo: StreamChangedEvent | null) {
    if (streamInfo) {
      this.streamTitle = streamInfo.title;
      this.streamStartTime = streamInfo.started_at;
    }

    this.isLive = Boolean(streamInfo);
  }
}

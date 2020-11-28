interface StreamChangedEvent {
  id: string;
  user_id: string;
  user_name: string;
  game_id: string;
  community_ids: string[] | null;
  type: string;
  title: string;
  viewer_count: Number;
  started_at: string;
  language: string;
  thumbnail_url: string;
}

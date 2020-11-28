interface WebhookSubscriptionBody {
  "hub.mode": string;
  "hub.topic": string;
  "hub.callback": string;
  "hub.secret": string;
  "hub.lease_seconds": Number;
}

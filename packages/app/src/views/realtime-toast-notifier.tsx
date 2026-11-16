import { useEffect } from "react";
import { toast } from "@honocube/ui";
import {
  useRealtimeClient,
  type RealtimeToastNotifierProps,
  type RealtimeEvent,
} from "@honocube/core";

export function RealtimeToastNotifier({
  client: clientProp,
  resourceLabels = {},
  filter,
  formatMessage,
}: RealtimeToastNotifierProps): null {
  const contextClient = useRealtimeClient();
  const client = clientProp || contextClient;

  useEffect(() => {
    if (!client || typeof client.subscribe !== "function") return;

    const unsubscribe = client.subscribe("*", (event: RealtimeEvent) => {
      if (filter && !filter(event)) return;

      if (formatMessage) {
        const msg = formatMessage(event);
        if (msg) {
          toast(msg.title, { description: msg.description });
        }
        return;
      }

      // Default toast formatting
      const rawRes = event.resource || "Record";
      const friendlyRes =
        resourceLabels[rawRes] ||
        rawRes.charAt(0).toUpperCase() + rawRes.slice(1);

      let action = event.type;
      if (event.type === "create") action = "created";
      else if (event.type === "update") action = "updated";
      else if (event.type === "delete") action = "deleted";

      const title = `${friendlyRes} ${action}`;
      const recordId =
        event.ids && event.ids.length > 0
          ? event.ids.join(", ")
          : event.data?.id !== undefined
          ? String(event.data.id)
          : undefined;

      const description = recordId ? `ID: ${recordId}` : undefined;

      toast(title, { description });
    });

    return () => {
      unsubscribe();
    };
  }, [client, resourceLabels, filter, formatMessage]);

  return null;
}

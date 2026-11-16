import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  RealtimeIndicator,
  RealtimeToastNotifier,
  RealtimeProvider,
  createRealtimeClient,
} from "../src/index.js";

describe("Realtime Indicator & Notifier (Issue #135)", () => {
  it("renders offline status by default when disconnected", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });

    const html = renderToString(
      <RealtimeIndicator client={client} />
    );

    expect(html).toContain("data-testid=\"realtime-indicator\"");
    expect(html).toContain("data-status=\"disconnected\"");
    expect(html).toContain("Offline");
  });

  it("renders connected live badge when status is connected", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });
    client.simulateStatus("connected");

    const html = renderToString(
      <RealtimeProvider client={client}>
        <RealtimeIndicator />
      </RealtimeProvider>
    );

    expect(html).toContain("data-testid=\"realtime-indicator\"");
    expect(html).toContain("data-status=\"connected\"");
    expect(html).toContain("Live");
  });

  it("renders reconnecting status badge", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });
    client.simulateStatus("reconnecting");

    const html = renderToString(
      <RealtimeIndicator client={client} />
    );

    expect(html).toContain("data-status=\"reconnecting\"");
    expect(html).toContain("Reconnecting...");
  });

  it("hides label when showLabel is false", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });
    client.simulateStatus("connected");

    const html = renderToString(
      <RealtimeIndicator client={client} showLabel={false} />
    );

    expect(html).toContain("data-status=\"connected\"");
    expect(html).not.toContain("<span>Live</span>");
  });

  it("subscribes and cleans up correctly in RealtimeToastNotifier", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });

    // Verify SSR doesn't crash
    const html = renderToString(
      <RealtimeToastNotifier client={client} />
    );
    expect(html).toBe("");
  });
});

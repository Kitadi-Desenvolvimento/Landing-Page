"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getSiteAnalyticsSessionId } from "./lib/site-analytics-client";

type AnalyticsEvent = {
  eventType: "page_view" | "contact_click";
  sessionId: string;
  pagePath: string;
  productSlug?: string;
  channel?: "whatsapp" | "email" | "phone";
};

function getProductSlug(pathname: string, element?: HTMLElement) {
  const taggedSlug = element?.closest<HTMLElement>("[data-analytics-product]")
    ?.dataset.analyticsProduct;
  if (taggedSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(taggedSlug)) {
    return taggedSlug;
  }

  const productPage = pathname.match(/^\/produtos\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (productPage) return productPage[1];

  return null;
}

function getContactChannel(href: string) {
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href)) return "whatsapp";
  if (/^mailto:/i.test(href)) return "email";
  if (/^tel:/i.test(href)) return "phone";
  return null;
}

export default function SiteAnalytics() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);
  const errorReported = useRef(false);

  useEffect(() => {
    if (pathname.startsWith("/backoffice") || pathname.startsWith("/api")) return;
    const storedSessionId = getSiteAnalyticsSessionId();
    if (storedSessionId === null) return;
    const sessionId: string = storedSessionId;

    function track(event: Omit<AnalyticsEvent, "sessionId" | "pagePath">) {
      const payload: AnalyticsEvent = {
        ...event,
        sessionId,
        pagePath: pathname,
      };
      void fetch("/api/site-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).then((response) => {
        if (!response.ok) throw new Error(`Analytics request failed (${response.status}).`);
      }).catch((error: unknown) => {
        if (errorReported.current) return;
        errorReported.current = true;
        console.warn("[site-analytics] Event could not be recorded.", error);
      });
    }

    if (lastTrackedPath.current !== pathname) {
      lastTrackedPath.current = pathname;
      track({
        eventType: "page_view",
        productSlug: getProductSlug(pathname) ?? undefined,
      });
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const channel = getContactChannel(anchor.href);
      if (!channel) return;
      track({
        eventType: "contact_click",
        channel,
        productSlug: getProductSlug(pathname, anchor) ?? undefined,
      });
    }

    function handleSubmit(event: SubmitEvent) {
      if (!(event.target instanceof HTMLFormElement)) return;
      const channel = getContactChannel(event.target.action);
      if (!channel) return;
      track({
        eventType: "contact_click",
        channel,
        productSlug: getProductSlug(pathname, event.target) ?? undefined,
      });
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [pathname]);

  return null;
}

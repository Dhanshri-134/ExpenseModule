"use client";

import { memo, useMemo, useRef } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useMeasuredMemo, useRenderMetric } from "@/shared/performance/useMeasuredMemo";

const DEFAULT_ROW_HEIGHT = 88;
const DEFAULT_VIRTUALIZATION_THRESHOLD = 12;

const ActivityFeedRow = memo(function ActivityFeedRow({ item, renderItem }) {
  return renderItem(item);
});

export function VirtualizedActivityFeed({
  items = [],
  renderItem,
  emptyMessage = "No activity yet.",
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
  estimateSize = DEFAULT_ROW_HEIGHT,
  overscan = 4,
  metricName = "activity-feed",
}) {
  const containerRef = useRef(null);
  useRenderMetric(`${metricName}.render`, { size: items.length });

  const feedItems = useMeasuredMemo(
    `${metricName}.items`,
    () => items,
    [items],
    { size: items.length }
  );
  const shouldVirtualize = feedItems.length >= virtualizationThreshold;

  const virtualizer = useWindowVirtualizer({
    count: shouldVirtualize ? feedItems.length : 0,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => feedItems[index]?.id || index,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const topPadding = virtualItems[0]?.start ?? 0;
  const bottomPadding = totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0);

  const visibleItems = useMemo(() => {
    if (!shouldVirtualize) return feedItems;
    return virtualItems.map((virtualItem) => ({
      virtualItem,
      item: feedItems[virtualItem.index],
    }));
  }, [feedItems, shouldVirtualize, virtualItems]);

  if (!feedItems.length) {
    return <div className="text-sm text-[color:var(--acm-muted-fg)]">{emptyMessage}</div>;
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {shouldVirtualize ? (
        <>
          {topPadding > 0 ? <div style={{ height: `${topPadding}px` }} aria-hidden="true" /> : null}
          {visibleItems.map(({ item, virtualItem }) => (
            <div key={virtualItem.key} ref={virtualizer.measureElement} data-index={virtualItem.index}>
              <ActivityFeedRow item={item} renderItem={renderItem} />
            </div>
          ))}
          {bottomPadding > 0 ? <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" /> : null}
        </>
      ) : (
        feedItems.map((item) => (
          <ActivityFeedRow key={item.id} item={item} renderItem={renderItem} />
        ))
      )}
    </div>
  );
}

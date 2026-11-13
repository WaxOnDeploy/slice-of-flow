import { applyAction } from "@/lib/sofEngine/engine";
import type {
  DemandOrder,
  Engine as EngineState,
  Station,
} from "@/lib/sofEngine/types";

export interface SliceOfFlowVipWatchProps {
  engine: EngineState;
  onAdmit(order: DemandOrder): void;
  onShowArrivals(): void;
}

const STATION_NAMES: Record<Station, string> = {
  orderQueue: "Orders",
  prep: "Prep",
  oven: "Oven",
  boxDeliver: "Pizza Box",
};
const byArrival = (a: DemandOrder, b: DemandOrder) =>
  a.availableAtMs - b.availableAtMs ||
  a.ordinal - b.ordinal ||
  a.orderKey.localeCompare(b.orderKey);
const seconds = (ms: number) => `${Math.ceil(ms / 1000)}s`;
function due(order: DemandOrder, nowMs: number): string {
  if (order.deadlineAtMs === undefined) return "Deadline unavailable";
  const remaining = order.deadlineAtMs - nowMs;
  return remaining < 0
    ? `Overdue by ${seconds(-remaining)}`
    : remaining === 0
      ? "Due now"
      : `Due in ${seconds(remaining)}`;
}
const blocked: Record<string, string> = {
  PAUSED: "Kitchen paused — finish the guide or resume before pulling.",
  CAPACITY: "Orders is full — move a ticket out before pulling.",
  ENDED: "Run ended — no more pulls.",
  NOT_AVAILABLE: "This VIP is not available to pull.",
  POLICY: "This policy does not allow a manual pull.",
};

/** Reducer preflight is discarded; only a deliberate click requests admission. */
export default function SliceOfFlowVipWatch({
  engine,
  onAdmit,
  onShowArrivals,
}: SliceOfFlowVipWatchProps) {
  const orders = engine.config.manifest.orders;
  const vips = orders
    .filter(order => order.serviceClass === "vip")
    .slice()
    .sort(byArrival)
    .flatMap(order => {
      const ticket = engine.tickets.find(
        item => item.orderKey === order.orderKey
      );
      return ticket ? [{ order, ticket }] : [];
    });
  const pending = vips.find(row => row.ticket.status === "external");
  const scheduled = vips.find(row => row.ticket.status === "scheduled");
  const active = vips.filter(row => row.ticket.status === "active");
  const terminal = vips.filter(row =>
    ["served", "burnt", "discarded"].includes(row.ticket.status)
  );
  const expedite = engine.config.policy.variantId === "expedite";
  const decision = pending
    ? applyAction(engine, { kind: "admit", orderKey: pending.order.orderKey })
    : null;
  const olderNormals = pending
    ? orders.filter(
        order =>
          order.serviceClass !== "vip" &&
          byArrival(order, pending.order) < 0 &&
          engine.tickets.some(
            ticket =>
              ticket.orderKey === order.orderKey && ticket.status === "external"
          )
      ).length
    : 0;
  // Only arrived identities drive the live text: time, station and outcome changes cannot repeat it.
  const arrivedOrdinals = vips
    .filter(row => row.ticket.status !== "scheduled")
    .map(row => row.order.ordinal);
  const announcement = arrivedOrdinals.length
    ? `${arrivedOrdinals.map(ordinal => `VIP Order ${ordinal} has arrived.`).join(" ")} ${
        expedite
          ? "Expedite: pull the earliest waiting VIP when the single VIP token is free."
          : "FIFO: VIPs wait behind older available normal orders."
      }`
    : "";

  return (
    <div className="sof-vip-watch" data-testid="vip-watch">
      <p className="sof-vip-watch-title">
        <span className="sof-vip-badge">VIP</span> Watch
      </p>
      <div
        className="sof-vip-watch-announcement sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      {pending ? (
        <>
          <p className="sof-vip-watch-notice">
            <strong>VIP Order {pending.order.ordinal} has arrived</strong>
            {" · "}
            {due(pending.order, engine.nowMs)}
          </p>
          <p className="sof-vip-watch-detail">
            Waiting outside Orders — no gold kitchen ticket until pulled.
          </p>
          <p className="sof-vip-watch-detail">
            {!expedite
              ? olderNormals > 0
                ? `FIFO: waits behind ${olderNormals} older available normal ${olderNormals === 1 ? "order" : "orders"} outside Orders.`
                : "FIFO: no older available normal orders remain. Pull when Orders has room."
              : active.length > 0
                ? `VIP token occupied by VIP Order ${active[0].order.ordinal} — finish that VIP first.`
                : "Expedite: VIP token free — this VIP may jump the normal backlog."}
          </p>
          {decision &&
            !decision.accepted &&
            !["FIFO", "VIP_TOKEN"].includes(decision.issues[0]?.code) && (
              <p className="sof-vip-watch-detail" data-vip-watch-reason={decision.issues[0]?.code}>
                {blocked[decision.issues[0]?.code] ??
                  "The kitchen cannot admit this VIP yet."}
              </p>
            )}
        </>
      ) : scheduled && active.length === 0 ? (
        <p className="sof-vip-watch-notice">
          {engine.ended
            ? `Run ended. VIP Order ${scheduled.order.ordinal} did not arrive.`
            : `VIP Order ${scheduled.order.ordinal} is scheduled · arrives in ${seconds(scheduled.order.availableAtMs - engine.nowMs)} of active kitchen time.`}
        </p>
      ) : active.length === 0 ? (
        <p className="sof-vip-watch-notice">No VIPs waiting or scheduled.</p>
      ) : null}
      {!pending && engine.pausedBy.length > 0 && !engine.ended && (
        <p className="sof-vip-watch-detail">
          {engine.pausedBy.includes("guide")
            ? "First-order guide paused — arrival countdown waits for the guide."
            : "Kitchen paused — arrival countdown waits until resume."}
        </p>
      )}
      {active.map(({ order, ticket }) => (
        <p className="sof-vip-watch-detail" key={order.orderKey}>
          Active VIP Order {order.ordinal} in{" "}
          {ticket.station ? STATION_NAMES[ticket.station] : "the kitchen"}
          {" · "}
          {due(order, engine.nowMs)}
          {order.deadlineAtMs !== undefined &&
            ` · deadline ${seconds(order.deadlineAtMs)}`}
        </p>
      ))}
      {scheduled && (pending || active.length > 0) && (
        <p className="sof-vip-watch-next">
          {engine.ended
            ? `VIP Order ${scheduled.order.ordinal} did not arrive before the run ended.`
            : `Next: VIP Order ${scheduled.order.ordinal} arrives in ${seconds(scheduled.order.availableAtMs - engine.nowMs)}.`}
        </p>
      )}
      {!pending && active.length === 0 && terminal.length > 0 && (
        <p className="sof-vip-watch-next">
          {terminal
            .map(
              ({ order, ticket }) =>
                `VIP Order ${order.ordinal}: ${ticket.status}`
            )
            .join(" · ")}
        </p>
      )}
      <div className="sof-vip-watch-actions">
        {pending && (
          <button
            type="button"
            disabled={!decision?.accepted}
            onClick={() => {
              if (decision?.accepted) onAdmit(pending.order);
            }}
          >
            Pull waiting VIP Order {pending.order.ordinal}
          </button>
        )}
        <button type="button" onClick={onShowArrivals}>
          Show VIP arrivals
        </button>
      </div>
    </div>
  );
}

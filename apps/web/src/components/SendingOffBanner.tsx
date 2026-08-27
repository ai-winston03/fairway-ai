export const SENDING_OFF_TEXT = "Sending is off.";
export const SENDING_OFF_GOLD = "#b49352";

export function SendingOffBanner({ className = "sending-off-banner" }: { className?: string }) {
  return (
    <p className={className} role="status" style={{ color: SENDING_OFF_GOLD }}>
      {SENDING_OFF_TEXT}
    </p>
  );
}

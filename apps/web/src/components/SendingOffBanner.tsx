export const SENDING_OFF_TEXT = "Sending is off.";

export function SendingOffBanner({ className = "sending-off-banner" }: { className?: string }) {
  return (
    <p className={className} role="status">
      {SENDING_OFF_TEXT}
    </p>
  );
}

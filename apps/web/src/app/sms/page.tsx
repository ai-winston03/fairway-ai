import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Text Messaging | Yuba Golf Club",
  description:
    "How Yuba Golf Club uses SMS: membership signup opt-in, STOP to opt out, and how staff can take over from the bot."
};

export default function SmsLandingPage() {
  return (
    <main className="sms-landing">
      <style>{`
        .sms-landing {
          min-height: 100dvh;
          padding: 2.5rem 1.25rem 4rem;
          color: #09283c;
        }
        .sms-shell {
          width: min(44rem, 100%);
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid #d7e2e4;
          border-radius: 1.5rem;
          box-shadow: 0 18px 60px rgba(9, 40, 60, 0.12);
          overflow: hidden;
        }
        .sms-hero {
          padding: 2rem 1.6rem 1.5rem;
          background:
            linear-gradient(135deg, rgba(8, 122, 181, 0.12), transparent 55%),
            #f8faf8;
          border-bottom: 1px solid #d7e2e4;
        }
        .sms-hero p {
          margin: 0 0 0.45rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-size: 0.72rem;
          font-weight: 700;
          color: #0b6998;
        }
        .sms-hero h1 {
          margin: 0 0 0.65rem;
          font-size: clamp(1.8rem, 4vw, 2.4rem);
          line-height: 1.1;
        }
        .sms-hero span {
          color: #567080;
          font-size: 1.02rem;
        }
        .sms-body {
          padding: 1.5rem 1.6rem 2rem;
          display: grid;
          gap: 1.15rem;
        }
        .sms-body section h2 {
          margin: 0 0 0.4rem;
          font-size: 1.05rem;
        }
        .sms-body p, .sms-body li {
          margin: 0;
          color: #234354;
          line-height: 1.55;
        }
        .sms-body ul {
          margin: 0.35rem 0 0;
          padding-left: 1.15rem;
        }
        .sms-note {
          padding: 0.9rem 1rem;
          border-radius: 0.9rem;
          background: #eef6f8;
          color: #0b6998;
          font-size: 0.92rem;
        }
      `}</style>
      <article className="sms-shell">
        <header className="sms-hero">
          <p>Yuba Golf Club</p>
          <h1>Club text messages</h1>
          <span>This page is the public SMS policy for membership texts, opt-out, and human takeover.</span>
        </header>
        <div className="sms-body">
          <section>
            <h2>Who texts you</h2>
            <p>
              Yuba Golf Club may send operational texts about tee times, your account, and club service.
              Messages come from the club. Staff can pause the bot and take over any thread.
            </p>
          </section>
          <section>
            <h2>How you opted in</h2>
            <p>
              SMS consent comes from the club membership signup sheet. A member phone is treated as opted
              in unless ForeUp has that member marked opt-out for text.
            </p>
          </section>
          <section>
            <h2>How to stop</h2>
            <ul>
              <li>Reply STOP to end texts.</li>
              <li>Reply HELP for help.</li>
              <li>ForeUp text opt-out is honored and blocks further sends.</li>
            </ul>
          </section>
          <section>
            <h2>Humans can take over</h2>
            <p>
              The bot does not own the conversation forever. Staff can pause or take the thread before
              they reply, so a person is not talking over automation. Words like refund, manager, or
              complaint also hand the thread to staff.
            </p>
          </section>
          <section>
            <h2>What we will not do</h2>
            <p>
              We do not sell member numbers. Frequency follows club operations, not a marketing drip.
              If the texting provider is not connected, staff replies stay queued and are not marked sent.
            </p>
          </section>
          <p className="sms-note">
            This is the club operating policy for Twilio review. It is not a live claim that a number is
            already approved.
          </p>
        </div>
      </article>
    </main>
  );
}

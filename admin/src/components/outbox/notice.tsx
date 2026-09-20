import { Alert } from "@/components/ui/alert";

/** The result of the last re-send, carried in the query string. */
export function OutboxNotice({ notice, sent, failed }: { notice?: string; sent?: string; failed?: string }) {
  switch (notice) {
    case "sent":
      return <Alert tone="success" title="Sent" className="mt-6">The message was handed to the mail server.</Alert>;
    case "failed":
      return (
        <Alert tone="danger" title="Still failing" className="mt-6">
          The mail server refused it again. The reason is recorded on the message; fix it and try once more.
        </Alert>
      );
    case "skipped":
      return <Alert tone="info" title="Nothing to do" className="mt-6">That message had already been sent, or another retry claimed it first.</Alert>;
    case "unconfigured":
      return (
        <Alert tone="warning" title="Delivery is not configured" className="mt-6">
          MAIL_DRIVER is not set to <code>smtp</code> with an SMTP_HOST, so nothing can leave. Messages stay queued and
          will go out when it is.
        </Alert>
      );
    case "flushed": {
      const s = Number(sent ?? 0);
      const f = Number(failed ?? 0);
      return (
        <Alert tone={f > 0 ? "warning" : "success"} title="Retried the outbox" className="mt-6">
          {s} {s === 1 ? "message" : "messages"} sent{f > 0 ? `, ${f} still failing` : ""}.
        </Alert>
      );
    }
    default:
      return null;
  }
}

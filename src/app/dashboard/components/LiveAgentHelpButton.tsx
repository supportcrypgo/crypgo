import { Headset } from 'lucide-react';

export default function LiveAgentHelpButton() {
  return (
    <a
      href="mailto:support@crypgo.us.ci?subject=Talk%20to%20Crypgo%20Support"
      target="_blank"
      rel="noopener noreferrer"
      className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-charcoalGray transition-colors hover:bg-deepSlate/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label="Talk to a support agent"
      title="Talk to support"
    >
      <Headset className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
    </a>
  );
}

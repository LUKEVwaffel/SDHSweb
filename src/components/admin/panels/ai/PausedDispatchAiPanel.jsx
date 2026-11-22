import AiHome from './AiHome';
import './dispatchAi.css';

// Render only a static preview while AI usage is paused. The live panel and
// streaming client are deliberately never mounted or imported here.
export default function PausedDispatchAiPanel({ role }) {
  return (
    <div className="dispatch-ai dispatch-ai-paused">
      <div className="dispatch-ai-paused-preview" inert aria-hidden="true">
        <div className="dispatch-ai-home-scroll">
          <AiHome role={role} conversations={[]} onSend={() => {}} onOpenConversation={() => {}} />
        </div>
      </div>
      <div className="dispatch-ai-paused-notice" role="status">
        <strong>AI temporarily unavailable</strong>
        <span>DISPATCH AI is paused until more tokens are available.</span>
      </div>
    </div>
  );
}

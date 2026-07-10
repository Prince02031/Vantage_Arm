// src/components/VoicePanel.jsx
// Phase B ships a typed-fallback voice shell. The Web Speech API recognition
// hook is intentionally stubbed — the real mic capture lands in a later phase
// alongside the agentic LLM parser. The typed textbox is the source of truth
// in this phase and is fed through the deterministic parser.
import { useState } from 'react';
import { parseVoiceCommand } from '../controls/voiceCommandParser.js';
import { executeCommand } from '../core/motionPipeline.js';

// Phrase examples covering the new Phase C commands. Click a chip to fire it.
const EXAMPLES = [
  'move up',
  'move down',
  'move left',
  'move right',
  'move forward',
  'move backward',
  'move to 0.55 0 0.10',
  'press key one',
  'press key two',
  'press key three',
  'press key four',
  'press key five',
  'press key six',
  'enter pin 123456',
  'home',
  'stop'
];

export default function VoicePanel() {
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState(null);

  const submit = (text) => {
    const phrase = (text ?? transcript).trim();
    if (!phrase) {
      setResult({ matched: false, message: 'Type or speak a command first.' });
      return;
    }
    const parsed = parseVoiceCommand(phrase, { source: 'voice' });
    setResult(parsed);
    if (parsed.matched && parsed.command) {
      // Funnel through the shared pipeline; never mutate robot state directly.
      executeCommand(parsed.command);
    }
  };

  return (
    <section className="voice-panel" aria-label="Voice controls">
      <header className="voice-panel-header">
        <h3>Voice</h3>
        <span className="panel-subtitle">Deterministic parser · typed fallback</span>
      </header>

      <div className="voice-input-row">
        <input
          type="text"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder='Try: "press key two" or "home"'
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          aria-label="Voice command text input"
        />
        <button type="button" className="btn btn-primary" onClick={() => submit()}>Send</button>
      </div>

      <div className="voice-examples">
        <span className="voice-examples-label">Examples:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chip"
            onClick={() => { setTranscript(ex); submit(ex); }}
          >
            {ex}
          </button>
        ))}
      </div>

      {result && (
        <div className={`voice-result ${result.matched ? 'voice-result-ok' : 'voice-result-bad'}`}>
          <strong>{result.matched ? 'Recognized' : 'Unrecognized'}</strong>
          <span>{result.message}</span>
        </div>
      )}

      <p className="voice-hint">
        Web-Speech microphone capture and the agentic LLM parser are slated for
        a later phase. Until then, the typed fallback routes through the same
        deterministic parser that will later accept real speech transcripts.
      </p>
    </section>
  );
}


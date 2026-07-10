// src/components/VoicePanel.jsx
// Phase E: Deterministic voice command parser with live SpeechRecognition
// and typed fallback. Incorporates optional TTS feedback.
import { useState, useEffect, useRef } from 'react';
import { parseAndExecuteVoiceCommand } from '../controls/voiceCommandParser.js';
import { executeCommand } from '../core/motionPipeline.js';
import { addStatusLog } from '../core/robotStore.js';

// Phrase examples covering the new Phase E commands. Click a chip to fire it.
const EXAMPLES = [
  'move up',
  'rotate base 30 degrees',
  'press key five',
  'enter pin 123456',
  'draw a triangle',
  'press keys 1 3 5',
  'move to safe zone',
  'home',
  'stop'
];

// Lazy-check so module load doesn't crash in non-browser/SSR environments
function getSpeechRecognition() {
  return typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
}
const hasSpeechSupport = !!getSpeechRecognition();

function speakFeedback(message) {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(utterance);
  }
}

export default function VoicePanel() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [isAgentMode, setIsAgentMode] = useState(true);
  
  const recognitionRef = useRef(null);
  // submitRef always points to the latest submit closure — fixes stale closure bug
  // where recognition.onresult would capture the initial stale version of submit
  const submitRef = useRef(null);

  const submit = async (text) => {
    const phrase = (text ?? transcript).trim();
    if (!phrase) {
      setResult({ ok: false, message: 'Type or speak a command first.' });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    addStatusLog({
      level: 'info',
      message: `Voice input captured: "${phrase}"`,
      source: 'voice'
    });

    try {
      const res = await parseAndExecuteVoiceCommand(phrase, executeCommand, { source: 'voice', isAgentMode });
      
      // Build display message: parse failure → parse msg, exec failure → exec msg, success → exec msg
      const isParsed = res.parseResult ? res.parseResult.ok : false;
      let displayMsg;
      if (!isParsed) {
        // Parse itself failed — show why parsing rejected it
        displayMsg = res.parseResult ? res.parseResult.message : res.message;
      } else if (!res.ok) {
        // Parse passed but execution/pipeline rejected it — show execution reason
        displayMsg = res.message || (res.parseResult && res.parseResult.message);
      } else {
        // Full success — show execution result (e.g. "Key [5] pressed successfully")
        displayMsg = res.message || (res.parseResult && res.parseResult.message);
      }
      
      setResult({ 
        ok: isParsed && res.ok, 
        message: displayMsg,
        commands: res.parseResult?.commands,
        mode: res.parseResult?.mode
      });
      speakFeedback(displayMsg);

      if (!isParsed) {
        addStatusLog({
          level: 'warning',
          message: `Parser failed to understand: "${phrase}". Reason: ${displayMsg}`,
          source: 'voice'
        });
      }
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Keep submitRef current on every render
  submitRef.current = submit;

  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    
    // Use submitRef.current to always call the latest submit (avoids stale closure)
    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setTranscript(spokenText);
      submitRef.current(spokenText);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error !== 'no-speech') {
        setResult({ ok: false, message: `Microphone error: ${event.error}` });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setResult(null);
        setTranscript('');
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
      }
    }
  };

  return (
    <section className="voice-panel" aria-label="Voice controls">
      <header className="voice-panel-header">
        <h3>Voice &amp; Agentic Control</h3>
        <span className="panel-subtitle">
          {hasSpeechSupport ? 'Mic Supported · Gemini Ready' : 'Mic Unsupported · Text Fallback Only'}
        </span>
      </header>

      {/* Mode selection buttons */}
      <div className="mode-toggle-row" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
        <button
          type="button"
          className={`btn ${!isAgentMode ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, fontSize: '11px', padding: '0.4rem 0.5rem', fontWeight: 600 }}
          onClick={() => setIsAgentMode(false)}
        >
          Normal Mode
        </button>
        <button
          type="button"
          className={`btn ${isAgentMode ? 'btn-primary' : 'btn-secondary'}`}
          style={{ 
            flex: 1, 
            fontSize: '11px', 
            padding: '0.4rem 0.5rem', 
            fontWeight: 600, 
            borderColor: isAgentMode ? '#f1c40f' : undefined,
            color: isAgentMode ? '#f1c40f' : '#8b949e'
          }}
          onClick={() => setIsAgentMode(true)}
        >
          ⭐ Agent Mode
        </button>
      </div>

      {hasSpeechSupport && (
        <div style={{ marginBottom: '0.75rem' }}>
          <button 
            type="button" 
            className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`} 
            style={{ width: '100%' }}
            onClick={toggleListening}
            disabled={isProcessing}
          >
            {isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
          </button>
        </div>
      )}

      <div className="voice-input-row">
        <input
          type="text"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder='Try: "draw a triangle", "press key five" or "home"'
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          aria-label="Voice command text input"
          disabled={isProcessing}
        />
        <button type="button" className="btn btn-secondary" onClick={() => submit()} disabled={isProcessing}>
          {isProcessing ? 'Thinking…' : 'Run'}
        </button>
      </div>

      <div className="voice-examples">
        <span className="voice-examples-label">Examples:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chip"
            onClick={() => { setTranscript(ex); submit(ex); }}
            disabled={isProcessing}
          >
            {ex}
          </button>
        ))}
      </div>

      {result && (
        <div className={`voice-result ${result.ok ? 'voice-result-ok' : 'voice-result-bad'}`}>
          <strong>{result.ok ? 'Recognized & Executed' : 'Failed'}</strong>
          <span>{result.message}</span>
        </div>
      )}

      {result && result.commands && (
        <div className="agentic-plan-box" style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '6px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#79c0ff'
        }}>
          <div style={{ color: '#8b949e', marginBottom: '0.3rem', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>
            Generated Plan ({result.mode})
          </div>
          <pre style={{ margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(result.commands, null, 2)}
          </pre>
        </div>
      )}

      <p className="voice-hint">
        Phase E/Agentic: Input is parsed by strict regexes first. If unrecognized, 
        it falls back to a Gemini 2.5 LLM agent (or local simulator if no API key is set) 
        to compile a multi-step JSON trajectory plan, validated by the safety validator.
      </p>
    </section>
  );
}

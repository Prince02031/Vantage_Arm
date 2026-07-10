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
  'move down',
  'move left',
  'move right',
  'move forward',
  'move backward',
  'rotate base 30 degrees',
  'press key five',
  'press key 5',
  'enter pin 123456',
  'enter pin one two three four five six',
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
  const [result, setResult] = useState(null);
  
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

    addStatusLog({
      level: 'info',
      message: `Voice input captured: "${phrase}"`,
      source: 'voice'
    });

    const res = await parseAndExecuteVoiceCommand(phrase, executeCommand, { source: 'voice' });
    
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
    
    setResult({ ok: isParsed && res.ok, message: displayMsg });
    speakFeedback(displayMsg);

    if (!isParsed) {
      addStatusLog({
        level: 'warning',
        message: `Parser failed to understand: "${phrase}". Reason: ${displayMsg}`,
        source: 'voice'
      });
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
        <h3>Voice &amp; Text Command</h3>
        <span className="panel-subtitle">
          {hasSpeechSupport ? 'Mic Supported · TTS Ready' : 'Mic Unsupported · Text Fallback Only'}
        </span>
      </header>

      {hasSpeechSupport && (
        <div style={{ marginBottom: '0.75rem' }}>
          <button 
            type="button" 
            className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`} 
            style={{ width: '100%' }}
            onClick={toggleListening}
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
          placeholder='Try: "press key two" or "home"'
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          aria-label="Voice command text input"
        />
        <button type="button" className="btn btn-secondary" onClick={() => submit()}>Run</button>
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
        <div className={`voice-result ${result.ok ? 'voice-result-ok' : 'voice-result-bad'}`}>
          <strong>{result.ok ? 'Recognized & Executed' : 'Failed'}</strong>
          <span>{result.message}</span>
        </div>
      )}

      <p className="voice-hint">
        Phase E: Commands must match strict deterministic regexes. The active
        parser intercepts voice or typed input and translates it strictly into 
        motion pipeline commands. Unrecognized inputs are rejected.
      </p>
    </section>
  );
}

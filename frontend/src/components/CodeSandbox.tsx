'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Terminal as TerminalIcon, AlertCircle, Trash2 } from 'lucide-react';

interface Props {
  code: string;
  language: string;
}

export default function CodeSandbox({ code, language }: Props) {
  const [output, setOutput] = useState<{type: 'log' | 'error' | 'warn' | 'info', content: string}[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const langLower = language.toLowerCase();
  const isJsSupported = ['javascript', 'js', 'typescript', 'tsx', 'jsx'].includes(langLower);
  const isPySupported = ['python', 'py'].includes(langLower);
  const isSupported = isJsSupported || isPySupported;

  const clearOutput = () => setOutput([]);

  const stopExecution = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setIsRunning(false);
      setOutput(prev => [...prev, { type: 'info', content: 'Ejecución terminada por el usuario o por timeout.' }]);
    }
  };

  const runJavaScript = () => {
    clearOutput();
    setIsRunning(true);

    const workerCode = `
      self.onmessage = function(e) {
        const userCode = e.data;
        
        function sendLog(type, args) {
          const content = Array.from(args).map(a => {
            if (typeof a === 'object') {
               try { return JSON.stringify(a, null, 2); }
               catch(e) { return String(a); }
            }
            return String(a);
          }).join(' ');
          self.postMessage({ type, content });
        }

        console.log = function(...args) { sendLog('log', args); };
        console.error = function(...args) { sendLog('error', args); };
        console.warn = function(...args) { sendLog('warn', args); };

        try {
          const result = new Function(userCode)();
          if (result !== undefined) {
             self.postMessage({ type: 'info', content: 'Returned: ' + String(result) });
          }
          self.postMessage({ type: 'done' });
        } catch (error) {
          self.postMessage({ type: 'error', content: error.stack || String(error) });
          self.postMessage({ type: 'done' });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    workerRef.current = new Worker(workerUrl);

    workerRef.current.onmessage = (e) => {
      const { type, content } = e.data;
      if (type === 'done') {
        setIsRunning(false);
        URL.revokeObjectURL(workerUrl);
      } else {
        setOutput(prev => [...prev, { type, content }]);
      }
    };

    workerRef.current.onerror = (e) => {
      setOutput(prev => [...prev, { type: 'error', content: `Worker error: ${e.message}` }]);
      setIsRunning(false);
      URL.revokeObjectURL(workerUrl);
    };

    // Timeout de 5 segundos
    setTimeout(() => {
      if (workerRef.current) {
        stopExecution();
      }
    }, 5000);

    workerRef.current.postMessage(code);
  };

  const runPython = () => {
    clearOutput();
    setIsRunning(true);
    setOutput([{ type: 'info', content: 'Inicializando intérprete Python (Pyodide)... Esto puede tardar unos segundos la primera vez.' }]);

    const workerCode = `
      importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.6/full/pyodide.js');

      self.onmessage = async function(e) {
        const userCode = e.data;
        try {
          const pyodide = await loadPyodide();

          // Redirect stdout/stderr to capture print() output
          pyodide.runPython(\`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self, stream_type):
        self.stream_type = stream_type
        self.buffer = StringIO()
    def write(self, text):
        if text.strip():
            self.buffer.write(text)
            import js
            js.postMessage(js.JSON.parse(js.JSON.stringify({"type": self.stream_type, "content": text})))
    def flush(self):
        pass

sys.stdout = OutputCapture("log")
sys.stderr = OutputCapture("error")
          \`);

          const result = pyodide.runPython(userCode);
          if (result !== undefined && result !== null) {
            const resultStr = String(result);
            if (resultStr !== 'None') {
              self.postMessage({ type: 'info', content: 'Returned: ' + resultStr });
            }
          }
          self.postMessage({ type: 'done' });
        } catch (error) {
          self.postMessage({ type: 'error', content: String(error) });
          self.postMessage({ type: 'done' });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    workerRef.current = new Worker(workerUrl);

    workerRef.current.onmessage = (e) => {
      const { type, content } = e.data;
      if (type === 'done') {
        setIsRunning(false);
        URL.revokeObjectURL(workerUrl);
      } else {
        // Filter out the initialization message once real output arrives
        setOutput(prev => {
          const filtered = prev.filter(p => !p.content.includes('Inicializando intérprete Python'));
          return [...filtered, { type, content }];
        });
      }
    };

    workerRef.current.onerror = (e) => {
      setOutput(prev => [...prev, { type: 'error', content: `Worker error: ${e.message}` }]);
      setIsRunning(false);
      URL.revokeObjectURL(workerUrl);
    };

    // Timeout de 15 segundos (Python/Pyodide needs more time to initialize)
    setTimeout(() => {
      if (workerRef.current) {
        stopExecution();
      }
    }, 15000);

    workerRef.current.postMessage(code);
  };

  const runCode = () => {
    if (isJsSupported) {
      runJavaScript();
    } else if (isPySupported) {
      runPython();
    } else {
      setOutput([{ type: 'error', content: `Lenguaje '${language}' no soportado en Sandbox de Navegador.` }]);
    }
  };

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const langLabel = isPySupported ? 'Python' : isJsSupported ? 'JavaScript' : language;

  return (
    <div className="animate-in" style={{ marginTop: '1.5rem', background: 'var(--surface-container-high)', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid rgba(72,72,73,0.2)' }}>
      {/* Header Sandbox */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(72,72,73,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--on-surface)' }}>
          <TerminalIcon size={16} color="var(--primary)" />
          Sandbox Entorno Local
          {isSupported ? (
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: isPySupported ? '#ffb74d' : 'var(--primary)', background: isPySupported ? 'rgba(255,183,77,0.1)' : 'rgba(109,221,255,0.1)', padding: '0.15rem 0.45rem', borderRadius: '0.25rem' }}>
              {langLabel}
            </span>
          ) : (
            <span style={{color: 'var(--on-surface-variant)', fontWeight: 400}}>(No soportado para {language})</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {output.length > 0 && (
             <button onClick={clearOutput} title="Limpiar consola" style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
               <Trash2 size={16} />
             </button>
          )}
          {isRunning ? (
             <button className="btn-danger" onClick={stopExecution} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Square size={14} fill="currentColor" /> Detener
            </button>
          ) : (
            <button className="btn-primary" onClick={runCode} disabled={!isSupported} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Play size={14} fill="currentColor" /> Ejecutar
            </button>
          )}
        </div>
      </div>

      {/* Console Output */}
      {output.length > 0 ? (
        <div style={{ padding: '1rem', background: '#0a0a0a', minHeight: '100px', maxHeight: '300px', overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
          {output.map((out, i) => (
            <div key={i} style={{ 
              marginBottom: '0.5rem', 
              color: out.type === 'error' ? 'var(--error)' : out.type === 'warn' ? '#ffb74d' : out.type === 'info' ? 'var(--outline-variant)' : '#e0e0e0',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start'
            }}>
              <span style={{color: 'var(--outline)', userSelect: 'none'}}>&gt;</span>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace' }}>{out.content}</pre>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--on-surface-variant)', background: '#0a0a0a' }}>
           <AlertCircle size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
           <p style={{ fontSize: '0.85rem', textAlign: 'center' }}>
             {isSupported
               ? `Presiona Ejecutar para ver la salida del código ${langLabel}.${isPySupported ? ' La primera ejecución de Python puede tardar unos segundos mientras se carga el intérprete.' : ''}`
               : 'La ejecución en el cliente actualmente soporta JavaScript y Python.'}
           </p>
        </div>
      )}
    </div>
  );
}

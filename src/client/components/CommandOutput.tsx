import { useCallback, useRef } from 'react';
import type { CommandOutput as CommandOutputType } from '../hooks/useSocket';

interface CommandOutputProps {
  output: CommandOutputType[];
  isRunning: boolean;
}

export default function CommandOutput({ output, isRunning }: CommandOutputProps) {
  const scrollFrameRef = useRef<number>(0);

  // Ref callback that scrolls element into view, debounced via rAF
  // so rapid output lines only trigger one scroll per animation frame
  const scrollToBottomRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      node.scrollIntoView({ block: 'end' });
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          {isRunning && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
          <h3 className="text-lg font-semibold text-gray-800">
            {isRunning ? 'Executing...' : 'Output'}
          </h3>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto">
          {output.length === 0 ? (
            <div className="text-gray-500">Waiting for output...</div>
          ) : (
            output.map((line, index) => (
              <div
                key={index}
                ref={index === output.length - 1 ? scrollToBottomRef : undefined}
                className={`whitespace-pre-wrap ${
                  line.type === 'stderr'
                    ? 'text-yellow-400'
                    : line.type === 'error'
                    ? 'text-red-400'
                    : line.type === 'exit'
                    ? line.code === 0
                      ? 'text-green-400'
                      : 'text-red-400'
                    : 'text-gray-100'
                }`}
              >
                {line.type === 'exit'
                  ? `\nProcess exited with code ${line.code}`
                  : line.data}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

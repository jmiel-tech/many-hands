// Entry point for the assistant. When it's switched off this renders nothing and the chat code is never loaded.
import { Suspense, lazy } from 'react';
import { ASSISTANT_ENABLED } from './config.js';

// The env check is written out here so the build can see it's false and leave the chat code out entirely.
const Assistant = import.meta.env.VITE_ENABLE_ASSISTANT === 'true' && ASSISTANT_ENABLED
  ? lazy(() => import('./Assistant.jsx'))
  : null;

export default function AssistantMount() {
  if (!Assistant) return null;
  return (
    <Suspense fallback={null}>
      <Assistant />
    </Suspense>
  );
}

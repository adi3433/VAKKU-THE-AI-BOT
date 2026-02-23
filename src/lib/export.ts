/**
 * Chat Export — JSON & Text export utilities
 */
import type { ChatMessage } from '@/types';

/** Export chat as JSON download */
export function exportChatJSON(messages: ChatMessage[], sessionId: string) {
  const data = {
    exported: new Date().toISOString(),
    sessionId,
    messageCount: messages.length,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      locale: m.locale,
      timestamp: m.timestamp,
      confidence: m.confidence,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `vaakku-chat-${formatDate()}.json`);
}

/** Export chat as plain text download */
export function exportChatText(messages: ChatMessage[]) {
  const lines = messages.map((m) => {
    const role = m.role === 'user' ? 'You' : 'Vaakku';
    const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
    return `[${role}] ${time}\n${m.content}\n`;
  });

  const text = `Vaakku Chat Export\n${new Date().toLocaleString()}\n${'─'.repeat(40)}\n\n${lines.join('\n')}`;
  const blob = new Blob([text], { type: 'text/plain' });
  downloadBlob(blob, `vaakku-chat-${formatDate()}.txt`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

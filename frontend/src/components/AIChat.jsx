// ============================================================================
// AIChat.jsx
// ============================================================================
// The right-side AI assistant panel.
//
// State shape:
//   messages: [{ role: 'user' | 'assistant', content: '...' }, ...]
//   input:    whatever the user is typing
//   sending:  true while waiting for Claude's response (disables input)
// ============================================================================

import { useState } from 'react'
import { chat as chatAPI } from '../api/ai.js'


export default function AIChat({ collapsed, onToggle, datasetId }) {

  // --- Collapsed state: show a thin rail with just the ✦ icon ---
  if (collapsed) {
    return (
      <aside
        className="bg-white border-l border-gray-200 flex items-start justify-center pt-4 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
        title="Open AI chat (Ctrl+.)"
      >
        <span className="text-brand-500 text-sm">✦</span>
      </aside>
    )
  }

  // --- Expanded state: full chat UI ---
  return <ExpandedChat onToggle={onToggle} datasetId={datasetId} />
}


function ExpandedChat({ onToggle, datasetId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    // Optimistically add the user's message to the chat before the API returns
    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      // Send all prior messages so Claude has conversation context
      const response = await chatAPI(text, messages, datasetId)
      setMessages([...newMessages, { role: 'assistant', content: response }])
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Something went wrong: ' + (err.response?.data?.error || err.message),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <aside className="bg-white border-l border-gray-200 flex flex-col">
      {/* Header with collapse button */}
      <div className="px-3.5 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-brand-500 text-sm">✦</span>
          <span className="text-xs font-medium">AI Assistant</span>
        </div>
        <button
          onClick={onToggle}
          className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm border border-gray-200"
          title="Collapse (Ctrl+.)"
        >
          ›
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="text-[11px] text-gray-400 text-center py-4">
            Ask anything about your data.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={
                'rounded-md px-2.5 py-2 text-[11px] leading-relaxed ' +
                (msg.role === 'user'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-brand-50 text-brand-800')
              }
            >
              {msg.content}
            </div>
          ))
        )}
        {sending && (
          <div className="text-[11px] text-gray-400 italic">Thinking...</div>
        )}
      </div>

      {/* Input */}
      <div className="p-2.5 border-t border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask anything about your data..."
          disabled={sending}
          className="w-full text-[11px] border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-brand-500"
        />
      </div>
    </aside>
  )
}

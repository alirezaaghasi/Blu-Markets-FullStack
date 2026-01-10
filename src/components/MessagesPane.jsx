export default function MessagesPane({ messages }) {
  return (
    <div>
      {messages.map((m, i) => (
        <div key={i} className={'msg ' + (m.from === 'user' ? 'user' : '')}>
          <div className="meta">{m.from}</div>
          <div>{m.text}</div>
        </div>
      ))}
    </div>
  );
}

const coordinate = /((?:[A-Z]′?\s*)?\([−-]?\d+(?:\.\d+)?,\s*[−-]?\d+(?:\.\d+)?\))/g;

export default function QuestionPrompt({ text }: { text: string }) {
  return text.split(coordinate).map((part, i) => i % 2 ? <span key={i} className="mt-prompt-coordinate">{part}</span> : part);
}

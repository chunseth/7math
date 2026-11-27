import { useEffect, useRef, useState, type CSSProperties } from "react";
import { leastOrderAttempt } from "../../../lib/mentalist/least-order";

const sizes = [62, 76, 90];
const popTime = 160;

export default function LeastOrderBubbles({ options, order, disabled, onAnswer }: {
  options: string[];
  order: string[];
  disabled: boolean;
  onAnswer: (raw: string) => void;
}) {
  const [diameters, setDiameters] = useState(sizes);
  const [picks, setPicks] = useState<string[]>([]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const submitted = useRef(false);
  const send = useRef(onAnswer);
  send.current = onAnswer;

  useEffect(() => {
    const shuffled = [...sizes];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDiameters(shuffled);
  }, []);

  useEffect(() => {
    if (disabled || picks.length !== order.length || submitted.current) return;
    const timer = setTimeout(() => {
      submitted.current = true;
      send.current(leastOrderAttempt(picks));
    }, popTime);
    return () => clearTimeout(timer);
  }, [disabled, picks, order.length]);

  return <div className="mt-number-bubbles" role="group" aria-label="Number bubbles">
    {options.map((option, i) => {
      const popped = picks.includes(option);
      return <button key={option} type="button" ref={node => { buttons.current[i] = node; }}
        className="mt-number-bubble" style={{ "--bubble-size": diameters[i] + "px" } as CSSProperties}
        disabled={disabled || popped} aria-hidden={popped || undefined} data-popped={popped}
        onClick={event => {
          if (submitted.current || disabled || popped) return;
          const next = [...picks, option];
          if (option !== order[picks.length]) {
            submitted.current = true;
            onAnswer(leastOrderAttempt(next));
            return;
          }
          if (event.detail === 0) {
            const remaining = options.findIndex(value => !next.includes(value));
            buttons.current[remaining]?.focus();
          }
          setPicks(next);
        }}>
        <span>{option.replace(/^-/, "−")}</span>
      </button>;
    })}
    <span className="mt-bubble-status" role="status">{picks.length} of {order.length} bubbles popped</span>
  </div>;
}

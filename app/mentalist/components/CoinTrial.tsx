import { useState } from "react";
import { coinTrialAnswers, coinTrialAttempt, type Question } from "../../../lib/mentalist/model";
import StructuredAnswer from "./StructuredAnswer";

export default function CoinTrial({ question, trials, disabled, onAnswer }: {
  question: Question;
  trials: number;
  disabled: boolean;
  onAnswer: (raw: string) => void;
}) {
  const [tosses, setTosses] = useState("");
  return <div className="mt-data">
    <p>Trial {tosses.length} of {trials}</p>
    <button type="button" disabled={disabled || tosses.length === trials}
      onClick={() => {
        const face = crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? "H" : "T";
        setTosses(current => current.length < trials ? current + face : current);
      }}>Run next trial</button>
    <output aria-live="polite">{[...tosses].join(" · ")}</output>
    {tosses.length === trials && <StructuredAnswer question={question} disabled={disabled} fieldAnswers={coinTrialAnswers(tosses)}
      onAnswer={raw => onAnswer(coinTrialAttempt(tosses, raw))} />}
  </div>;
}

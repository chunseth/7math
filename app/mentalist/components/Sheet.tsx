import { useEffect, useRef, type ReactNode } from "react";

export function Sheet({ children, close, labelledBy }: {
  children: ReactNode;
  close: () => void;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => {
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="mt-sheet"
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current!.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
        }
      }}
    >
      <button className="mt-close" onClick={close} aria-label="Close">
        ×
      </button>
      {children}
    </dialog>
  );
}
